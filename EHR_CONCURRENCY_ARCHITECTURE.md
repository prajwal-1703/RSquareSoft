# PulseGrid AI — EHR Concurrency Engine Architecture
## Solving the Concurrent Clinical Record Problem

In a high-intensity ICU setting, patient vitals, medication rates, and progress notes are modified simultaneously by doctors, nurses, and lab technicians. This document details how **PulseGrid AI** solves the core concurrency problem—preventing overwrite loss, maintaining database consistency, securing data entry through role-based access, and preserving an immutable audit trail.

---

## 1. Core Concurrency Check: Database-Level Optimistic Concurrency Control (OCC)

Instead of using heavy, blocking database locks (Pessimistic Locking) which degrade application response times under load, the backend utilizes **Optimistic Concurrency Control (OCC)** coupled with isolated transactions.

### How it Works (The OCC Transaction Loop)

When a clinician loads a patient record, the application fetches the current patient data along with its unique `version` tag (e.g., `v1`).
When they save an update, the backend executes an isolated Prisma Transaction (`prisma.$transaction`) that follows this rigorous logical sequence:

1. **BEGIN TRANSACTION:** Locks the requested patient row inside the database.
2. **FETCH & CHECK:** Queries the database's current version index. If another clinician has updated the row in the meantime, the version inside the database will have bumped (e.g., `v2`).
3. **VERSION COMPARISON:** 
   * If `clientVersion === dbVersion`, it is considered a safe write. The transaction applies changes, increments the version to `version + 1`, saves an immutable version snapshot, and commits.
   * If `clientVersion !== dbVersion`, a conflict is detected. The transaction immediately **rolls back** and returns an `HTTP 409 Conflict` error to the client, preventing any loss of concurrent data.

### The Code Implementation

Here is the transaction-guaranteed check implemented inside [ehr.service.js](server/src/modules/ehr/ehr.service.js):

```javascript
async updateEHR(patientId, data, requestingUser) {
  const { version, vitals, diagnosis, medication, labReport, allergy } = data;

  return await prisma.$transaction(async (tx) => {
    // 1. Lock patient row and retrieve current state
    const patient = await tx.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) throw AppError.notFound('Patient not found');
    if (!patient.isActive) throw AppError.badRequest('Patient record is not active');

    // ── OPTIMISTIC CONCURRENCY CHECK ──────────────────────────
    if (patient.version !== version) {
      logger.warn(
        `[EHR] Concurrency conflict: patient ${patientId} expected v${version}, got v${patient.version}`
      );
      throw AppError.versionConflict('Patient EHR'); // HTTP 409
    }

    const newVersion = patient.version + 1;
    const changes = [];

    // 2. Safely commit nested structures (vitals, diagnoses, etc.)
    if (vitals) {
      await tx.vital.create({ data: { patientId, ...vitals } });
      changes.push('vitals');
    }
    // ... Additional records ...

    // 3. Bump the version counter
    const updatedPatient = await tx.patient.update({
      where: { id: patientId },
      data: { version: newVersion, updatedAt: new Date() },
    });

    // 4. Create an immutable snapshot of this version
    await tx.patientVersion.create({
      data: {
        patientId,
        version: newVersion,
        snapshot: { ...updatedPatient },
        changesSummary: `Updated: ${changes.join(', ')}`,
        updatedById: requestingUser.id,
      },
    });

    return { patient: updatedPatient, newVersion, changes };
  });
}
```

---

## 2. Maintaining an Immutable Audit Trail

Nobody has to guess *"which version is correct"* because the platform maintains a perfect historical record:

1. **`PatientVersion` Snapshots:** Every successful write creates a row in the `PatientVersion` table, saving a complete JSON snapshot of the patient record at that moment, tagged with the writing clinician's ID and a text summary of the changes made (e.g., `"Updated: vitals, diagnosis"`).
2. **Timeline Audits:** The clinician dashboard displays a live, read-only version history. When clicking an older version, the entire UI shifts into a **view-only history inspect mode**, rendering exactly what the record looked like at that version index.
3. **Audit Logs:** Critical actions (like patient registration or system rollback) write outside the transaction to the database-level `AuditLog` for centralized security auditing.

---

## 3. Client Concurrency Conflict UI (3-Way Merge)

When a version conflict (HTTP 409) occurs, instead of throwing an error or blindly overwriting the database, PulseGrid handles the exception and triggers a **3-Way Merge** prompt inside the React dashboard:

```tsx
const updateMutation = useMutation({
  mutationFn: (body: any) => ehrApi.updateEHR(selectedPatientId!, body),
  onSuccess: () => {
    setSaveStatus("saved");
    qc.invalidateQueries({ queryKey: ["patient-ehr", selectedPatientId] });
  },
  onError: (err: any) => {
    if (err.response?.status === 409) {
      // 🚨 Trigger 3-Way Merge UI Modal
      setConflict(true);
      setSaveStatus("error");
    }
  }
});
```

The user is shown exactly:
* **YOURS:** The changes they tried to commit.
* **THEIRS:** The changes that another clinician committed in the meantime.
* **RESOLVED:** An instant option to review, accept the latest merge (pulling in the new version), or choose which clinical entry wins, keeping medical history consistent without losing work.

---

## 4. Strict Role-Based Access Control (RBAC)

Operations are restricted depending on clinical autonomy levels to ensure that patient records are only modified by authorized staff while preventing general lockouts:

| Role | EHR View | Update Vitals / Meds | Commit Snapshots | Rollback Version | Sim Conflict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Nurse** | ✅ | ✅ | ✅ | ❌ *(Unauthorized)* | ❌ *(Unauthorized)* |
| **Doctor** | ✅ | ✅ | ✅ | ❌ *(Unauthorized)* | ❌ *(Unauthorized)* |
| **Admin** | ✅ | ✅ | ✅ | ✅ *(Authorized)* | ✅ *(Authorized)* |

* **Clinical Autonomy:** Doctors and Nurses can perform all vital additions, write clinical progress notes, register new diagnoses, and write medications.
* **Operational Security:** System-altering functions (such as rollback to previous versions or manual override simulation triggers) are exclusively exposed to authorized `admin` logins. This protects historical records from accidental rollbacks by bedside staff while maintaining a transparent chain of command.
