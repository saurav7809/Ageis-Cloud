"""AegisCloud SRE AI Assistant — chat module.

Turns free-form questions about the fleet into structured answers by:
1. Fetching live context from the control-plane (metrics, alerts, scaling).
2. Running classical pattern matching on the question intent.
3. Returning a human-readable answer with supporting data.

No external LLM key required — works entirely from the live platform state.
When GEMINI_API_KEY is set in the environment, responses are enriched with
Gemini for free-form questions that don't match a known intent.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any

import httpx

CONTROL_PLANE = os.getenv("AEGISCLOUD_CONTROL_PLANE_URL", "http://localhost:8080")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"


# ── Intent patterns ──────────────────────────────────────────────────────────

INTENTS: list[tuple[str, list[str]]] = [
    ("status_overview",   ["overall status", "platform status", "how is everything", "summary", "overview"]),
    ("degraded_services", ["degraded", "failing", "unhealthy", "down", "broken", "not working"]),
    ("open_alerts",       ["alert", "alerts", "open alert", "critical", "warning"]),
    ("scaling_events",    ["scaling", "scaled", "replica", "replicas", "scale up", "scale down"]),
    ("slo_status",        ["slo", "error budget", "burn rate", "reliability"]),
    ("top_errors",        ["error rate", "errors", "failures", "failed requests"]),
    ("cost",              ["cost", "spend", "monthly", "billing", "expensive"]),
    ("clusters",          ["cluster", "clusters", "node", "nodes", "kubernetes"]),
    ("help",              ["help", "what can you do", "commands", "capabilities"]),
]


def match_intent(question: str) -> str:
    q = question.lower()
    for intent, keywords in INTENTS:
        if any(kw in q for kw in keywords):
            return intent
    return "freeform"


# ── Context fetchers ─────────────────────────────────────────────────────────

async def _get(client: httpx.AsyncClient, path: str, token: str) -> Any:
    try:
        r = await client.get(
            f"{CONTROL_PLANE}{path}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5.0,
        )
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


async def fetch_context(token: str) -> dict:
    async with httpx.AsyncClient() as client:
        overview, alerts, scaling, metrics = await _gather(
            _get(client, "/api/v1/overview", token),
            _get(client, "/api/v1/alerts", token),
            _get(client, "/api/v1/control-plane/scaling-events", token),
            _get(client, "/api/v1/metrics/summary", token),
        )
    return {
        "overview": overview or {},
        "alerts": alerts if isinstance(alerts, list) else (alerts or {}).get("alerts", []),
        "scaling": scaling if isinstance(scaling, list) else [],
        "metrics": metrics or {},
    }


async def _gather(*coros):
    import asyncio
    return await asyncio.gather(*coros, return_exceptions=True)


# ── Answer builders ──────────────────────────────────────────────────────────

def answer_status_overview(ctx: dict) -> tuple[str, list[dict]]:
    ov = ctx["overview"]
    clusters = ov.get("totalClusters", "?")
    healthy = ov.get("healthyClusters", "?")
    avg_rel = ov.get("avgReliabilityScore", "?")
    replicas = ov.get("runningReplicas", "?")
    open_alerts = len([a for a in ctx["alerts"] if a.get("status") == "OPEN"])
    spend = ov.get("monthlySpend", 0)

    text = (
        f"**Platform is {'✅ healthy' if healthy == clusters else '⚠️ partially degraded'}.**\n\n"
        f"- **{healthy}/{clusters}** clusters reachable\n"
        f"- **{replicas}** replicas running\n"
        f"- **Avg reliability:** {avg_rel}\n"
        f"- **{open_alerts}** open alert(s)\n"
        f"- **Monthly spend:** ${spend:,.0f}" if isinstance(spend, (int, float)) else f"- **Monthly spend:** ${spend}"
    )
    cards = [
        {"label": "Clusters", "value": f"{healthy}/{clusters}", "status": "good" if healthy == clusters else "warn"},
        {"label": "Replicas", "value": str(replicas), "status": "good"},
        {"label": "Open Alerts", "value": str(open_alerts), "status": "good" if open_alerts == 0 else "bad"},
        {"label": "Avg Reliability", "value": str(avg_rel), "status": "good"},
    ]
    return text, cards


def answer_degraded(ctx: dict) -> tuple[str, list[dict]]:
    alerts = [a for a in ctx["alerts"] if a.get("status") == "OPEN"]
    if not alerts:
        return "✅ No open alerts — all services are reporting healthy.", []

    lines = [f"Found **{len(alerts)}** open alert(s):\n"]
    cards = []
    for a in alerts[:5]:
        sev = a.get("severity", "?")
        msg = a.get("message", "?")
        svc = a.get("serviceName", "?")
        lines.append(f"- **{sev}** — `{svc}`: {msg}")
        cards.append({"label": svc, "value": sev, "status": "bad" if sev == "CRITICAL" else "warn"})

    if len(alerts) > 5:
        lines.append(f"…and {len(alerts) - 5} more. Check the Incidents page.")

    return "\n".join(lines), cards


def answer_alerts(ctx: dict) -> tuple[str, list[dict]]:
    return answer_degraded(ctx)


def answer_scaling(ctx: dict) -> tuple[str, list[dict]]:
    events = ctx["scaling"][:6] if ctx["scaling"] else []
    if not events:
        return "No recent scaling events found.", []

    lines = [f"**{len(ctx['scaling'])} recent scaling event(s):**\n"]
    cards = []
    for e in events:
        action = e.get("action", "?")
        target = e.get("targetLabel", e.get("workload", "?"))
        prev = e.get("previousReplicas", "?")
        curr = e.get("newReplicas", e.get("targetReplicas", "?"))
        lines.append(f"- `{target}`: {prev} → {curr} replicas ({action})")
        cards.append({"label": target, "value": f"{prev}→{curr}", "status": "good" if "UP" in str(action).upper() else "warn"})

    return "\n".join(lines), cards


def answer_slo(ctx: dict) -> tuple[str, list[dict]]:
    return (
        "SLO details are tracked per-service. Open the **SLO Config** page for burn rates and error budgets for each target.",
        [{"label": "View SLOs", "value": "SLO Config page", "status": "good"}]
    )


def answer_cost(ctx: dict) -> tuple[str, list[dict]]:
    ov = ctx["overview"]
    spend = ov.get("monthlySpend", "unknown")
    return (
        f"Current estimated monthly cloud spend: **${spend:,.0f}**.\n\nBreakdown by provider is available on the **Overview** page under 'Score by Provider'." if isinstance(spend, (int, float)) else "Cost data is available on the Overview page.",
        [{"label": "Monthly Spend", "value": f"${spend}", "status": "good"}]
    )


def answer_clusters(ctx: dict) -> tuple[str, list[dict]]:
    ov = ctx["overview"]
    total = ov.get("totalClusters", "?")
    healthy = ov.get("healthyClusters", "?")
    return (
        f"**{total}** clusters registered, **{healthy}** reachable and healthy.\n\nFor per-cluster details, open the **Clusters** page.",
        [{"label": "Clusters", "value": f"{healthy}/{total} healthy", "status": "good" if healthy == total else "warn"}]
    )


def answer_help() -> tuple[str, list[dict]]:
    text = (
        "I'm the **AegisCloud SRE Assistant**. You can ask me:\n\n"
        "- *What's the overall platform status?*\n"
        "- *Are there any degraded services?*\n"
        "- *Show me open alerts*\n"
        "- *What scaling events happened recently?*\n"
        "- *What's my monthly cloud spend?*\n"
        "- *How many clusters are healthy?*\n"
        "- *What are my SLO burn rates?*\n\n"
        "I pull live data from the platform on every question."
    )
    return text, []


async def answer_freeform(question: str, ctx: dict) -> tuple[str, list[dict]]:
    """Use Gemini for questions that don't match a known intent."""
    if not GEMINI_API_KEY:
        return (
            "I'm not sure about that specific question. Try asking about:\n"
            "- Platform status  •  Open alerts  •  Scaling events\n"
            "- Cost  •  Clusters  •  SLO burn rates\n\n"
            "*(Set GEMINI_API_KEY in the AI service environment to enable free-form answers.)*",
            []
        )

    # Build a compact system context from live data
    ov = ctx["overview"]
    open_alerts = [a for a in ctx["alerts"] if a.get("status") == "OPEN"]
    system_ctx = (
        f"AegisCloud platform context: "
        f"{ov.get('totalClusters', '?')} clusters ({ov.get('healthyClusters', '?')} healthy), "
        f"{ov.get('runningReplicas', '?')} running replicas, "
        f"{len(open_alerts)} open alerts, "
        f"avg reliability {ov.get('avgReliabilityScore', '?')}, "
        f"monthly spend ${ov.get('monthlySpend', '?')}."
    )

    prompt = (
        f"You are an SRE AI assistant for the AegisCloud Kubernetes reliability platform. "
        f"Live platform data: {system_ctx}\n\n"
        f"Answer concisely and helpfully: {question}"
    )

    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{GEMINI_ENDPOINT}?key={GEMINI_API_KEY}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=10.0,
            )
            data = r.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return text, []
    except Exception as e:
        return f"Could not reach Gemini ({e}). Try a more specific question.", []


# ── Main entry point ─────────────────────────────────────────────────────────

async def respond(question: str, token: str) -> dict:
    """Resolve a user question into a structured chat response."""
    intent = match_intent(question)
    ctx = await fetch_context(token)

    if intent == "status_overview":
        text, cards = answer_status_overview(ctx)
    elif intent in ("degraded_services", "open_alerts", "top_errors"):
        text, cards = answer_degraded(ctx)
    elif intent == "scaling_events":
        text, cards = answer_scaling(ctx)
    elif intent == "slo_status":
        text, cards = answer_slo(ctx)
    elif intent == "cost":
        text, cards = answer_cost(ctx)
    elif intent == "clusters":
        text, cards = answer_clusters(ctx)
    elif intent == "help":
        text, cards = answer_help()
    else:
        text, cards = await answer_freeform(question, ctx)

    return {"intent": intent, "answer": text, "cards": cards}
