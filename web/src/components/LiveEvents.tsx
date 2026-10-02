import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { openControlPlaneStream, type LiveEvent } from "../api/client";

/**
 * One live connection for the whole dashboard.
 *
 * <p>Every page used to poll on its own timer, which meant the screen showed
 * something between one and thirty seconds out of date depending on which page you
 * were looking at, and a platform whose own screens disagree about the current state
 * is one people stop trusting for anything else. It also meant N connections and N
 * repeated queries for data that changes only when the control plane does something.
 *
 * <p>So there is a single EventSource, and pages say which events concern them. A
 * scaling decision refreshes the fleet; an incident refreshes diagnostics; a build
 * refreshes the image list. Nothing refreshes because a timer expired.
 *
 * <p>Polling has not been removed entirely — each page keeps a slow fallback — because
 * a dropped stream must degrade into a stale-but-correct screen rather than a frozen
 * one, and the browser's reconnect is not instant.
 */

type Handler = (event: LiveEvent) => void;

interface LiveEventsValue {
  connected: boolean;
  /** The last 60 events, newest first, for the activity feed. */
  recent: LiveEvent[];
  /** Calls back when any of the named events arrives. Returns an unsubscribe. */
  subscribe: (events: string[], handler: Handler) => () => void;
}

const LiveEventsContext = createContext<LiveEventsValue>({
  connected: false,
  recent: [],
  subscribe: () => () => {},
});

const MAX_RECENT = 60;

export function LiveEventsProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const [recent, setRecent] = useState<LiveEvent[]>([]);

  // Handlers live in a ref so that subscribing does not re-open the stream. A
  // component re-rendering must not cost a reconnection.
  const handlers = useRef<{ events: string[]; handler: Handler }[]>([]);

  const subscribe = useCallback((events: string[], handler: Handler) => {
    const entry = { events, handler };
    handlers.current.push(entry);
    return () => {
      handlers.current = handlers.current.filter((h) => h !== entry);
    };
  }, []);

  useEffect(() => {
    const source = openControlPlaneStream(token, (event) => {
      setConnected(true);
      setRecent((current) => [event, ...current].slice(0, MAX_RECENT));

      for (const { events, handler } of handlers.current) {
        if (events.includes(event.kind)) {
          handler(event);
        }
      }
    });

    // onerror fires while the browser is reconnecting too, so this reports the
    // connection as down rather than tearing the stream down itself.
    source.onerror = () => setConnected(false);

    return () => source.close();
  }, [token]);

  const value = useMemo(
    () => ({ connected, recent, subscribe }),
    [connected, recent, subscribe],
  );

  return <LiveEventsContext.Provider value={value}>{children}</LiveEventsContext.Provider>;
}

export function useLiveEvents() {
  return useContext(LiveEventsContext);
}

/**
 * Runs `onEvent` when one of the named live events arrives, and on a slow timer as a
 * fallback.
 *
 * @param fallbackMs how often to refresh anyway. Long by design: it exists for a
 *        dropped stream, not as the primary path, and a short interval here would
 *        quietly reinstate the polling this replaced.
 */
export function useLiveRefresh(
  events: string[],
  onEvent: () => void,
  fallbackMs = 60000,
) {
  const { subscribe } = useLiveEvents();
  const callback = useRef(onEvent);

  // The latest callback, kept without re-subscribing: a page that rebuilds its
  // refresh function on every render must not cost subscription churn.
  useEffect(() => {
    callback.current = onEvent;
  });

  // events is a fresh literal array at every call site, so it cannot be the
  // dependency itself. The joined string can be: no event kind contains a comma,
  // so the key and the list say exactly the same thing, and the effect re-runs
  // only when a caller genuinely changes which events it cares about.
  const kinds = events.join(",");

  useEffect(() => {
    const unsubscribe = subscribe(kinds.split(","), () => callback.current());
    const timer = setInterval(() => callback.current(), fallbackMs);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [subscribe, kinds, fallbackMs]);
}
