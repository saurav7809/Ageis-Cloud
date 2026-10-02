package io.aegiscloud.controlplane.web;

import io.aegiscloud.controlplane.auth.CurrentUser;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Exposes which clusters are live-connected vs cloud-only inventory,
 * and the last time the live sync ran for each.
 */
@RestController
@RequestMapping("/api/v1/cluster-status")
public class ClusterStatusController {

    private final JdbcTemplate jdbc;

    public ClusterStatusController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<Map<String, Object>> status() {
        UUID orgId = CurrentUser.get().orgId();

        return jdbc.queryForList("""
                SELECT
                    c.id::text AS id,
                    c.name,
                    c.provider_type AS provider,
                    c.distribution,
                    c.region,
                    c.status,
                    c.node_count AS nodeCount,
                    c.k8s_version AS k8sVersion,
                    c.is_local AS isLocal,
                    CASE WHEN c.kubeconfig_ref IS NOT NULL THEN true ELSE false END AS isLive,
                    c.kubeconfig_ref AS kubeContext,
                    COUNT(t.id) AS targetCount,
                    SUM(t.replicas) AS runningReplicas,
                    SUM(t.desired_replicas) AS desiredReplicas,
                    MAX(t.updated_at) AS lastSyncedAt,
                    ROUND(AVG(t.availability_pct)::numeric, 2) AS avgAvailability,
                    ROUND(AVG(t.reliability_score)::numeric, 1) AS avgReliability
                FROM cluster c
                LEFT JOIN deployment_target t ON t.cluster_id = c.id
                WHERE c.org_id = ?
                  AND c.is_active = true
                GROUP BY c.id, c.name, c.provider_type, c.distribution, c.region,
                         c.status, c.node_count, c.k8s_version, c.is_local, c.kubeconfig_ref
                ORDER BY c.is_local DESC, c.name
                """, orgId);
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        UUID orgId = CurrentUser.get().orgId();

        Map<String, Object> row = jdbc.queryForMap("""
                SELECT
                    COUNT(c.id) AS totalClusters,
                    SUM(CASE WHEN c.kubeconfig_ref IS NOT NULL THEN 1 ELSE 0 END) AS liveClusters,
                    SUM(CASE WHEN c.kubeconfig_ref IS NULL THEN 1 ELSE 0 END) AS inventoryClusters,
                    SUM(CASE WHEN c.status = 'HEALTHY' THEN 1 ELSE 0 END) AS healthyClusters,
                    MAX(t.updated_at) AS lastLiveSyncAt
                FROM cluster c
                LEFT JOIN deployment_target t ON t.cluster_id = c.id
                    AND c.kubeconfig_ref IS NOT NULL
                WHERE c.org_id = ?
                  AND c.is_active = true
                """, orgId);

        boolean hasLiveData = row.get("liveClusters") != null
                && ((Number) row.get("liveClusters")).intValue() > 0;

        return Map.of(
                "totalClusters", row.getOrDefault("totalClusters", 0),
                "liveClusters", row.getOrDefault("liveClusters", 0),
                "inventoryClusters", row.getOrDefault("inventoryClusters", 0),
                "healthyClusters", row.getOrDefault("healthyClusters", 0),
                "hasLiveData", hasLiveData,
                "lastLiveSyncAt", row.get("lastLiveSyncAt") != null
                        ? row.get("lastLiveSyncAt").toString() : null,
                "syncIntervalSeconds", 30
        );
    }
}
