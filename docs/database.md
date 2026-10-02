# AegisCloud — Database Design

## 1. Overview

AegisCloud uses PostgreSQL as its persistent metadata store. All application state, user data, configuration, deployment history, incidents, and audit logs are stored here.

**Important**: Prometheus, Loki, and Tempo are used for metrics, logs, and traces respectively. PostgreSQL does NOT store high-frequency time-series data.

---

## 2. Entity Relationship Summary

```
User (1)-----(N) Project
Project (1)----(N) Application
Application (1)---(N) Microservice
Microservice (1)--(N) DockerImage
Microservice (1)--(N) Deployment
Deployment (1)----(N) DeploymentVersion
Microservice (1)--(N) EnvironmentVariable
Microservice (1)--(N) SecretReference
Microservice (1)--(1) ResourceConfiguration
Microservice (1)--(1) ScalingConfiguration
Deployment (1)----(N) DeploymentEvent
Incident (1)------(N) IncidentEvent
User (1)----------(N) AuditLog
Project (1)--------(N) AuditLog
```

---

## 3. Entities and Schema

### 3.1 users

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| first_name | VARCHAR(100) | NOT NULL |
| last_name | VARCHAR(100) | NOT NULL |
| role | VARCHAR(50) | NOT NULL (ADMIN/DEVELOPER/VIEWER) |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 3.2 projects

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL |
| description | TEXT | |
| kubernetes_namespace | VARCHAR(100) | |
| owner_id | UUID | FK → users.id |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 3.3 applications

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| project_id | UUID | FK → projects.id, NOT NULL |
| name | VARCHAR(100) | NOT NULL |
| description | TEXT | |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 3.4 microservices

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| application_id | UUID | FK → applications.id, NOT NULL |
| name | VARCHAR(100) | NOT NULL |
| description | TEXT | |
| container_port | INTEGER | NOT NULL |
| service_port | INTEGER | NOT NULL |
| service_type | VARCHAR(50) | DEFAULT 'ClusterIP' |
| replicas | INTEGER | DEFAULT 1 |
| health_check_path | VARCHAR(255) | DEFAULT '/health' |
| health_check_port | INTEGER | |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 3.5 docker_images

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| microservice_id | UUID | FK → microservices.id |
| registry | VARCHAR(255) | NOT NULL (e.g. docker.io) |
| repository | VARCHAR(255) | NOT NULL (e.g. mycompany) |
| image_name | VARCHAR(255) | NOT NULL |
| tag | VARCHAR(100) | NOT NULL |
| full_image_url | VARCHAR(500) | NOT NULL (constructed) |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 3.6 resource_configurations

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| microservice_id | UUID | FK → microservices.id, UNIQUE |
| cpu_request | VARCHAR(20) | DEFAULT '100m' |
| cpu_limit | VARCHAR(20) | DEFAULT '500m' |
| memory_request | VARCHAR(20) | DEFAULT '128Mi' |
| memory_limit | VARCHAR(20) | DEFAULT '512Mi' |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 3.7 scaling_configurations

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| microservice_id | UUID | FK → microservices.id, UNIQUE |
| min_replicas | INTEGER | DEFAULT 1 |
| max_replicas | INTEGER | DEFAULT 10 |
| cpu_target_percentage | INTEGER | DEFAULT 70 |
| memory_target_percentage | INTEGER | |
| hpa_enabled | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 3.8 environment_variables

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| microservice_id | UUID | FK → microservices.id |
| env_key | VARCHAR(255) | NOT NULL |
| env_value | TEXT | |
| is_secret | BOOLEAN | DEFAULT false |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 3.9 secret_references

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| microservice_id | UUID | FK → microservices.id |
| secret_name | VARCHAR(255) | NOT NULL (K8s secret name) |
| secret_key | VARCHAR(255) | NOT NULL |
| env_var_name | VARCHAR(255) | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 3.10 deployments

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| microservice_id | UUID | FK → microservices.id |
| docker_image_id | UUID | FK → docker_images.id |
| version | INTEGER | NOT NULL |
| status | VARCHAR(50) | NOT NULL (PENDING/DEPLOYING/RUNNING/FAILED/DEGRADED/STOPPED) |
| kubernetes_namespace | VARCHAR(100) | NOT NULL |
| kubernetes_deployment_name | VARCHAR(255) | NOT NULL |
| kubernetes_service_name | VARCHAR(255) | |
| kubernetes_resource_version | VARCHAR(100) | |
| replicas_desired | INTEGER | |
| replicas_ready | INTEGER | |
| deployment_message | TEXT | |
| error_message | TEXT | |
| deployed_by | UUID | FK → users.id |
| deployed_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 3.11 deployment_versions

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| deployment_id | UUID | FK → deployments.id |
| microservice_id | UUID | FK → microservices.id |
| version_number | INTEGER | NOT NULL |
| docker_image_url | VARCHAR(500) | NOT NULL |
| kubernetes_revision | VARCHAR(100) | |
| replicas | INTEGER | |
| cpu_request | VARCHAR(20) | |
| memory_request | VARCHAR(20) | |
| status | VARCHAR(50) | |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 3.12 incidents

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| incident_ref | VARCHAR(50) | UNIQUE (e.g. INC-001) |
| microservice_id | UUID | FK → microservices.id |
| title | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| severity | VARCHAR(50) | NOT NULL (INFO/WARNING/HIGH/CRITICAL) |
| status | VARCHAR(50) | NOT NULL (ACTIVE/INVESTIGATING/RESOLVED/CLOSED) |
| detected_at | TIMESTAMPTZ | NOT NULL |
| resolved_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

### 3.13 incident_events

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| incident_id | UUID | FK → incidents.id |
| event_type | VARCHAR(100) | NOT NULL |
| message | TEXT | |
| evidence | JSONB | |
| created_at | TIMESTAMPTZ | DEFAULT now() |

### 3.14 audit_logs

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users.id |
| user_email | VARCHAR(255) | NOT NULL (denormalized for history) |
| action | VARCHAR(100) | NOT NULL |
| resource_type | VARCHAR(100) | |
| resource_id | VARCHAR(255) | |
| resource_name | VARCHAR(255) | |
| project_id | UUID | |
| request_details | JSONB | |
| result | VARCHAR(50) | (SUCCESS/FAILURE) |
| error_message | TEXT | |
| ip_address | VARCHAR(50) | |
| created_at | TIMESTAMPTZ | DEFAULT now() |

---

## 4. Indexes

```sql
-- Performance indexes
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_applications_project_id ON applications(project_id);
CREATE INDEX idx_microservices_application_id ON microservices(application_id);
CREATE INDEX idx_deployments_microservice_id ON deployments(microservice_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_incidents_microservice_id ON incidents(microservice_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
```

---

## 5. Migration Strategy

- Use Flyway for schema migrations
- Migrations are in `src/main/resources/db/migration/`
- Naming convention: `V{version}__{description}.sql`
- Example: `V1__create_users_table.sql`

---

## 6. Data Retention

| Table | Retention |
|-------|-----------|
| audit_logs | 90 days minimum |
| deployment_versions | Indefinite (needed for rollback) |
| incident_events | 180 days |
| Users/Projects/Apps | Indefinite while active |
