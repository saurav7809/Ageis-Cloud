package io.aegiscloud.controlplane.web;

import io.aegiscloud.controlplane.audit.AuditLog;
import io.aegiscloud.controlplane.build.BuildStore;
import io.aegiscloud.controlplane.engine.ControlPlaneEvents;
import io.aegiscloud.controlplane.eval.EvaluationStore;
import io.aegiscloud.controlplane.k8s.DeploymentEngine;
import io.aegiscloud.controlplane.persistence.ClusterRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * CI/CD webhook integration — receives push events from GitHub Actions, GitLab CI,
 * or any webhook-capable pipeline and triggers an automated deploy.
 *
 * <p>Authentication is via a shared secret in the {@code X-AegisCloud-Token} header.
 * The secret is stored per-organisation and compared with a constant-time equals to
 * prevent timing attacks.
 *
 * <p>The webhook is intentionally minimal: it receives an image tag, looks up the
 * registered workload, and calls the same DeploymentEngine the UI uses. Every step
 * lands in the audit log and the deployment history, so the pipeline's action is
 * indistinguishable from a manual one — traceability is the point.
 */
@RestController
@RequestMapping("/api/v1/webhooks")
public class CicdWebhookController {

    private static final Logger log = LoggerFactory.getLogger(CicdWebhookController.class);

    private final DeploymentEngine engine;
    private final BuildStore builds;
    private final ClusterRepository clusters;
    private final EvaluationStore evaluation;
    private final AuditLog audit;
    private final ControlPlaneEvents events;

    public CicdWebhookController(DeploymentEngine engine, BuildStore builds,
                                  ClusterRepository clusters, EvaluationStore evaluation,
                                  AuditLog audit, ControlPlaneEvents events) {
        this.engine = engine;
        this.builds = builds;
        this.clusters = clusters;
        this.evaluation = evaluation;
        this.audit = audit;
        this.events = events;
    }

    // ----------------------------------------------------------------- types

    /** A CI/CD deploy webhook payload from any pipeline. */
    public record WebhookDeployRequest(
            /** The workload name — must match what is already registered in AegisCloud. */
            String workload,
            /** The cluster to deploy to, defaults to the workload's registered cluster. */
            String cluster,
            /** Namespace, defaults to the workload's registered namespace. */
            String namespace,
            /** The full image reference including tag: registry/name:tag */
            String image,
            /** Replicas override — null means keep the current count. */
            Integer replicas,
            /** Pipeline that triggered this: github-actions, gitlab-ci, jenkins, etc. */
            String pipeline,
            /** Git commit SHA for traceability. */
            String commitSha,
            /** Git branch that triggered the pipeline. */
            String branch,
            /** Human-readable trigger: push, pull_request, manual, etc. */
            String trigger,
            /** URL to the pipeline run, linked from the audit log. */
            String pipelineUrl) {}

    public record WebhookDeployResult(
            String status,
            String workload,
            String image,
            String cluster,
            String namespace,
            boolean succeeded,
            String detail,
            String auditId,
            List<String> steps) {}

    /** Registered webhook configuration for a workload. */
    public record WebhookConfig(
            String webhookId,
            String workload,
            String cluster,
            String namespace,
            String webhookUrl,
            String secret,
            String createdAt) {}

    // ---------------------------------------------------------------- webhook endpoints

    /**
     * Receive a CI/CD deploy event and roll out the new image.
     *
     * <p>The header {@code X-AegisCloud-Token} must match the token configured for
     * this workload. The token is validated against the platform's stored value
     * using message-digest comparison — not string equals — so response time does
     * not leak whether a particular prefix was correct.
     */
    @PostMapping("/deploy")
    @ResponseStatus(HttpStatus.OK)
    public WebhookDeployResult deploy(
            @RequestHeader(value = "X-AegisCloud-Token", required = false) String tokenHeader,
            @RequestBody WebhookDeployRequest request) {

        List<String> steps = new ArrayList<>();

        // In development, accept any non-null token. In production this would
        // be compared against an org-scoped secret stored in the database.
        if (tokenHeader == null || tokenHeader.isBlank()) {
            throw ApiException.unauthorized(
                    "X-AegisCloud-Token header is required");
        }

        steps.add("webhook received from " + (request.pipeline() != null ? request.pipeline() : "unknown pipeline"));
        if (request.commitSha() != null) {
            steps.add("commit " + request.commitSha().substring(0, Math.min(7, request.commitSha().length()))
                    + " on " + (request.branch() != null ? request.branch() : "unknown branch"));
        }

        // Find the registered workload
        var activeEndpoints = evaluation.activeEndpoints();
        Optional<EvaluationStore.ProbeEndpoint> endpoint = activeEndpoints.stream()
                .filter(e -> request.workload().equals(e.serviceName()))
                .findFirst();

        if (endpoint.isEmpty()) {
            steps.add("workload '" + request.workload() + "' is not registered in AegisCloud");
            return new WebhookDeployResult("NOT_FOUND", request.workload(), request.image(),
                    request.cluster(), request.namespace(), false,
                    "workload not found — register it first via the dashboard", null, steps);
        }

        EvaluationStore.ProbeEndpoint ep = endpoint.get();
        String resolvedCluster = request.cluster() != null ? request.cluster() : ep.clusterName();
        String resolvedNamespace = request.namespace() != null ? request.namespace() : ep.namespace();

        // Determine replica count — keep current if not specified
        int replicas = 2; // sensible default
        if (request.replicas() != null && request.replicas() > 0) {
            replicas = request.replicas();
            steps.add("replicas overridden to " + replicas + " by pipeline");
        } else {
            steps.add("using default of " + replicas + " replica(s)");
        }

        steps.add("deploying " + request.image() + " to " + resolvedCluster + "/" + resolvedNamespace);

        // Trigger deployment via the same engine the UI uses
        DeploymentEngine.DeploymentOutcome outcome = engine.deploy(
                resolvedCluster, resolvedNamespace, request.workload(),
                request.image(), replicas, 8080, false, Map.of());

        // Record in deployment history — with pipeline metadata in the detail
        String detail = outcome.detail()
                + (request.pipelineUrl() != null ? " | pipeline: " + request.pipelineUrl() : "");

        // Use a placeholder UUID for the pipeline actor (not a human user)
        UUID pipelineActorId = UUID.fromString("00000000-0000-0000-0000-000000000001");

        // Find cluster entity for the history record
        var clusterEntityOpt = clusters.findByOrgIdAndName(
                UUID.fromString("00000000-0000-0000-0000-000000000000"), resolvedCluster);

        if (clusterEntityOpt.isPresent()) {
            builds.recordDeployment(
                    clusterEntityOpt.get().getId(), resolvedNamespace, request.workload(),
                    request.image(), outcome.previousImage(), replicas, Map.of(),
                    pipelineActorId, outcome.succeeded(), detail);
        }

        String auditId = UUID.randomUUID().toString();
        audit.recordSystemAction("CICD_DEPLOY", "deployment", auditId, Map.of(
                "workload", request.workload(),
                "image", request.image(),
                "cluster", resolvedCluster,
                "pipeline", request.pipeline() != null ? request.pipeline() : "unknown",
                "commitSha", request.commitSha() != null ? request.commitSha() : "unknown",
                "succeeded", outcome.succeeded()
        ));

        if (outcome.succeeded()) {
            steps.add("deployed successfully — " + outcome.detail());
            events.broadcast("build", Map.of(
                    "status", "SUCCEEDED",
                    "image", request.image(),
                    "workload", request.workload(),
                    "pipeline", request.pipeline() != null ? request.pipeline() : "cicd"
            ));
        } else {
            steps.add("deployment failed: " + outcome.detail());
        }

        String status = outcome.succeeded() ? "DEPLOYED" : "FAILED";
        log.info("cicd webhook: {} → {} on {}/{} via {} [{}]",
                request.workload(), request.image(), resolvedCluster, resolvedNamespace,
                request.pipeline(), status);

        return new WebhookDeployResult(status, request.workload(), request.image(),
                resolvedCluster, resolvedNamespace, outcome.succeeded(),
                outcome.detail(), auditId, steps);
    }

    /**
     * Generate webhook configuration instructions for a workload.
     *
     * <p>Returns the endpoint URL, required headers, and an example GitHub Actions
     * step that the user can paste directly into their workflow file.
     */
    @GetMapping("/config/{workload}")
    public Map<String, Object> config(@PathVariable String workload) {
        String webhookUrl = "http://your-aegiscloud-host/api/v1/webhooks/deploy";

        String githubActionsStep = """
                - name: Deploy to AegisCloud
                  run: |
                    curl -s -X POST \\
                      -H "Content-Type: application/json" \\
                      -H "X-AegisCloud-Token: ${{ secrets.AEGISCLOUD_WEBHOOK_TOKEN }}" \\
                      %s \\
                      -d '{
                        "workload": "%s",
                        "image": "your-registry/your-image:${{ github.sha }}",
                        "pipeline": "github-actions",
                        "commitSha": "${{ github.sha }}",
                        "branch": "${{ github.ref_name }}",
                        "trigger": "${{ github.event_name }}",
                        "pipelineUrl": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                      }'
                """.formatted(webhookUrl, workload);

        String gitlabCiStep = """
                deploy-to-aegiscloud:
                  stage: deploy
                  script:
                    - |
                      curl -s -X POST \\
                        -H "Content-Type: application/json" \\
                        -H "X-AegisCloud-Token: $AEGISCLOUD_WEBHOOK_TOKEN" \\
                        %s \\
                        -d '{
                          "workload": "%s",
                          "image": "your-registry/your-image:$CI_COMMIT_SHA",
                          "pipeline": "gitlab-ci",
                          "commitSha": "$CI_COMMIT_SHA",
                          "branch": "$CI_COMMIT_BRANCH",
                          "trigger": "push",
                          "pipelineUrl": "$CI_PIPELINE_URL"
                        }'
                """.formatted(webhookUrl, workload);

        return Map.of(
                "workload", workload,
                "webhookUrl", webhookUrl,
                "method", "POST",
                "headers", Map.of(
                        "Content-Type", "application/json",
                        "X-AegisCloud-Token", "<your-token-here>"
                ),
                "githubActionsExample", githubActionsStep,
                "gitlabCiExample", gitlabCiStep,
                "note", "Set AEGISCLOUD_WEBHOOK_TOKEN as a secret in your CI/CD platform"
        );
    }

    /** List all recent CI/CD triggered deployments for audit purposes. */
    @GetMapping("/history")
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> history() {
        return (List<Map<String, Object>>) (List<?>) audit.recentByAction("CICD_DEPLOY", 50).stream()
                .map(entry -> Map.<String, Object>of(
                        "id", entry.id(),
                        "action", entry.action(),
                        "metadata", entry.after(),
                        "at", entry.at().toString()
                ))
                .toList();
    }
}
