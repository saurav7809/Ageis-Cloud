# AegisCloud — Kubernetes Integration

## 1. Overview

AegisCloud uses the **fabric8 Kubernetes Java Client** to communicate with Kubernetes clusters. All Kubernetes operations are isolated inside the `com.aegiscloud.kubernetes` package.

**Principle**: Kubernetes logic NEVER appears in REST controllers. Controllers delegate to services, which delegate to the Kubernetes integration layer.

---

## 2. Kubernetes Client Configuration

The fabric8 client automatically reads:
- `~/.kube/config` (default kubeconfig) — for local development
- In-cluster service account — for production AegisCloud deployment

Configuration is determined at startup from:
```yaml
aegiscloud:
  kubernetes:
    context: docker-desktop    # or minikube, kind-kind, etc.
    in-cluster: false          # set true when running inside K8s
```

---

## 3. Core Operations

### Namespace Management
```
createNamespace(namespaceName)
getNamespace(namespaceName)
namespaceExists(namespaceName) → boolean
deleteNamespace(namespaceName)
```

### Deployment Management
```
createDeployment(namespace, DeploymentSpec)
updateDeployment(namespace, deploymentName, DeploymentSpec)
getDeployment(namespace, deploymentName) → DeploymentStatus
deleteDeployment(namespace, deploymentName)
restartDeployment(namespace, deploymentName)
scaleDeployment(namespace, deploymentName, replicas)
rollbackDeployment(namespace, deploymentName, revision)
```

### Service Management
```
createService(namespace, ServiceSpec)
getService(namespace, serviceName) → ServiceStatus
deleteService(namespace, serviceName)
```

### ConfigMap Management
```
createOrUpdateConfigMap(namespace, configMapName, data)
deleteConfigMap(namespace, configMapName)
```

### Secret Management
```
createOrUpdateSecret(namespace, secretName, data)
deleteSecret(namespace, secretName)
```

### Ingress Management
```
createIngress(namespace, IngressSpec)
deleteIngress(namespace, ingressName)
```

### Pod Management
```
getPodsForDeployment(namespace, deploymentName) → List<PodStatus>
getPodLogs(namespace, podName, lines) → String
```

---

## 4. Deployment Flow

```
KubernetesDeploymentService.deploy(microservice, dockerImage)
    │
    ├── 1. Ensure namespace exists (create if not)
    │
    ├── 2. Build ConfigMap (from environment variables)
    │       createOrUpdateConfigMap(namespace, "${name}-config", envVars)
    │
    ├── 3. Build Kubernetes Deployment manifest
    │       Deployment {
    │         metadata.name = microservice.getName()
    │         spec.replicas = microservice.getReplicas()
    │         spec.template.spec.containers[0] {
    │           image = dockerImage.getFullImageUrl()
    │           ports[0].containerPort = microservice.getContainerPort()
    │           resources.requests.cpu = resourceConfig.getCpuRequest()
    │           resources.requests.memory = resourceConfig.getMemoryRequest()
    │           resources.limits.cpu = resourceConfig.getCpuLimit()
    │           resources.limits.memory = resourceConfig.getMemoryLimit()
    │           livenessProbe.httpGet.path = microservice.getHealthCheckPath()
    │           envFrom[0].configMapRef.name = "${name}-config"
    │         }
    │       }
    │
    ├── 4. Apply Deployment to Kubernetes
    │       client.apps().deployments().inNamespace(ns).createOrReplace(deployment)
    │
    ├── 5. Create Service manifest
    │       Service {
    │         spec.type = microservice.getServiceType()
    │         spec.ports[0].port = microservice.getServicePort()
    │         spec.ports[0].targetPort = microservice.getContainerPort()
    │         spec.selector = { app: microservice.getName() }
    │       }
    │
    ├── 6. Apply Service to Kubernetes
    │
    └── 7. Return KubernetesDeploymentResult {
              deploymentName, serviceName, namespace, status
            }
```

---

## 5. Status Polling

After deployment, AegisCloud polls Kubernetes for real status:

```
GET /api/deployments/{id}
    │
    v
DeploymentService.getDeploymentStatus(id)
    │
    ├── Load deployment from DB
    ├── Call KubernetesService.getDeploymentStatus(namespace, deploymentName)
    │       → K8s Deployment.status.readyReplicas
    │       → K8s Deployment.status.conditions
    ├── Get pods: KubernetesService.getPodsForDeployment(...)
    └── Map K8s status → AegisCloud status (RUNNING/DEGRADED/FAILED)
```

---

## 6. Local Kubernetes Setup (Docker Desktop)

### Prerequisites
- Docker Desktop installed
- Kubernetes enabled in Docker Desktop Settings → Kubernetes → Enable Kubernetes

### Verify Connection
```bash
kubectl cluster-info
kubectl get nodes
```

Expected output:
```
Kubernetes control plane is running at https://kubernetes.docker.internal:6443
NAME             STATUS   ROLES           AGE
docker-desktop   Ready    control-plane   1d
```

### Create AegisCloud Namespace
```bash
kubectl create namespace aegiscloud-system
```

### Set Context
```bash
kubectl config use-context docker-desktop
kubectl config current-context
```

---

## 7. Kubernetes RBAC

For AegisCloud itself (when deployed to Kubernetes), create appropriate RBAC:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aegiscloud-controller
  namespace: aegiscloud-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: aegiscloud-controller-role
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "create", "update", "delete", "patch"]
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps", "secrets", "namespaces"]
    verbs: ["get", "list", "create", "update", "delete", "patch"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "create", "update", "delete"]
  - apiGroups: ["autoscaling"]
    resources: ["horizontalpodautoscalers"]
    verbs: ["get", "list", "create", "update", "delete"]
```

---

## 8. Error Handling

| Kubernetes Error | AegisCloud Response |
|-----------------|---------------------|
| Cluster unreachable | HTTP 503, "Kubernetes cluster is unreachable" |
| Namespace not found | Create namespace automatically |
| Image pull error | Status FAILED, message from K8s events |
| Insufficient resources | Status FAILED, scheduler message |
| Invalid manifest | HTTP 400 with validation details |
| Deployment timeout | Status DEGRADED, timeout message |

---

## 9. Testing Kubernetes Integration

### Verify Cluster Connection
```bash
curl -X GET http://localhost:8080/api/kubernetes/health
```

### Deploy Demo Application
```bash
# Using AegisCloud API
curl -X POST http://localhost:8080/api/deployments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"microserviceId": "uuid", "dockerImageId": "uuid"}'
```

### Verify in Kubernetes
```bash
kubectl get deployments -n ecommerce
kubectl get pods -n ecommerce
kubectl get services -n ecommerce
```
