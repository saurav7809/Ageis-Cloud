# AegisCloud — Development Roadmap

## Phase Overview

| Phase | Name | Status | Priority |
|-------|------|--------|----------|
| 1 | Architecture & Documentation | ✅ Done | Foundation |
| 2 | Project Foundation | 🔄 In Progress | Foundation |
| 3 | Authentication | ⬜ Planned | MVP |
| 4 | Project Management | ⬜ Planned | MVP |
| 5 | Application Management | ⬜ Planned | MVP |
| 6 | Docker Image Registration | ⬜ Planned | MVP |
| 7 | Microservice Configuration | ⬜ Planned | MVP |
| 8 | Kubernetes Integration | ⬜ Planned | MVP |
| 9 | Automated Deployment | ⬜ Planned | MVP |
| 10 | Deployment Management | ⬜ Planned | MVP |
| 11 | Rollback | ⬜ Planned | MVP |
| 12 | Service Discovery | ⬜ Planned | Core |
| 13 | Monitoring (Prometheus) | ⬜ Planned | Core |
| 14 | Log Management (Loki) | ⬜ Planned | Core |
| 15 | Distributed Tracing | ⬜ Planned | Core |
| 16 | Auto Scaling (HPA) | ⬜ Planned | Advanced |
| 17 | Self Healing | ⬜ Planned | Advanced |
| 18 | Reliability Dashboard | ⬜ Planned | Advanced |
| 19 | Incident Detection | ⬜ Planned | Advanced |
| 20 | Root Cause Analysis | ⬜ Planned | Intelligence |
| 21 | AI Service | ⬜ Planned | Intelligence |
| 22 | Automated Remediation | ⬜ Planned | Intelligence |
| 23 | Chaos Engineering | ⬜ Planned | Expert |
| 24 | Cost Optimization | ⬜ Planned | Expert |
| 25 | Capacity Planning | ⬜ Planned | Expert |
| 26 | Multi-Cloud | ⬜ Planned | Expert |
| 27 | Security Hardening | ⬜ Planned | Expert |
| 28 | CI/CD Pipeline | ⬜ Planned | DevOps |
| 29 | Final Dashboard Polish | ⬜ Planned | Final |

---

## MVP Definition

The following phases constitute the MVP that must work before advancing to advanced features:

**Phases 1–11** = MVP

MVP must support:
```
Login → Create Project → Create Application →
Register Docker Image → Configure Microservice →
Deploy to Kubernetes (real cluster) →
View Deployment → View Pods →
Restart → Redeploy → Scale → Update Image → Rollback
```

---

## Phase Detail

### Phase 3 — Authentication
- Registration endpoint
- Login endpoint (returns JWT)
- JWT validation middleware
- Password hashing (BCrypt)
- Refresh token strategy
- Frontend login/register pages
- Protected route guard
- Role-based access

### Phase 4–5 — Project & Application Management
- Full CRUD for projects and applications
- Ownership model
- Project-scoped application listing

### Phase 6 — Docker Image Registration
- Image metadata storage
- Full image URL construction
- Support for multiple registries (docker.io, ghcr.io, ECR, etc.)

### Phase 7 — Microservice Configuration
- Service definition with ports, replicas, health checks
- Resource configuration (CPU/memory)
- Environment variable management
- Secret references

### Phase 8 — Kubernetes Integration
- fabric8 client setup
- Namespace management
- Deployment creation/update/delete
- Service creation
- ConfigMap creation
- Status polling
- Pod listing

### Phase 9 — Automated Deployment
- Full deploy pipeline orchestration
- Async status updates
- Real K8s status reporting
- Audit logging of deployments

### Phase 10–11 — Management & Rollback
- Restart, scale, redeploy operations
- Version tracking
- Rollback to previous version

### Phase 13 — Monitoring
- Prometheus scraping setup
- Spring Boot metrics proxy endpoints
- Frontend charts (CPU, memory, requests, errors)

### Phase 21 — AI Service
- Python FastAPI service
- /analyze-incident endpoint
- /recommend-action endpoint
- /analyze-logs endpoint
- Integration with Spring Boot

---

## Technology Versions (Locked)

| Technology | Version |
|-----------|---------|
| Java | 21 (LTS) |
| Spring Boot | 3.2.x |
| React | 18.x |
| TypeScript | 5.x |
| Vite | 5.x |
| Tailwind CSS | 3.x |
| PostgreSQL | 16.x |
| Redis | 7.x |
| fabric8 K8s client | 6.x |
| Python | 3.11+ |
| FastAPI | 0.109+ |

---

## Estimated Timeline

| Tier | Phases | Estimated Effort |
|------|--------|-----------------|
| Foundation (MVP) | 1-11 | 4-6 weeks |
| Core Features | 12-15 | 2-3 weeks |
| Advanced | 16-19 | 2-3 weeks |
| Intelligence | 20-22 | 2-3 weeks |
| Expert & DevOps | 23-29 | 3-4 weeks |

Total: ~15-20 weeks for full platform
