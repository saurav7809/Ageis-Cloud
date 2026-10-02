# AegisCloud — Architecture

## 1. Project Overview

AegisCloud is a centralized Kubernetes control plane that allows developers to:
- Register Dockerized microservices
- Configure them declaratively
- Deploy them to Kubernetes clusters
- Monitor, scale, heal, and analyze them through intelligent reliability features

## 2. Core Problem

Deploying and managing Dockerized microservices on Kubernetes requires developers to deal with:
- Docker image management
- Kubernetes Deployments, Services, ConfigMaps, Secrets, Ingress
- Resource (CPU/memory) configuration
- Networking and service discovery
- Monitoring and alerting
- Scaling and auto-recovery

AegisCloud abstracts this complexity into a single web-based control center.

## 3. High-Level Architecture

```
                    USER
                      |
                      v
              React + TypeScript
              (AegisCloud Frontend)
                      |
                   REST API
                      |
                      v
        Spring Boot Control Plane
        (AegisCloud Backend — Modular Monolith)
                      |
          +-----------+------------+
          |           |            |
          v           v            v
      PostgreSQL    Redis     Kubernetes API
      (Metadata)  (Cache/    (via fabric8 client)
                   Locks)         |
                                   v
                            Kubernetes Cluster
                                   |
                     +-------------+-------------+
                     |             |             |
                     v             v             v
                   Pods        Services       Ingress
                     |
                     v
              Docker Containers
```

## 4. Observability Architecture

```
Kubernetes Workloads
    |
    +--> Prometheus --------> Metrics (CPU, Memory, Requests)
    |
    +--> Loki --------------> Logs (Application, Pod)
    |
    +--> OpenTelemetry -----> Tempo -> Traces (Distributed)
    |
    v
AegisCloud Monitoring API (Spring Boot proxies queries)
    |
    v
React Dashboard (Charts, Log Viewer, Trace Explorer)
```

## 5. Intelligence Architecture

```
Metrics + Logs + Traces + Pod Events + Deployment Events
    |
    v
Incident Detection Engine (Spring Boot)
    |
    v
Root Cause Analysis Layer
    |
    +--> Rule-Based Analysis
    +--> AI Service (Python / FastAPI)
         |
         +--> /analyze-incident
         +--> /recommend-action
         +--> /analyze-logs
    |
    v
Recommendations (displayed to user)
    |
    v
[User Approves]
    |
    v
Automated Remediation (Scale / Restart / Rollback)
```

## 6. Backend Module Architecture

```
com.aegiscloud
│
├── config          — Spring beans, CORS, app configuration
├── security        — JWT filter, Spring Security config, RBAC
│
├── user            — Users, roles, profile management
├── project         — Project CRUD, ownership
├── application     — Applications within projects
├── service         — Microservice definitions within applications
├── deployment      — Deployment lifecycle, versioning
├── kubernetes      — Dedicated K8s integration layer (fabric8)
│
├── monitoring      — Prometheus integration, metrics proxy
├── logging         — Loki integration, log proxy
├── tracing         — OpenTelemetry/Tempo integration
│
├── scaling         — HPA configuration, scaling events
├── healing         — Self-healing detection and response
├── reliability     — Reliability metrics and SLO tracking
│
├── incident        — Incident lifecycle management
├── rca             — Root cause analysis engine
├── ai              — AI service integration client
│
├── chaos           — Chaos Mesh integration
├── optimization    — Cost and resource optimization
├── capacity        — Capacity planning
├── cloud           — Multi-cloud provider adapters
│
├── audit           — Audit logging
└── common          — Base entities, exceptions, API response
```

## 7. Data Flow — Application Deployment

```
User clicks DEPLOY
    |
    v
Frontend (POST /api/deployments)
    |
    v
DeploymentController
    |
    v
DeploymentService
    ├── Validate application config
    ├── Validate microservice config
    ├── Validate Docker image config
    |
    v
KubernetesService (integration layer)
    ├── createNamespace()
    ├── createConfigMap()    [if env vars]
    ├── createSecret()       [if secrets]
    ├── createDeployment()
    ├── createService()
    └── createIngress()      [if needed]
    |
    v
Kubernetes API Server
    |
    v
Kubernetes schedules pods
    |
    v
KubernetesService.getDeploymentStatus()
    |
    v
DeploymentService.storeDeploymentRecord()
    |
    v
AuditService.log(DEPLOY_APPLICATION, ...)
    |
    v
Response to Frontend (real K8s status)
```

## 8. Architectural Rules

| # | Rule |
|---|------|
| 1 | React NEVER directly accesses PostgreSQL |
| 2 | React NEVER directly communicates with Kubernetes |
| 3 | React communicates ONLY with Spring Boot REST APIs |
| 4 | Spring Boot is the control plane and brain |
| 5 | Kubernetes is the runtime environment |
| 6 | Kubernetes operations are ISOLATED in the `kubernetes` package |
| 7 | Kubernetes API logic is NEVER placed inside controllers |
| 8 | Backend is a MODULAR MONOLITH — not fragmented microservices |
| 9 | PostgreSQL stores AegisCloud metadata and state only |
| 10 | PostgreSQL is NOT a replacement for Prometheus, Loki, or Tempo |
| 11 | Redis is used for caching, temporary state, locks, coordination |
| 12 | No hard-coded passwords, JWT secrets, API keys, or credentials |
| 13 | All secrets via environment variables or secure config |
| 14 | Never fake Kubernetes deployment results |
| 15 | AI recommendations are clearly separated from confirmed facts |
| 16 | AI does NOT have unrestricted Kubernetes control |

## 9. Security Architecture

```
Frontend
    |
    v (JWT Bearer token in Authorization header)
Spring Security Filter Chain
    |
    +--> JwtAuthenticationFilter (validate token)
    +--> UserDetailsService (load user from DB)
    +--> SecurityContext (set authenticated user)
    |
    v
Method-level @PreAuthorize (RBAC)
    |
    +--> ROLE_ADMIN   — Full access
    +--> ROLE_DEVELOPER — Create/manage own resources
    +--> ROLE_VIEWER  — Read-only access
```

## 10. Local Development Architecture

```
Developer Machine
    |
    ├── Frontend (npm run dev)        → localhost:5173
    ├── Backend (./mvnw spring-boot:run) → localhost:8080
    ├── PostgreSQL (Docker Compose)   → localhost:5432
    ├── Redis (Docker Compose)        → localhost:6379
    └── Kubernetes (Docker Desktop)   → localhost (kubeconfig)
```
