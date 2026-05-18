Build a production-grade backend system for an AI-powered Critical Care Intelligence Platform called “PulseGrid AI”.

The backend should solve these healthcare problems:

1. Concurrent-safe EHR updates
2. Real-time ICU and ventilator allocation
3. AI-powered mortality risk prediction
4. Dynamic emergency resource reallocation
5. Full audit trail and medical consistency
6. Role-based healthcare workflows
7. Real-time synchronization across dashboards

The backend must feel like a scalable enterprise healthcare infrastructure system, not a simple CRUD application.

Tech Requirements:

* Node.js
* Express.js
* PostgreSQL
* Redis
* Socket.IO
* Prisma ORM
* JWT Authentication
* Docker + Docker Compose
* Monorepo architecture
* Modular service structure
* REST APIs + realtime events

The project structure should be:

server/
src/
modules/
auth/
users/
patients/
ehr/
icu/
ai/
audit/
websocket/
notifications/
simulation/
middleware/
config/
utils/
db/
routes/
services/
events/
queues/
validators/
prisma/
docker/
scripts/

The backend should include the following architectural principles:

1. Modular service-oriented architecture
2. Event-driven realtime communication
3. Concurrent-safe resource allocation
4. Version-controlled EHR records
5. Immutable audit logs
6. RBAC enforcement
7. AI inference integration
8. Transaction-safe operations
9. WebSocket synchronization
10. Dockerized infrastructure

Use Docker Compose to automatically start:

* PostgreSQL
* Redis
* Backend API server
* AI inference service
* PgAdmin
* RedisInsight

Create a complete docker-compose.yml setup.

Use environment variables for:

* database URLs
* JWT secrets
* Redis URLs
* AI service URLs

Backend Requirements:

1. Authentication & RBAC
   Implement:

* JWT authentication
* refresh tokens
* bcrypt password hashing
* role-based middleware

Roles:

* doctor
* nurse
* admin
* lab_technician

RBAC should strictly restrict:

* EHR edits
* allocation permissions
* audit visibility
* administrative actions

2. EHR System

Build a concurrent-safe EHR system.

Features:

* patient registration
* patient records
* diagnosis
* vitals
* medications
* lab reports
* allergies
* timeline history
* realtime synchronization

Implement optimistic concurrency control.

Each patient record must contain:

* version number
* updatedAt timestamp

When updates happen:

* validate version
* reject stale writes
* prevent accidental overwrites
* generate conflict events

Every update must:

* create version snapshots
* append immutable audit logs
* preserve historical state

Build APIs for:

* create patient
* update EHR
* get patient timeline
* get version history
* rollback version
* fetch audit logs

3. ICU Resource Allocation Engine

Build a dynamic ICU allocation system.

Resources:

* ICU beds
* ventilators

Features:

* concurrent allocation handling
* priority queues
* emergency escalation
* dynamic reassignment
* realtime occupancy tracking

The allocation system must:

* prevent duplicate allocations
* use PostgreSQL transactions
* use row-level locking
* support high concurrency

Implement:
SELECT FOR UPDATE
during allocation operations.

Priority should depend on:

* AI risk score
* patient severity
* vitals instability
* emergency score

Build APIs for:

* allocate ICU bed
* release ICU resource
* reassign resource
* get ICU occupancy
* get emergency queue

4. AI Risk Intelligence Integration

Create a dedicated AI service.

Use:

* FastAPI
* Python
* XGBoost model serving

The AI service should:

* load trained mortality prediction model
* expose REST inference APIs
* accept patient EHR features
* return risk score + severity category

Build:
POST /predict-risk

Expected response:
{
"risk_score": 89,
"risk_level": "critical",
"recommended_action": "Immediate ICU Required"
}

Integrate AI predictions into:

* ICU prioritization
* emergency alerts
* realtime dashboards
* escalation workflows

5. Audit Logging System

Every system action must generate immutable audit logs.

Track:

* who changed what
* previous value
* new value
* timestamps
* IP metadata
* role information

Audit logs should support:

* filtering
* timeline replay
* traceability

6. WebSocket Infrastructure

Use Socket.IO + Redis Pub/Sub.

Realtime events:

* patient updates
* ICU allocation changes
* emergency alerts
* AI risk escalations
* resource reassignments
* dashboard synchronization

Implement rooms/channels for:

* doctors
* nurses
* admins
* emergency operations

7. Emergency Simulation Engine

Build a simulation module for hackathon demos.

Simulate:

* mass casualty events
* sudden ICU overload
* multiple concurrent patient arrivals
* emergency reallocations
* realtime alert storms

The simulation should:

* generate synthetic patients
* trigger AI predictions
* stress-test allocation logic
* broadcast realtime updates

8. Database Design

Use Prisma ORM.

Create models for:

* users
* patients
* patient_versions
* ICU_resources
* allocations
* audit_logs
* alerts
* vitals
* diagnoses
* medications
* lab_reports

Ensure:

* relational integrity
* indexing
* transactional safety
* optimized queries

9. Notification System

Implement:

* critical risk alerts
* escalation notifications
* emergency broadcasts
* ICU assignment notifications

Notification types:

* realtime websocket
* persisted notifications

10. API Standards

Use:

* controller/service/repository pattern
* centralized error handling
* validation middleware
* zod or joi validation
* structured API responses

Standard response format:
{
"success": true,
"message": "",
"data": {}
}

11. Security Requirements

Implement:

* helmet
* rate limiting
* CORS
* secure cookies
* input sanitization
* SQL injection prevention
* JWT expiration handling

12. Logging & Monitoring

Add:

* Winston or Pino logging
* request logging
* error tracing
* performance metrics

13. Seed Data

Create realistic seed scripts for:

* patients
* ICU beds
* ventilators
* doctors
* nurses
* emergencies

14. Deliverables

Generate:

* complete backend architecture
* Docker setup
* Prisma schema
* modular folder structure
* API routes
* middleware
* websocket infrastructure
* AI service integration
* README documentation
* environment setup
* seed scripts
* sample APIs
* concurrency-safe allocation logic
* EHR versioning implementation

The backend should feel like:
“Production-grade AI healthcare infrastructure capable of handling realtime critical care coordination under emergency conditions.”

The generated system should prioritize:

* architecture quality
* concurrency correctness
* realtime synchronization
* scalability
* hackathon demo readiness
* clean modular engineering
* enterprise-grade backend design
