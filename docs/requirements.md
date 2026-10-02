# AegisCloud — Requirements

## 1. Project Objective

Provide a single, unified control plane that allows developer teams to register, configure, deploy, manage, monitor, and intelligently heal Dockerized microservices running on Kubernetes clusters without requiring deep Kubernetes expertise.

## 2. Real-World Problem

Modern microservice architectures on Kubernetes require teams to:
- Manually write and maintain complex YAML manifests
- Configure resource limits, health probes, and networking by hand
- Monitor across multiple dashboards (Kubernetes, Prometheus, Grafana)
- Diagnose and recover from failures with limited tooling
- Manually implement scaling, rollback, and self-healing strategies

This creates operational burden, increases MTTR (mean time to recovery), and requires specialized DevOps expertise.

## 3. Solution

AegisCloud provides:
- A web UI to register and configure microservices declaratively
- Automated Kubernetes manifest generation and deployment
- Real-time monitoring via Prometheus integration
- Log access via Loki integration
- Intelligent incident detection and root cause analysis
- AI-assisted remediation recommendations
- One-click rollback, scaling, and restart operations

## 4. User Roles

| Role | Access Level |
|------|-------------|
| ADMIN | Full platform access, user management, all projects |
| DEVELOPER | Create/manage own projects, applications, deployments |
| VIEWER | Read-only access to assigned projects |

## 5. Functional Requirements

### 5.1 Authentication
- FR-AUTH-01: Users can register with email and password
- FR-AUTH-02: Users can log in and receive a JWT token
- FR-AUTH-03: JWT tokens expire (configurable, default 24h)
- FR-AUTH-04: Passwords are hashed using BCrypt
- FR-AUTH-05: Protected endpoints require valid JWT
- FR-AUTH-06: Role-based access control is enforced

### 5.2 Project Management
- FR-PROJ-01: Users can create projects with name and description
- FR-PROJ-02: Users can list, view, update, and delete their projects
- FR-PROJ-03: Projects are isolated per user/team

### 5.3 Application Management
- FR-APP-01: Users can create applications within projects
- FR-APP-02: Applications contain one or more microservices
- FR-APP-03: Applications can be listed, viewed, updated, deleted

### 5.4 Docker Image Registration
- FR-IMG-01: Users can register Docker image metadata (registry, repo, name, tag)
- FR-IMG-02: Image URL is constructed and stored
- FR-IMG-03: Image metadata is stored in PostgreSQL

### 5.5 Microservice Configuration
- FR-SVC-01: Users can configure microservice name, image, ports, replicas
- FR-SVC-02: Users can configure CPU/memory requests and limits
- FR-SVC-03: Users can define environment variables
- FR-SVC-04: Users can reference Kubernetes secrets
- FR-SVC-05: Users can configure health check paths

### 5.6 Kubernetes Deployment
- FR-DEP-01: Users can deploy a configured microservice to Kubernetes
- FR-DEP-02: System creates namespace, Deployment, Service, ConfigMap, Secret, Ingress as needed
- FR-DEP-03: System returns real Kubernetes status (not faked)
- FR-DEP-04: Deployment status is stored in PostgreSQL
- FR-DEP-05: Deployment failures are reported with real Kubernetes error messages

### 5.7 Deployment Management
- FR-MGT-01: Users can view deployment status, pods, and services
- FR-MGT-02: Users can restart deployments
- FR-MGT-03: Users can redeploy with updated configuration
- FR-MGT-04: Users can scale deployments (replica count)
- FR-MGT-05: Users can delete deployments
- FR-MGT-06: Deployment history is tracked per microservice

### 5.8 Rollback
- FR-RBK-01: Deployment versions are tracked
- FR-RBK-02: Users can roll back to any previous version
- FR-RBK-03: Rollback uses Kubernetes rollout mechanisms where possible

### 5.9 Monitoring
- FR-MON-01: CPU and memory metrics are available per pod/service
- FR-MON-02: Request rate, error rate, and latency are available
- FR-MON-03: Pod count and restart count are available
- FR-MON-04: Metrics are sourced from Prometheus (not stored in PostgreSQL)

### 5.10 Logging
- FR-LOG-01: Pod and application logs are accessible via UI
- FR-LOG-02: Logs can be filtered by time range and service
- FR-LOG-03: Log search is supported
- FR-LOG-04: Logs are sourced from Loki (not stored in PostgreSQL)

### 5.11 Incident Detection
- FR-INC-01: System detects incidents based on metric thresholds
- FR-INC-02: Incidents have severity levels (INFO, WARNING, HIGH, CRITICAL)
- FR-INC-03: Incidents are tracked with timeline events
- FR-INC-04: Users are notified of active incidents

### 5.12 Root Cause Analysis
- FR-RCA-01: System provides possible root causes for incidents
- FR-RCA-02: RCA is backed by evidence (metrics, logs, events)
- FR-RCA-03: AI-generated suggestions are clearly marked as suggestions

### 5.13 Audit Logging
- FR-AUD-01: All destructive and deployment actions are logged
- FR-AUD-02: Audit logs include user, action, resource, timestamp, result
- FR-AUD-03: Audit logs are immutable

## 6. Non-Functional Requirements

| # | Requirement |
|---|-------------|
| NFR-01 | API response time < 500ms for CRUD operations |
| NFR-02 | Kubernetes operations may be async with status polling |
| NFR-03 | JWT tokens expire and are not stored server-side (stateless) |
| NFR-04 | Passwords stored as BCrypt hashes |
| NFR-05 | No sensitive data in logs |
| NFR-06 | All configuration via environment variables |
| NFR-07 | Code coverage target: 70% minimum for backend services |
| NFR-08 | Frontend must be responsive (desktop and tablet) |
| NFR-09 | System must handle Kubernetes unavailability gracefully |
| NFR-10 | Audit log retention: minimum 90 days |

## 7. Out of Scope (Initial MVP)

- Multi-tenant billing
- GitOps workflows
- Helm chart management
- Custom Kubernetes operators
- Mobile application
- SSO / LDAP (may be added later)
