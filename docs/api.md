# AegisCloud — API Reference

## 1. Conventions

- Base URL: `http://localhost:8080/api`
- All requests/responses use `application/json`
- Authentication: `Authorization: Bearer <JWT_TOKEN>` header
- Timestamps: ISO 8601 format (`2025-01-15T10:30:00Z`)
- IDs: UUID format

### Standard Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Email is required",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

---

## 2. Authentication APIs

### POST /api/auth/register
Register a new user.

**Request:**
```json
{
  "email": "developer@example.com",
  "password": "SecurePassword123!",
  "firstName": "Jane",
  "lastName": "Doe"
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "developer@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "role": "DEVELOPER"
  }
}
```

---

### POST /api/auth/login
Authenticate and receive JWT token.

**Request:**
```json
{
  "email": "developer@example.com",
  "password": "SecurePassword123!"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "user": {
      "id": "uuid",
      "email": "developer@example.com",
      "firstName": "Jane",
      "role": "DEVELOPER"
    }
  }
}
```

---

### GET /api/auth/me
Get current authenticated user profile.

**Headers:** `Authorization: Bearer <token>`

**Response: 200 OK**

---

## 3. Project APIs

### GET /api/projects
List all projects for authenticated user.

### POST /api/projects
Create a new project.

**Request:**
```json
{
  "name": "E-Commerce Platform",
  "description": "Microservice-based shopping application",
  "kubernetesNamespace": "ecommerce"
}
```

### GET /api/projects/{id}
Get project by ID.

### PUT /api/projects/{id}
Update project.

### DELETE /api/projects/{id}
Delete project (soft delete).

---

## 4. Application APIs

### GET /api/projects/{projectId}/applications
List applications in a project.

### POST /api/projects/{projectId}/applications
Create an application.

**Request:**
```json
{
  "name": "E-Commerce App",
  "description": "Main shopping application"
}
```

### GET /api/applications/{id}
Get application by ID.

### PUT /api/applications/{id}
Update application.

### DELETE /api/applications/{id}
Delete application.

---

## 5. Microservice APIs

### GET /api/applications/{applicationId}/services
List microservices in an application.

### POST /api/applications/{applicationId}/services
Create a microservice.

**Request:**
```json
{
  "name": "product-service",
  "description": "Product catalog service",
  "containerPort": 8081,
  "servicePort": 80,
  "serviceType": "ClusterIP",
  "replicas": 2,
  "healthCheckPath": "/actuator/health",
  "dockerImage": {
    "registry": "docker.io",
    "repository": "mycompany",
    "imageName": "product-service",
    "tag": "v1.0.0"
  },
  "resources": {
    "cpuRequest": "100m",
    "cpuLimit": "500m",
    "memoryRequest": "128Mi",
    "memoryLimit": "512Mi"
  },
  "environmentVariables": [
    { "key": "SPRING_PROFILES_ACTIVE", "value": "prod" }
  ]
}
```

### GET /api/services/{id}
Get microservice by ID.

### PUT /api/services/{id}
Update microservice configuration.

### DELETE /api/services/{id}
Delete microservice.

---

## 6. Docker Image APIs

### GET /api/services/{serviceId}/images
List registered images for a service.

### POST /api/services/{serviceId}/images
Register a Docker image.

**Request:**
```json
{
  "registry": "docker.io",
  "repository": "mycompany",
  "imageName": "product-service",
  "tag": "v2.0.0"
}
```

### DELETE /api/images/{id}
Remove a Docker image registration.

---

## 7. Deployment APIs

### POST /api/deployments
Deploy a microservice.

**Request:**
```json
{
  "microserviceId": "uuid",
  "dockerImageId": "uuid"
}
```

**Response: 202 Accepted**
```json
{
  "success": true,
  "data": {
    "deploymentId": "uuid",
    "status": "DEPLOYING",
    "kubernetesNamespace": "ecommerce",
    "kubernetesDeploymentName": "product-service"
  }
}
```

### GET /api/deployments/{id}
Get deployment status.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "RUNNING",
    "replicasDesired": 2,
    "replicasReady": 2,
    "pods": [
      {
        "name": "product-service-abc123",
        "status": "Running",
        "ready": true,
        "restartCount": 0,
        "nodeName": "docker-desktop"
      }
    ]
  }
}
```

### GET /api/services/{serviceId}/deployments
List deployment history for a service.

### POST /api/deployments/{id}/restart
Restart a deployment.

### POST /api/deployments/{id}/scale
Scale a deployment.

**Request:**
```json
{ "replicas": 4 }
```

### POST /api/deployments/{id}/rollback
Rollback to a previous version.

**Request:**
```json
{ "targetVersion": 2 }
```

### DELETE /api/deployments/{id}
Stop and delete a deployment.

---

## 8. Monitoring APIs

### GET /api/monitoring/services/{serviceId}/metrics
Get current metrics for a service.

### GET /api/monitoring/pods/{podName}/metrics
Get metrics for a specific pod.

---

## 9. Log APIs

### GET /api/logs/services/{serviceId}
Query logs for a service.

**Query params:** `startTime`, `endTime`, `filter`, `limit`

### GET /api/logs/pods/{podName}
Get logs for a specific pod.

---

## 10. Incident APIs

### GET /api/incidents
List incidents (filter by status, severity).

### GET /api/incidents/{id}
Get incident details.

### POST /api/incidents/{id}/resolve
Resolve an incident.

---

## 11. Audit Log APIs

### GET /api/audit-logs
List audit logs (paginated).

**Query params:** `userId`, `action`, `resourceType`, `from`, `to`, `page`, `size`

---

## 12. HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async operation started) |
| 400 | Bad Request / Validation Error |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 422 | Unprocessable Entity |
| 500 | Internal Server Error |
| 503 | Service Unavailable (Kubernetes unreachable) |
