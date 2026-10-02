import { useLiveEvents } from "./LiveEvents";
import { Badge, Card } from "./ui";
import type { LiveEvent } from "../api/client";

/** How many lines are kept on screen. The feed is a window on now, not a log. */
const MAX_LINES = 60;

const TONE: Record<string, "good" | "warn" | "info" | "bad"> = {
  scaling: "good",
  healing: "warn",
  outcome: "good",
  alert: "bad",
  incident: "bad",
  "pod-unhealthy": "warn",
  "microservice-registered": "good",
  build: "info",
};

/**
 * The control loop as it happens.
 *
 * <p>Reads the dashboard's single live connection rather than opening one of its
 * own: two EventSources to the same endpoint would double the server's fan-out and
 * could show two different versions of the same moment.
 */
export function LiveActivity() {
  const { recent, connected } = useLiveEvents();
  const events: LiveEvent[] = recent.slice(0, MAX_LINES);

  return (
    <Card title="Live Activity" meta={connected ? "streaming" : "reconnecting"}>
      <div className="live-feed">
        {events.length === 0 ? (
          <p className="muted">
            Waiting for the next reconciliation cycle. Nothing is being polled — these
            lines appear the moment the control plane decides something.
          </p>
        ) : (
          events.map((event, index) => (
            <div className="live-line" key={`${event.at}-${index}`}>
              <span className="live-time mono">
                {new Date(event.at).toLocaleTimeString()}
              </span>
              <Badge tone={TONE[event.kind] ?? "info"}>{event.kind}</Badge>
              <span className="live-text">{event.text}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
