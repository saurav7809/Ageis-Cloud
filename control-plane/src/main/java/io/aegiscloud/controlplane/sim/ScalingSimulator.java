package io.aegiscloud.controlplane.sim;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Pure-Java port of the scaling strategy simulation engine from cloud-strategy-sim.
 *
 * <p>Three strategies compete against the same workload profile:
 * <ul>
 *   <li><b>CPU</b>  — scales when average CPU crosses a threshold (reactive)</li>
 *   <li><b>TREND</b> — looks at the rate-of-change of CPU; scales pre-emptively</li>
 *   <li><b>LATENCY</b> — scales on latency p95; very responsive but thrash-prone</li>
 * </ul>
 *
 * <p>Traffic patterns reproduce the four shapes from the original simulator:
 * stable, spike, periodic (sine), and chaotic.
 */
public class ScalingSimulator {

    public enum Strategy { CPU, TREND, LATENCY }

    public enum TrafficPattern { STABLE, SPIKE, PERIODIC, CHAOTIC }

    public record TelemetryPoint(
            long timestamp,
            String timeLabel,
            double cpu,
            double latency,
            int replicas,
            int workloadRate,
            double predictedLoad,
            double trendGradient,
            double costRate
    ) {}

    public record ScalingEvent(
            String type,      // SCALE_UP | SCALE_DOWN | HEALTH_CHECK | LATENCY_SPIKE | THRASH_WARNING
            String severity,  // info | warning | error | success
            String message,
            int previousReplicas,
            int targetReplicas,
            String metricTrigger,
            int tickIndex
    ) {}

    public record StrategyResult(
            String strategy,
            String status,
            int finalReplicas,
            double avgCpu,
            double avgLatency,
            double peakCpu,
            double peakLatency,
            int scalingEventCount,
            int thrashingScore,
            double costPerHour,
            int efficiencyPct,
            String rating,
            List<TelemetryPoint> telemetry,
            List<ScalingEvent> events
    ) {}

    public record SimulationResult(
            String workload,
            String trafficPattern,
            int durationTicks,
            int minReplicas,
            int maxReplicas,
            List<StrategyResult> strategies,
            String bestStrategy,
            int bestEfficiency,
            double confidencePct
    ) {}

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    public SimulationResult run(String workload, TrafficPattern pattern,
                                int minReplicas, int maxReplicas,
                                int ticks, long seed) {
        List<Double> workload_profile = generateWorkloadProfile(pattern, ticks, seed);

        List<StrategyResult> results = new ArrayList<>();
        for (Strategy s : Strategy.values()) {
            results.add(simulate(s, workload_profile, minReplicas, maxReplicas, workload, pattern));
        }

        // Pick best by efficiency
        StrategyResult best = results.stream()
                .max((a, b) -> Integer.compare(a.efficiencyPct(), b.efficiencyPct()))
                .orElse(results.get(0));

        double confidence = 70 + (best.efficiencyPct() - 50) * 0.5;

        return new SimulationResult(
                workload, pattern.name(), ticks,
                minReplicas, maxReplicas,
                results,
                best.strategy(), best.efficiencyPct(),
                Math.min(99.9, confidence)
        );
    }

    // -----------------------------------------------------------------------
    // Workload profile generation (matches cloud-strategy-sim patterns)
    // -----------------------------------------------------------------------

    private List<Double> generateWorkloadProfile(TrafficPattern pattern, int ticks, long seed) {
        List<Double> profile = new ArrayList<>(ticks);
        double base = 55 + (seed % 20);

        for (int i = 0; i < ticks; i++) {
            double v;
            switch (pattern) {
                case STABLE -> v = base + gaussian(seed + i) * 4;
                case SPIKE -> {
                    boolean spike = (i % 8) < 3;
                    v = spike ? base + 30 + gaussian(seed + i) * 8
                              : base - 15 + gaussian(seed + i) * 4;
                }
                case PERIODIC -> {
                    double angle = i * 0.45 + (seed % 10);
                    v = base + Math.sin(angle) * 22 + gaussian(seed + i) * 3;
                }
                case CHAOTIC -> v = base + gaussian(seed + i * 7) * 25;
                default -> v = base;
            }
            profile.add(Math.max(5, Math.min(98, v)));
        }
        return profile;
    }

    // -----------------------------------------------------------------------
    // Per-strategy simulation loop
    // -----------------------------------------------------------------------

    private StrategyResult simulate(Strategy strategy, List<Double> cpuProfile,
                                    int minR, int maxR,
                                    String workload, TrafficPattern pattern) {
        int ticks = cpuProfile.size();
        int replicas = minR + (maxR - minR) / 3;

        List<TelemetryPoint> telemetry = new ArrayList<>(ticks);
        List<ScalingEvent> events = new ArrayList<>();

        double totalCpu = 0, totalLatency = 0;
        double peakCpu = 0, peakLatency = 0;
        int thrashCount = 0;
        int lastScaleTick = -5;
        int prevReplicas = replicas;
        double prevCpu = cpuProfile.get(0);

        long now = System.currentTimeMillis();

        for (int i = 0; i < ticks; i++) {
            double rawCpu = cpuProfile.get(i);
            double effectiveCpu = rawCpu / Math.max(1.0, replicas / (double)(minR));
            effectiveCpu = Math.max(5, Math.min(98, effectiveCpu));

            // Latency: roughly correlates with CPU plus noise
            double latency = computeLatency(effectiveCpu, pattern, i);

            // Strategy decision
            int targetReplicas = replicas;
            double trendGrad = i > 0 ? effectiveCpu - prevCpu : 0;
            double predictedLoad = Math.min(98, effectiveCpu * 1.05 + Math.sin(i * 0.6) * 5);

            switch (strategy) {
                case CPU -> {
                    if (effectiveCpu > 75 && replicas < maxR) targetReplicas = Math.min(maxR, replicas + 2);
                    else if (effectiveCpu < 35 && replicas > minR) targetReplicas = Math.max(minR, replicas - 1);
                }
                case TREND -> {
                    if (trendGrad > 5 && replicas < maxR) targetReplicas = Math.min(maxR, replicas + 1);
                    else if (trendGrad < -5 && replicas > minR) targetReplicas = Math.max(minR, replicas - 1);
                    else if (predictedLoad > 80 && replicas < maxR) targetReplicas = Math.min(maxR, replicas + 1);
                }
                case LATENCY -> {
                    if (latency > 150 && replicas < maxR) targetReplicas = Math.min(maxR, replicas + 2);
                    else if (latency < 50 && replicas > minR) targetReplicas = Math.max(minR, replicas - 1);
                }
            }

            // Cooldown: don't scale more than once every 3 ticks
            if (targetReplicas != replicas && (i - lastScaleTick) < 3) {
                targetReplicas = replicas; // blocked by cooldown
            }

            if (targetReplicas != replicas) {
                boolean scaleUp = targetReplicas > replicas;
                // Detect thrashing: changed direction within 5 ticks
                if (i - lastScaleTick < 5 && prevReplicas != replicas) thrashCount++;

                String evtType = scaleUp ? "SCALE_UP" : "SCALE_DOWN";
                String trigger = switch (strategy) {
                    case CPU -> String.format("CPU %.1f%%", effectiveCpu);
                    case TREND -> String.format("Trend %.1f%%/tick", trendGrad);
                    case LATENCY -> String.format("Latency %.0fms", latency);
                };

                events.add(new ScalingEvent(
                        evtType, scaleUp ? "success" : "info",
                        scaleUp ? "Scale Up triggered" : "Scale Down triggered",
                        replicas, targetReplicas, trigger, i
                ));

                if (latency > 200) {
                    events.add(new ScalingEvent("LATENCY_SPIKE", "warning",
                            "High latency detected", replicas, replicas,
                            String.format("%.0fms", latency), i));
                }

                prevReplicas = replicas;
                replicas = targetReplicas;
                lastScaleTick = i;
            }

            totalCpu += effectiveCpu;
            totalLatency += latency;
            peakCpu = Math.max(peakCpu, effectiveCpu);
            peakLatency = Math.max(peakLatency, latency);
            prevCpu = effectiveCpu;

            int workloadRate = computeWorkloadRate(pattern, i, cpuProfile.get(i));
            double costRate = replicas * 2.45;

            telemetry.add(new TelemetryPoint(
                    now - (long)(ticks - i) * 5000,
                    i == ticks - 1 ? "Now" : "T-" + (ticks - i - 1) * 5 + "s",
                    round(effectiveCpu, 1),
                    round(latency, 0),
                    replicas,
                    workloadRate,
                    round(predictedLoad, 1),
                    round(trendGrad, 1),
                    round(costRate, 2)
            ));
        }

        double avgCpu = totalCpu / ticks;
        double avgLatency = totalLatency / ticks;
        double costPerHour = replicas * 2.45;

        // Efficiency: penalise over-provisioning, thrashing, and high cost
        int efficiency = computeEfficiency(strategy, avgCpu, avgLatency, peakLatency,
                events.stream().filter(e -> e.type().startsWith("SCALE")).count(),
                thrashCount, replicas, maxR);

        String rating = efficiency >= 90 ? "EXCELLENT"
                      : efficiency >= 75 ? "GOOD"
                      : efficiency >= 55 ? "FAIR"
                      : "POOR";

        String status = thrashCount > 5 ? "Thrashing"
                      : avgCpu > 85 ? "Overloaded"
                      : avgCpu < 30 ? "Over-provisioned"
                      : "Optimal";

        return new StrategyResult(
                strategy.name(), status, replicas,
                round(avgCpu, 1), round(avgLatency, 0),
                round(peakCpu, 1), round(peakLatency, 0),
                events.stream().filter(e -> e.type().startsWith("SCALE")).mapToInt(x -> 1).sum(),
                thrashCount,
                round(costPerHour, 2),
                efficiency, rating,
                telemetry, events
        );
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private double computeLatency(double cpu, TrafficPattern pattern, int tick) {
        double base = 20 + cpu * 1.8;
        double noise = switch (pattern) {
            case SPIKE -> (tick % 8 < 3) ? 80 + Math.random() * 40 : Math.random() * 10;
            case CHAOTIC -> Math.random() * 120 - 20;
            case PERIODIC -> Math.sin(tick * 0.45) * 40;
            default -> Math.random() * 10 - 5;
        };
        return Math.max(5, base + noise);
    }

    private int computeWorkloadRate(TrafficPattern pattern, int tick, double rawCpu) {
        return switch (pattern) {
            case SPIKE -> (tick % 8 < 3) ? 1000 + (int)(Math.random() * 300) : 350 + (int)(Math.random() * 100);
            case PERIODIC -> (int)(500 + Math.sin(tick * 0.45) * 300);
            case CHAOTIC -> 200 + (int)(Math.random() * 800);
            default -> 400 + (int)(Math.random() * 80);
        };
    }

    private int computeEfficiency(Strategy strategy, double avgCpu, double avgLatency,
                                  double peakLatency, long scalingEvents,
                                  int thrashCount, int finalReplicas, int maxReplicas) {
        int score = 100;
        // Penalise over-provisioning
        if (avgCpu < 25) score -= 20;
        else if (avgCpu < 40) score -= 10;
        // Penalise high latency
        if (peakLatency > 300) score -= 15;
        else if (peakLatency > 200) score -= 8;
        // Penalise thrashing
        score -= Math.min(30, thrashCount * 3);
        // Penalise excessive scaling events
        if (scalingEvents > 15) score -= 10;
        else if (scalingEvents > 8) score -= 5;
        // Bonus for TREND (pre-emptive scaling usually performs better)
        if (strategy == Strategy.TREND && thrashCount < 3) score += 5;
        return Math.max(10, Math.min(100, score));
    }

    /** Simple seeded noise based on sin (avoids Random object per call) */
    private double gaussian(long seed) {
        return Math.sin(seed * 127.1 + 311.7) * Math.cos(seed * 269.5 + 183.3) * 2.0;
    }

    private double round(double v, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.round(v * factor) / factor;
    }
}
