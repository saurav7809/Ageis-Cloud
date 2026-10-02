package io.aegiscloud.controlplane.web;

import io.aegiscloud.controlplane.auth.Tenant;
import io.aegiscloud.controlplane.k8s.KubernetesClientFactory;
import io.aegiscloud.controlplane.persistence.ClusterRepository;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.client.KubernetesClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Pod log access for the dashboard log viewer.
 *
 * <p>Returns the last N lines from a named pod, or from any pod belonging to a
 * workload (useful when the caller only knows the service name). Streaming over
 * SSE is deliberate: the dashboard tail view updates without polling, and the
 * connection naturally closes when the browser navigates away.
 */
@RestController
@RequestMapping("/api/v1/logs")
public class LogsController {

    private static final Logger log = LoggerFactory.getLogger(LogsController.class);
    private static final int DEFAULT_TAIL = 200;
    private static final int MAX_TAIL = 2000;

    private final KubernetesClientFactory clients;
    private final ClusterRepository clusters;

    public LogsController(KubernetesClientFactory clients, ClusterRepository clusters) {
        this.clients = clients;
        this.clusters = clusters;
    }

    /** All pods for a workload in a namespace — the dropdown needs this. */
    public record PodSummary(String name, String phase, boolean ready, int restarts) {}

    /** One log line with metadata for the viewer. */
    public record LogLine(String pod, String line, int lineNumber) {}

    /** Log response with metadata. */
    public record LogResponse(
            String cluster,
            String namespace,
            String workload,
            String pod,
            int tailLines,
            List<LogLine> lines,
            String note) {}

    @GetMapping("/pods")
    public List<PodSummary> pods(
            @RequestParam String cluster,
            @RequestParam String namespace,
            @RequestParam String workload) {

        UUID orgId = Tenant.currentOrgId();
        var clusterEntity = clusters.findByOrgIdAndName(orgId, cluster)
                .orElseThrow(() -> ApiException.notFound("cluster " + cluster + " not found"));

        try (KubernetesClient client = clients.clientFor(clusterEntity.getKubeconfigRef())) {
            List<Pod> pods = client.pods()
                    .inNamespace(namespace)
                    .withLabel("app", workload)
                    .list()
                    .getItems();

            return pods.stream().map(p -> {
                boolean ready = p.getStatus() != null
                        && p.getStatus().getConditions() != null
                        && p.getStatus().getConditions().stream()
                        .anyMatch(c -> "Ready".equals(c.getType()) && "True".equals(c.getStatus()));
                int restarts = p.getStatus() == null || p.getStatus().getContainerStatuses() == null ? 0
                        : p.getStatus().getContainerStatuses().stream()
                        .mapToInt(s -> s.getRestartCount() == null ? 0 : s.getRestartCount()).sum();
                String phase = p.getStatus() == null || p.getStatus().getPhase() == null
                        ? "Unknown" : p.getStatus().getPhase();
                return new PodSummary(p.getMetadata().getName(), phase, ready, restarts);
            }).toList();
        } catch (Exception e) {
            log.warn("could not list pods for {}/{}: {}", namespace, workload, e.getMessage());
            return List.of();
        }
    }

    /**
     * Fetch the last N log lines from a pod.
     *
     * <p>When {@code pod} is omitted the first running pod for the workload is used.
     * The limit on {@code tail} is enforced server-side: a very large tail for a
     * high-volume service would stream megabytes to the browser and freeze it.
     */
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public LogResponse logs(
            @RequestParam String cluster,
            @RequestParam String namespace,
            @RequestParam String workload,
            @RequestParam(required = false) String pod,
            @RequestParam(defaultValue = "200") int tail) {

        UUID orgId = Tenant.currentOrgId();
        var clusterEntity = clusters.findByOrgIdAndName(orgId, cluster)
                .orElseThrow(() -> ApiException.notFound("cluster " + cluster + " not found"));

        int clampedTail = Math.min(Math.max(tail, 1), MAX_TAIL);

        try (KubernetesClient client = clients.clientFor(clusterEntity.getKubeconfigRef())) {
            String resolvedPod = pod;

            if (resolvedPod == null || resolvedPod.isBlank()) {
                List<Pod> running = client.pods()
                        .inNamespace(namespace)
                        .withLabel("app", workload)
                        .list().getItems().stream()
                        .filter(p -> "Running".equals(
                                p.getStatus() == null ? "" : p.getStatus().getPhase()))
                        .toList();
                if (running.isEmpty()) {
                    return new LogResponse(cluster, namespace, workload, null,
                            clampedTail, List.of(),
                            "no running pod found for workload " + workload
                                    + " in namespace " + namespace);
                }
                resolvedPod = running.get(0).getMetadata().getName();
            }

            InputStream logStream = client.pods()
                    .inNamespace(namespace)
                    .withName(resolvedPod)
                    .tailingLines(clampedTail)
                    .getLogInputStream();

            List<LogLine> lines;
            final String finalPodName = resolvedPod;
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(logStream))) {
                java.util.concurrent.atomic.AtomicInteger counter = new java.util.concurrent.atomic.AtomicInteger(0);
                lines = reader.lines()
                        .map(l -> new LogLine(finalPodName, l, counter.incrementAndGet()))
                        .toList();
            }

            return new LogResponse(cluster, namespace, workload, resolvedPod,
                    clampedTail, lines, null);

        } catch (Exception e) {
            log.warn("log fetch failed for {}/{}/{}: {}", cluster, namespace, workload, e.getMessage());
            return new LogResponse(cluster, namespace, workload, pod,
                    clampedTail, List.of(), "could not fetch logs: " + e.getMessage());
        }
    }

    /**
     * Aggregated log search — scans the last N lines of all pods in a workload
     * for a query string. Useful for finding which pod logged a specific error.
     */
    @GetMapping("/search")
    public Map<String, Object> search(
            @RequestParam String cluster,
            @RequestParam String namespace,
            @RequestParam String workload,
            @RequestParam String query,
            @RequestParam(defaultValue = "500") int tail) {

        UUID orgId = Tenant.currentOrgId();
        var clusterEntity = clusters.findByOrgIdAndName(orgId, cluster)
                .orElseThrow(() -> ApiException.notFound("cluster " + cluster + " not found"));

        int clampedTail = Math.min(tail, MAX_TAIL);
        List<Map<String, Object>> matches = new java.util.ArrayList<>();
        String lowerQuery = query.toLowerCase();

        try (KubernetesClient client = clients.clientFor(clusterEntity.getKubeconfigRef())) {
            List<Pod> pods = client.pods()
                    .inNamespace(namespace)
                    .withLabel("app", workload)
                    .list().getItems();

            for (Pod p : pods) {
                String podName = p.getMetadata().getName();
                try {
                    InputStream logStream = client.pods()
                            .inNamespace(namespace)
                            .withName(podName)
                            .tailingLines(clampedTail)
                            .getLogInputStream();
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(logStream))) {
                        int lineNum = 0;
                        String line;
                        while ((line = reader.readLine()) != null) {
                            lineNum++;
                            if (line.toLowerCase().contains(lowerQuery)) {
                                matches.add(Map.of("pod", podName, "line", line, "lineNumber", lineNum));
                            }
                        }
                    }
                } catch (Exception e) {
                    log.debug("could not search logs of pod {}: {}", podName, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("log search failed: {}", e.getMessage());
        }

        return Map.of(
                "cluster", cluster, "namespace", namespace, "workload", workload,
                "query", query, "matchCount", matches.size(), "matches", matches);
    }
}
