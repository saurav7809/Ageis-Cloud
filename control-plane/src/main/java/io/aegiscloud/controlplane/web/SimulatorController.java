package io.aegiscloud.controlplane.web;

import io.aegiscloud.controlplane.sim.ScalingSimulator;
import io.aegiscloud.controlplane.sim.ScalingSimulator.SimulationResult;
import io.aegiscloud.controlplane.sim.ScalingSimulator.TrafficPattern;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST facade over {@link ScalingSimulator}.
 *
 * <p>POST /api/v1/simulate   — run a new simulation
 * <p>GET  /api/v1/simulate/strategies — describe the three strategies
 * <p>GET  /api/v1/simulate/patterns   — describe the four traffic patterns
 */
@RestController
@RequestMapping("/api/v1/simulate")
public class SimulatorController {

    private final ScalingSimulator simulator = new ScalingSimulator();

    public record SimRequest(
            String workload,
            String trafficPattern,   // STABLE | SPIKE | PERIODIC | CHAOTIC
            Integer minReplicas,
            Integer maxReplicas,
            Integer ticks            // how many 5-second time slices to simulate (default 60)
    ) {}

    @PostMapping
    public ResponseEntity<SimulationResult> run(@RequestBody SimRequest req) {
        TrafficPattern pattern;
        try {
            pattern = TrafficPattern.valueOf(req.trafficPattern().toUpperCase());
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }

        int min = req.minReplicas() != null ? Math.max(1, req.minReplicas()) : 2;
        int max = req.maxReplicas() != null ? Math.min(50, req.maxReplicas()) : 10;
        int ticks = req.ticks() != null ? Math.min(120, Math.max(20, req.ticks())) : 60;
        String workload = req.workload() != null ? req.workload() : "unnamed";

        long seed = (workload + pattern.name()).hashCode() & 0xFFFFFFFFL;
        SimulationResult result = simulator.run(workload, pattern, min, max, ticks, seed);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/strategies")
    public Map<String, Object> strategies() {
        return Map.of(
                "strategies", java.util.List.of(
                        Map.of(
                                "id", "CPU",
                                "name", "CPU-Based",
                                "description", "Reacts when average CPU crosses 75%. Simple and predictable, but always reactive — it scales after load arrives.",
                                "prosCons", Map.of(
                                        "pros", java.util.List.of("Simple to understand", "Predictable behaviour", "Low thrash risk"),
                                        "cons", java.util.List.of("Always lags behind spikes", "Over-provisions under stable load")
                                )
                        ),
                        Map.of(
                                "id", "TREND",
                                "name", "Trend-Based",
                                "description", "Watches the rate-of-change of CPU. Scales pre-emptively when load is accelerating — before the threshold is hit.",
                                "prosCons", Map.of(
                                        "pros", java.util.List.of("Pre-emptive scaling", "Lower peak latency", "Fewer SLA breaches"),
                                        "cons", java.util.List.of("Harder to tune", "May scale on false trends")
                                )
                        ),
                        Map.of(
                                "id", "LATENCY",
                                "name", "Latency-Based",
                                "description", "Scales when p95 latency exceeds 150ms. Directly protects user experience but can thrash under variable latency.",
                                "prosCons", Map.of(
                                        "pros", java.util.List.of("Best SLA protection", "User-experience focused"),
                                        "cons", java.util.List.of("High thrash risk on noisy traffic", "Over-provisions cost")
                                )
                        )
                )
        );
    }

    @GetMapping("/patterns")
    public Map<String, Object> patterns() {
        return Map.of(
                "patterns", java.util.List.of(
                        Map.of("id", "STABLE",   "name", "Stable Baseline",     "description", "Steady traffic with minor random noise. Good for validating baseline behaviour."),
                        Map.of("id", "SPIKE",    "name", "Sudden Spike (5x)",   "description", "Traffic spikes to 5× baseline every ~40 seconds. Tests reaction speed."),
                        Map.of("id", "PERIODIC", "name", "Periodic / Sine Wave", "description", "Traffic follows a sine wave — diurnal load pattern typical of retail workloads."),
                        Map.of("id", "CHAOTIC",  "name", "Chaotic / Random",    "description", "Fully random load — worst case for all strategies. Tests thrash resistance.")
                )
        );
    }
}
