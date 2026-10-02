# AegisCloud

**Kubernetes-based application deployment, management, and intelligent reliability platform.**

A centralized control plane for deploying and managing Dockerized microservices on Kubernetes — with real-time reliability scoring, SLO tracking, self-healing, chaos engineering, and AI-powered root cause analysis.

---

## Architecture

```
User Browser
     │
     ▼
React Frontend (web/)          ← port 5173
     │
     ▼  HTTP REST + Bearer JWT
Spring Boot Control Plane      ← port 8081
(control-plane/)
     │
     ├── PostgreSQL (port 5432) ← persistent state
     ├── Redis      (port 6379) ← caching & coordination
     └── Kubernetes API         ← Docker Desktop / Minikube / EKS
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 6, Vite 8 |
| Backend | Java 17, Spring Boot 3.5.3 |
| Auth | Spring Security + JJWT 0.12.6 (HS256) |
| Database | PostgreSQL 16, Flyway migrations |
| Cache | Redis 7 (optional — graceful degradation) |
| K8s client | Fabric8 Kubernetes Client 7.8.0 |
| API docs | SpringDoc OpenAPI (Swagger UI at `/swagger`) |
| Containers | Docker, Docker Compose |

---

## Prerequisites

| Tool | Minimum Version | Check |
|---|---|---|
| **Docker Desktop** | Latest | `docker version` |
| **Java** | 17 | `java -version` |
| **Node.js** | 18 | `node --version` |
| **Maven** | via wrapper | no install needed |

Docker Desktop must be running **with Kubernetes enabled** for deployment features.

---

## Quick Start

### 1 — Open Docker Desktop

Start Docker Desktop from the Start Menu. Wait until the whale icon in the tray turns green.

### 2 — Start the infrastructure

```powershell
cd C:\Users\gaura\.gemini\antigravity-ide\scratch\aegiscloud

# Wipe old volumes (clean slate) and start PostgreSQL + Redis
docker compose down -v --remove-orphans
docker compose up -d

# Confirm both containers are healthy
docker ps
```

Expected:
```
aegiscloud-postgres   Up (healthy)
aegiscloud-redis      Up (healthy)
```

### 3 — Start the backend control-plane

```powershell
cd control-plane
.\mvnw.cmd spring-boot:run
```

The backend:
- Runs Flyway migrations (creates 23 tables)
- Seeds demo data (clusters, services, SLOs, alerts, etc.)
- Starts on **http://localhost:8081**

Health check: http://localhost:8081/actuator/health  
Swagger UI:   http://localhost:8081/swagger

### 4 — Start the frontend

In a separate terminal:

```powershell
cd web
npm run dev
```

Opens on **http://localhost:5173**

---

## Default Login

| Field | Value |
|---|---|
| Email | `admin@aegiscloud.local` |
| Password | `changeme123` |

Or click **"Create an organisation"** to register a new account.

---

## Environment Variables

All have sensible defaults for local development. Override as needed:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://aegiscloud:aegiscloud@localhost:5432/aegiscloud?sslmode=disable` | PostgreSQL connection URL |
| `REDIS_ADDR` | *(empty — Redis disabled)* | Redis address e.g. `localhost:6379` |
| `PORT` | `8081` | Backend HTTP port |
| `AEGISCLOUD_JWT_SECRET` | `dev-secret-change-me` | JWT signing key (min 32 bytes in prod) |
| `AEGISCLOUD_ADMIN_EMAIL` | `admin@aegiscloud.local` | Seeded admin email |
| `AEGISCLOUD_ADMIN_PASSWORD` | `changeme123` | Seeded admin password |
| `AEGISCLOUD_WEB_ORIGIN` | `http://localhost:5173` | CORS allowed origin |
| `VITE_API_URL` | `http://localhost:8081` | Frontend → backend URL |

---

## API Endpoints

### Authentication
```
POST /api/v1/auth/signup         Create organisation + admin
POST /api/v1/auth/login          Get bearer token
GET  /api/v1/auth/me             Current user info
GET  /api/v1/auth/signup/enabled Whether self-signup is on
POST /api/v1/auth/users          Invite user (ADMIN only)
```

### Clusters
```
GET    /api/v1/clusters          List clusters
POST   /api/v1/clusters          Register cluster
GET    /api/v1/clusters/{id}     Get cluster
DELETE /api/v1/clusters/{id}     Remove cluster
GET    /api/v1/clusters/{id}/connectivity  Test K8s connectivity
```

### Services & Deployments
```
GET  /api/v1/services            List microservices
POST /api/v1/services            Register service
GET  /api/v1/overview            Fleet overview dashboard data
GET  /api/v1/targets             Deployment targets
POST /api/v1/targets             Create deployment target
POST /api/v1/targets/{id}/deploy Deploy to Kubernetes
POST /api/v1/targets/{id}/scale  Scale replicas
POST /api/v1/targets/{id}/restart Restart pods
```

### Monitoring & Reliability
```
GET /api/v1/slos                 SLO list with error budgets
GET /api/v1/alerts               Active alerts
GET /api/v1/scaling              Scaling event history
GET /api/v1/healing              Self-healing event history
GET /api/v1/reliability/{id}     Reliability score breakdown
GET /api/v1/experiments          Chaos experiment history
```

### Diagnostics & AI
```
POST /api/v1/diagnostics         Run RCA on an incident
GET  /api/v1/graph               Service dependency graph
GET  /api/v1/optimization        Resource optimization advice
POST /api/v1/ai/analyze          AI-powered log analysis
```

Full interactive docs at **http://localhost:8081/swagger**

---

## Database Schema

The 23-table schema is managed entirely by Flyway (in `control-plane/src/main/resources/db/migration/`).

Key tables:
- `organization`, `app_user` — multi-tenant identity
- `cluster`, `service` — registered Kubernetes clusters and microservices
- `deployment_target` — service × cluster deployment configuration
- `slo`, `error_budget_snapshot` — SLO definitions and budget tracking
- `alert`, `alert_rule` — alerting
- `scaling_event`, `healing_event` — control plane history
- `evaluation_run` — chaos experiment results
- `rca_report` — root cause analysis results

---

## Project Structure

```
aegiscloud/
├── control-plane/          # Spring Boot backend (port 8081)
│   ├── src/main/java/io/aegiscloud/controlplane/
│   │   ├── auth/           # JWT, RBAC, user management
│   │   ├── config/         # Spring Security, CORS, DataSource, Redis
│   │   ├── domain/         # Core domain models
│   │   ├── engine/         # Reconciliation, scaling, healing engines
│   │   ├── eval/           # SLO evaluation, reliability scoring
│   │   ├── experiment/     # Chaos engineering
│   │   ├── graph/          # Service dependency discovery
│   │   ├── k8s/            # Kubernetes integration layer (Fabric8)
│   │   ├── optimize/       # Cost & resource optimization
│   │   ├── persistence/    # JPA entities & repositories
│   │   ├── rca/            # Root cause analysis engine
│   │   ├── seed/           # Demo data seeder
│   │   └── web/            # REST controllers
│   └── src/main/resources/
│       ├── application.yml          # Base config
│       ├── application-dev.yml      # Local dev overrides
│       └── db/migration/           # Flyway SQL migrations (V1-V5)
│
├── web/                    # React frontend (port 5173)
│   └── src/
│       ├── api/client.ts   # Typed API client (623 lines)
│       ├── components/     # Dashboard, Charts, LiveEvents, UI
│       └── pages/          # Overview, Clusters, Services, Reliability...
│
├── ai-service/             # Python FastAPI AI service (port 8090)
├── docker-compose.yml      # PostgreSQL + Redis
├── start-dev.ps1           # One-click startup script
└── docs/                   # Architecture, API, database docs
```

---

## Phase Status

| Phase | Description | Status |
|---|---|---|
| 1 | Architecture & Docs | ✅ Complete |
| 2 | Project Foundation | ✅ Complete |
| 3 | Authentication & RBAC | ✅ Complete |
| 4 | Project/Cluster Management | ✅ Complete |
| 5 | Service Management | ✅ Complete |
| 6 | Docker Image Registration | ✅ Complete |
| 7 | Microservice Configuration | ✅ Complete |
| 8 | Kubernetes Integration (Fabric8) | ✅ Complete |
| 9 | Automated Deployment | ✅ Complete |
| 10 | Deployment Management | ✅ Complete |
| 11 | Rollback | ✅ Complete |
| 12 | Service Discovery / Graph | ✅ Complete |
| 13 | SLO Monitoring | ✅ Complete |
| 14 | Log Management | 🔄 In Progress |
| 15 | Distributed Tracing | 🔄 In Progress |
| 16 | Auto Scaling (HPA) | ✅ Complete |
| 17 | Self Healing | ✅ Complete |
| 18 | Reliability Dashboard | ✅ Complete |
| 19 | Incident / Alert Detection | ✅ Complete |
| 20 | Root Cause Analysis | ✅ Complete |
| 21 | AI Service (FastAPI) | ✅ Complete |
| 22 | Automated Remediation | ✅ Complete |
| 23 | Chaos Engineering | ✅ Complete |
| 24 | Cost Optimization | ✅ Complete |
| 25-29 | Capacity, Multi-cloud, CI/CD | 🔜 Planned |

---

## Troubleshooting

### Backend fails to connect to PostgreSQL
Ensure Docker Desktop is running and containers are healthy:
```powershell
docker ps
docker logs aegiscloud-postgres
```

Wipe and restart:
```powershell
docker compose down -v
docker compose up -d
```

### Port 8080 conflict with Kubernetes ingress
The backend runs on **8081** by default for exactly this reason.

### "Could not reach the control plane" in browser
Check that the backend is running on port 8081 and that CORS is allowing `http://localhost:5173`.

### JWT `WARN: AEGISCLOUD_JWT_SECRET is N bytes`
This warning appears for the dev secret. Safe to ignore locally. Set a proper secret in production.
