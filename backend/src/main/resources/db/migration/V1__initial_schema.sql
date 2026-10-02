-- AegisCloud Database Schema
-- Migration V1: Initial schema creation
-- Uses PostgreSQL 16 features

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================================================
-- USERS TABLE
-- ==================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    role        VARCHAR(50)  NOT NULL CHECK (role IN ('ADMIN', 'DEVELOPER', 'VIEWER')),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- PROJECTS TABLE
-- ==================================================
CREATE TABLE projects (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  VARCHAR(100) NOT NULL,
    description           TEXT,
    kubernetes_namespace  VARCHAR(100),
    owner_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_active             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- APPLICATIONS TABLE
-- ==================================================
CREATE TABLE applications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- MICROSERVICES TABLE
-- ==================================================
CREATE TABLE microservices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id      UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    container_port      INTEGER NOT NULL,
    service_port        INTEGER NOT NULL,
    service_type        VARCHAR(50) NOT NULL DEFAULT 'ClusterIP'
                        CHECK (service_type IN ('ClusterIP', 'NodePort', 'LoadBalancer')),
    replicas            INTEGER NOT NULL DEFAULT 1,
    health_check_path   VARCHAR(255) DEFAULT '/health',
    health_check_port   INTEGER,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- DOCKER IMAGES TABLE
-- ==================================================
CREATE TABLE docker_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microservice_id UUID REFERENCES microservices(id) ON DELETE SET NULL,
    registry        VARCHAR(255) NOT NULL,
    repository      VARCHAR(255) NOT NULL,
    image_name      VARCHAR(255) NOT NULL,
    tag             VARCHAR(100) NOT NULL,
    full_image_url  VARCHAR(500) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- RESOURCE CONFIGURATIONS TABLE
-- ==================================================
CREATE TABLE resource_configurations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microservice_id UUID NOT NULL UNIQUE REFERENCES microservices(id) ON DELETE CASCADE,
    cpu_request     VARCHAR(20) NOT NULL DEFAULT '100m',
    cpu_limit       VARCHAR(20) NOT NULL DEFAULT '500m',
    memory_request  VARCHAR(20) NOT NULL DEFAULT '128Mi',
    memory_limit    VARCHAR(20) NOT NULL DEFAULT '512Mi',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- SCALING CONFIGURATIONS TABLE
-- ==================================================
CREATE TABLE scaling_configurations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microservice_id         UUID NOT NULL UNIQUE REFERENCES microservices(id) ON DELETE CASCADE,
    min_replicas            INTEGER NOT NULL DEFAULT 1,
    max_replicas            INTEGER NOT NULL DEFAULT 10,
    cpu_target_percentage   INTEGER DEFAULT 70,
    memory_target_percentage INTEGER,
    hpa_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- ENVIRONMENT VARIABLES TABLE
-- ==================================================
CREATE TABLE environment_variables (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microservice_id UUID NOT NULL REFERENCES microservices(id) ON DELETE CASCADE,
    env_key         VARCHAR(255) NOT NULL,
    env_value       TEXT,
    is_secret       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- SECRET REFERENCES TABLE
-- ==================================================
CREATE TABLE secret_references (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microservice_id UUID NOT NULL REFERENCES microservices(id) ON DELETE CASCADE,
    secret_name     VARCHAR(255) NOT NULL,
    secret_key      VARCHAR(255) NOT NULL,
    env_var_name    VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- DEPLOYMENTS TABLE
-- ==================================================
CREATE TABLE deployments (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    microservice_id                 UUID NOT NULL REFERENCES microservices(id) ON DELETE RESTRICT,
    docker_image_id                 UUID REFERENCES docker_images(id) ON DELETE SET NULL,
    version                         INTEGER NOT NULL,
    status                          VARCHAR(50) NOT NULL
                                    CHECK (status IN ('PENDING', 'DEPLOYING', 'RUNNING', 'FAILED', 'DEGRADED', 'STOPPED')),
    kubernetes_namespace            VARCHAR(100) NOT NULL,
    kubernetes_deployment_name      VARCHAR(255) NOT NULL,
    kubernetes_service_name         VARCHAR(255),
    kubernetes_resource_version     VARCHAR(100),
    replicas_desired                INTEGER,
    replicas_ready                  INTEGER,
    deployment_message              TEXT,
    error_message                   TEXT,
    deployed_by                     UUID REFERENCES users(id) ON DELETE SET NULL,
    deployed_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- DEPLOYMENT VERSIONS TABLE
-- ==================================================
CREATE TABLE deployment_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id       UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    microservice_id     UUID NOT NULL REFERENCES microservices(id) ON DELETE RESTRICT,
    version_number      INTEGER NOT NULL,
    docker_image_url    VARCHAR(500) NOT NULL,
    kubernetes_revision VARCHAR(100),
    replicas            INTEGER,
    cpu_request         VARCHAR(20),
    memory_request      VARCHAR(20),
    status              VARCHAR(50),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- INCIDENTS TABLE
-- ==================================================
CREATE TABLE incidents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_ref    VARCHAR(50) UNIQUE NOT NULL,
    microservice_id UUID REFERENCES microservices(id) ON DELETE SET NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    severity        VARCHAR(50) NOT NULL
                    CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL')),
    status          VARCHAR(50) NOT NULL
                    CHECK (status IN ('ACTIVE', 'INVESTIGATING', 'RESOLVED', 'CLOSED')),
    detected_at     TIMESTAMPTZ NOT NULL,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- INCIDENT EVENTS TABLE
-- ==================================================
CREATE TABLE incident_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    event_type  VARCHAR(100) NOT NULL,
    message     TEXT,
    evidence    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- AUDIT LOGS TABLE
-- ==================================================
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email      VARCHAR(255) NOT NULL,
    action          VARCHAR(100) NOT NULL,
    resource_type   VARCHAR(100),
    resource_id     VARCHAR(255),
    resource_name   VARCHAR(255),
    project_id      UUID,
    request_details JSONB,
    result          VARCHAR(50) CHECK (result IN ('SUCCESS', 'FAILURE')),
    error_message   TEXT,
    ip_address      VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==================================================
-- INDEXES
-- ==================================================
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_applications_project_id ON applications(project_id);
CREATE INDEX idx_microservices_application_id ON microservices(application_id);
CREATE INDEX idx_docker_images_microservice_id ON docker_images(microservice_id);
CREATE INDEX idx_deployments_microservice_id ON deployments(microservice_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployment_versions_deployment_id ON deployment_versions(deployment_id);
CREATE INDEX idx_incidents_microservice_id ON incidents(microservice_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incident_events_incident_id ON incident_events(incident_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
