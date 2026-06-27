"use client";

import { useEffect, useRef } from "react";
import type { JCEvent } from "@/lib/events";

// Subscribes to the server's live event stream (SSE). Keeps a single stable
// connection open and always calls the latest handler. EventSource reconnects
// on its own if the connection drops, so there's no polling fallback to manage.
export function useEventStream(
  onEvent: (e: JCEvent) => void,
  enabled = true,
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    const es = new EventSource("/api/stream");
    const onMessage = (ev: MessageEvent) => {
      try {
        handlerRef.current(JSON.parse(ev.data) as JCEvent);
      } catch {
        /* ignore malformed frames */
      }
    };
    es.addEventListener("message", onMessage);
    es.addEventListener("match", onMessage);

    return () => {
      es.removeEventListener("message", onMessage);
      es.removeEventListener("match", onMessage);
      es.close();
    };
  }, [enabled]);
}
