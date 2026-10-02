package io.aegiscloud.controlplane.engine;

import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.aegiscloud.controlplane.k8s.KubernetesClientFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import io.aegiscloud.controlplane.engine.ControlPlaneEvents;

import java.util.List;
import java.util.Map;

/**
 * Pulls real, live data from every reachable cluster every 30 seconds and
 * writes it into {@code deployment_target}.
 *
 * <p>Only clusters whose {@code kubeconfig_ref} is non-null are probed — the
 * cloud clusters (EKS, GKE, AKS) seeded with null refs are inventory entries
 * for clusters this machine does not have credentials for. They keep their
 * seeded values.
 *
 * <p>For each reachable cluster we:
 * <ol>
 *   <li>List all pods for every deployment target in that cluster (label app={workload}).</li>
 *   <li>Count running / ready pods vs desired replicas.</li>
 *   <li>Derive a simple availability percentage (ready / desired × 100).</li>
 *   <li>Determine health status: HEALTHY / DEGRADED / DOWN.</li>
 *   <li>Write all of this into deployment_target so every API read is live.</li>
 * </ol>
 *
 * <p>This is what removes the "Seeded demo fleet" banner — once this service
 * has run once, the aegiscloud-local rows reflect the actual kind cluster state.
 */
@Service
public class LiveClusterSyncService {

    private static final Logger log = LoggerFactory.getLogger(LiveClusterSyncService.class);

    private final JdbcTemplate jdbc;
    private final KubernetesClientFactory clients;
    private final ControlPlaneEvents events;

    public LiveClusterSyncService(JdbcTemplate jdbc, KubernetesClientFactory clients, ControlPlaneEvents events) {
        this.jdbc = jdbc;
        this.clients = clients;
        this.events = events;
    }

    @Scheduled(fixedDelay = 30_000, initialDelay = 5_000)
    public void sync() {
        // Fetch all clusters that have a real kubeconfig reference
        List<Map<String, Object>> liveClusters = jdbc.queryForList("""
                SELECT id::text AS id, name, kubeconfig_ref
                FROM cluster
                WHERE kubeconfig_ref IS NOT NULL
                  AND is_active = true
                """);

        if (liveClusters.isEmpty()) {
            log.debug("live-sync: no reachable clusters configured");
            return;
        }

        int synced = 0;
        int failed = 0;

        for (Map<String, Object> cluster : liveClusters) {
            String clusterId    = (String) cluster.get("id");
            String clusterName  = (String) cluster.get("name");
            String kubeContext  = (String) cluster.get("kubeconfig_ref");

            try (KubernetesClient client = clients.clientFor(kubeContext)) {
                synced += syncCluster(clusterId, clusterName, client);
            } catch (Exception e) {
                failed++;
                log.warn("live-sync: cluster {} unreachable — {}", clusterName, e.getMessage());
                // Mark cluster degraded so the UI reflects reality
                jdbc.update("UPDATE cluster SET status = 'UNREACHABLE' WHERE id = ?::uuid", clusterId);
            }
        }

        if (synced > 0 || failed > 0) {
            log.info("live-sync: {} targets updated, {} clusters unreachable", synced, failed);
            events.broadcast("live-sync", Map.of("synced", synced, "failed", failed));
        }
    }

    private int syncCluster(String clusterId, String clusterName, KubernetesClient client) {
        // Fetch all deployment targets for this cluster
        List<Map<String, Object>> targets = jdbc.queryForList("""
                SELECT t.id::text AS id, t.namespace, sv.name AS workload,
                       t.desired_replicas, t.deployment_status
                FROM deployment_target t
                JOIN service sv ON sv.id = t.service_id
                WHERE t.cluster_id = ?::uuid
                """, clusterId);

        // Mark cluster healthy since we just connected
        jdbc.update("UPDATE cluster SET status = 'HEALTHY' WHERE id = ?::uuid", clusterId);

        int count = 0;
        for (Map<String, Object> target : targets) {
            String targetId     = (String) target.get("id");
            String namespace    = (String) target.get("namespace");
            String workload     = (String) target.get("workload");
            int desired         = ((Number) target.get("desired_replicas")).intValue();

            try {
                // Query the actual running pods for this workload
                List<Pod> pods = client.pods()
                        .inNamespace(namespace)
                        .withLabel("app", workload)
                        .list()
                        .getItems();

                int totalPods   = pods.size();
                int readyPods   = (int) pods.stream().filter(this::isReady).count();
                int runningPods = (int) pods.stream().filter(this::isRunning).count();

                // If k8s has more replicas than DB thinks, update desired too
                int effectiveDesired = Math.max(desired, totalPods > 0 ? totalPods : desired);

                // Availability = ready pods / desired (capped at 100)
                double availabilityPct = effectiveDesired > 0
                        ? Math.min(100.0, (readyPods / (double) effectiveDesired) * 100.0)
                        : 100.0;

                // Health status
                String health;
                if (totalPods == 0) {
                    health = "DOWN";
                } else if (readyPods == 0) {
                    health = "DOWN";
                } else if (readyPods < effectiveDesired) {
                    health = "DEGRADED";
                } else {
                    health = "HEALTHY";
                }

                // Count restarts for the most-restarted pod
                int maxRestarts = pods.stream()
                        .flatMap(p -> p.getStatus().getContainerStatuses().stream())
                        .mapToInt(cs -> cs.getRestartCount())
                        .max()
                        .orElse(0);

                // Estimate a reliability score from availability + restart pressure
                double restartPenalty = Math.min(10.0, maxRestarts * 0.5);
                double liveScore = Math.max(0, availabilityPct - restartPenalty);

                jdbc.update("""
                        UPDATE deployment_target
                        SET replicas           = ?,
                            desired_replicas   = ?,
                            deployment_status  = ?,
                            availability_pct   = ?,
                            reliability_score  = ?,
                            updated_at         = now()
                        WHERE id = ?::uuid
                        """,
                        runningPods > 0 ? runningPods : readyPods,
                        effectiveDesired,
                        health,
                        Math.round(availabilityPct * 100.0) / 100.0,
                        Math.round(liveScore * 10.0) / 10.0,
                        targetId);

                log.debug("live-sync: {}/{}/{} → {}/{} pods ready, {}% avail, status={}",
                        clusterName, namespace, workload, readyPods, effectiveDesired,
                        String.format("%.1f", availabilityPct), health);

                count++;
            } catch (Exception e) {
                log.debug("live-sync: could not sync {}/{}/{}: {}", clusterName, namespace, workload, e.getMessage());
            }
        }
        return count;
    }

    private boolean isReady(Pod pod) {
        if (pod.getStatus() == null || pod.getStatus().getConditions() == null) return false;
        return pod.getStatus().getConditions().stream()
                .anyMatch(c -> "Ready".equals(c.getType()) && "True".equals(c.getStatus()));
    }

    private boolean isRunning(Pod pod) {
        if (pod.getStatus() == null) return false;
        return "Running".equals(pod.getStatus().getPhase());
    }
}
