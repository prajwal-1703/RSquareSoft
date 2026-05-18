# PulseGrid AI — Critical Care Intelligence Platform

> **Production-grade AI healthcare backend** for real-time ICU coordination, mortality risk prediction, and concurrent-safe EHR management.

---

## 🏗️ Architecture Overview

```
server/
├── src/
│   ├── modules/
│   │   ├── auth/          # JWT + RBAC authentication
│   │   ├── ehr/           # EHR + optimistic concurrency control
│   │   ├── icu/           # ICU allocation engine (SELECT FOR UPDATE)
│   │   ├── ai/            # AI risk inference client
│   │   ├── audit/         # Immutable audit logging
│   │   ├── websocket/     # Socket.IO + Redis Pub/Sub
│   │   ├── notifications/ # Real-time + persisted notifications
│   │   └── simulation/    # Emergency scenario simulator
│   ├── middleware/        # Auth, RBAC, validation, error handler
│   ├── config/            # DB, Redis, app config
│   └── utils/             # Logger, ApiResponse, AppError
├── prisma/
│   ├── schema.prisma      # Full DB schema (11 models)
│   └── seed.js            # Realistic seed data
└── docker/
    └── ai-service/        # FastAPI + XGBoost inference service
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- PostgreSQL 16 (or via Docker)
- Redis 7 (or via Docker)

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start infrastructure with Docker

```bash
docker-compose up -d postgres redis pgadmin redisinsight ai-service
```

### 4. Set up database

```bash
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run migrations
npm run db:seed       # Seed realistic data
```

### 5. Start the server

```bash
npm run dev           # Development (hot reload)
npm start             # Production
```

---

## 🐳 Full Docker Setup

```bash
docker-compose up --build
```

Services started:
| Service | Port | URL |
|---------|------|-----|
| API Server | 4000 | http://localhost:4000 |
| AI Service | 8000 | http://localhost:8000 |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |
| PgAdmin | 5050 | http://localhost:5050 |
| RedisInsight | 5540 | http://localhost:5540 |

---

## 🔐 Authentication

All endpoints (except `/health`) require JWT Bearer token.

```bash
# Register
POST /api/auth/register

# Login
POST /api/auth/login
→ Returns { accessToken, refreshToken, user }

# Refresh
POST /api/auth/refresh

# Logout
POST /api/auth/logout

# Profile
GET /api/auth/me
```

### Roles
| Role | Permissions |
|------|------------|
| `admin` | Full access including audit, simulation, allocation |
| `doctor` | EHR read/write, ICU allocation, AI predictions, rollback |
| `nurse` | EHR read/write vitals/medications |
| `lab_technician` | Lab report entry only |

### Seed Credentials (password: `PulseGrid@123`)
- `admin@pulsegrid.ai` — Admin
- `dr.smith@pulsegrid.ai` — Doctor
- `nurse.johnson@pulsegrid.ai` — Nurse
- `lab@pulsegrid.ai` — Lab Technician

---

## 📋 API Reference

### EHR — Patient Records

```bash
GET    /api/ehr/patients              # List patients
POST   /api/ehr/patients              # Create patient
GET    /api/ehr/patients/:id          # Get patient + full EHR
PATCH  /api/ehr/patients/:id          # Update EHR (concurrency-safe)
GET    /api/ehr/patients/:id/timeline # Chronological event timeline
GET    /api/ehr/patients/:id/versions # Version history
POST   /api/ehr/patients/:id/rollback # Rollback to previous version
```

#### Optimistic Concurrency Control
Every EHR update requires the current `version` number. If another write happened in the meantime, a `409 Conflict` is returned.

```json
PATCH /api/ehr/patients/:id
{
  "version": 3,
  "vitals": { "heartRate": 110, "spo2": 91 },
  "diagnosis": { "description": "ARDS", "severity": "critical" }
}
```

---

### ICU — Resource Allocation

```bash
POST   /api/icu/allocate              # Allocate ICU bed or ventilator
PATCH  /api/icu/release/:id           # Release resource
PATCH  /api/icu/reassign/:id          # Reassign to another patient
GET    /api/icu/occupancy             # Real-time bed/vent status
GET    /api/icu/emergency-queue       # Patients ranked by risk score
POST   /api/icu/predict/:patientId    # Trigger AI risk prediction
```

#### Allocation payload
```json
POST /api/icu/allocate
{
  "patientId": "uuid",
  "resourceType": "ICU_BED",   // or "VENTILATOR"
  "reason": "Respiratory failure"
}
```

---

### AI Risk Intelligence

```bash
POST /api/ai/predict              # Predict mortality risk
GET  /api/ai/health               # AI service health check
```

#### Prediction payload
```json
POST /api/ai/predict
{
  "heart_rate": 130,
  "systolic_bp": 75,
  "spo2": 85,
  "gcs_score": 7,
  "is_ventilated": true
}
```
#### Response
```json
{
  "risk_score": 89,
  "risk_level": "critical",
  "recommended_action": "Immediate ICU admission required",
  "contributing_factors": ["Critical heart rate", "Hypotension", "Severe hypoxemia"],
  "confidence": 0.91
}
```

---

### Audit Logs

```bash
GET /api/audit/logs                          # Filterable audit log list
GET /api/audit/entity/:entity/:entityId      # Timeline for specific record
```

---

### Notifications

```bash
GET   /api/notifications           # Get user notifications
PATCH /api/notifications/read      # Mark as read
```

---

### Simulation (Hackathon Demo)

```bash
POST /api/simulation/mass-casualty   # Trigger MCI with N synthetic patients
POST /api/simulation/icu-overload    # Simulate capacity overload
POST /api/simulation/alert-storm     # Trigger N emergency alerts
```

```json
POST /api/simulation/mass-casualty
{
  "patientCount": 15,
  "scenario": "critical"   // "critical" | "mixed" | "moderate"
}
```

---

## ⚡ WebSocket Events

Connect with Socket.IO and authenticate via `auth.token`:

```js
const socket = io('http://localhost:4000', {
  auth: { token: '<access_token>' }
});
```

### Real-time Events
| Event | Description |
|-------|-------------|
| `patient:updated` | EHR record changed |
| `icu:allocated` | ICU resource assigned |
| `icu:released` | Resource freed |
| `emergency:alert` | Emergency alert fired |
| `ai:risk_escalation` | Patient risk went critical |
| `icu:occupancy_update` | Bed/vent count changed |
| `notification:new` | Incoming notification |
| `simulation:event` | Simulation scenario event |

### Rooms
- `role:doctor`, `role:nurse`, `role:admin`, `role:lab_technician`
- `user:<userId>` — private user channel
- `emergency:ops` — doctors + admins only

---

## 🛡️ Security Features
- JWT access tokens (15min) + refresh token rotation (7 days)
- bcrypt password hashing (cost factor 12)
- Role-based access control (RBAC) on every route
- Helmet HTTP security headers
- Rate limiting (500 req/15min global, 20/15min for auth)
- Zod input validation on all request bodies
- SQL injection prevention via Prisma parameterized queries
- Secure HttpOnly cookies for tokens

---

## 🔧 Database Schema

11 Prisma models: `users`, `patients`, `patient_versions`, `vitals`, `diagnoses`, `medications`, `lab_reports`, `allergies`, `icu_resources`, `allocations`, `audit_logs`, `alerts`, `notifications`

Key design decisions:
- **Optimistic concurrency**: `version` field on `patients` prevents stale writes
- **Immutable snapshots**: `patient_versions` preserve full history
- **Row-level locking**: `SELECT FOR UPDATE SKIP LOCKED` for concurrent ICU allocation
- **Indexed queries**: All high-traffic columns indexed for performance