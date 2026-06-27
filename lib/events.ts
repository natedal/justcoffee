// In-process pub/sub used to push live updates (new messages, new matches) to
// connected clients over Server-Sent Events. This replaces the old polling
// chat. It's a single-instance bus that survives Next.js dev hot-reloads via
// globalThis. To scale to multiple instances, swap this module for Redis
// pub/sub (or Postgres LISTEN/NOTIFY) — the publish/subscribe surface is the
// only thing call sites depend on.

export type JCEvent =
  | {
      type: "message";
      matchId: string;
      fromName: string;
      preview: string;
      at: number;
    }
  | { type: "match"; matchId: string; withName: string; at: number };

type Subscriber = (e: JCEvent) => void;

const g = globalThis as unknown as {
  __jc_bus?: Map<string, Set<Subscriber>>;
};

function bus(): Map<string, Set<Subscriber>> {
  if (!g.__jc_bus) g.__jc_bus = new Map();
  return g.__jc_bus;
}

/** Subscribe a user's connection to their event stream. Returns an unsubscribe. */
export function subscribe(userId: string, fn: Subscriber): () => void {
  const b = bus();
  let set = b.get(userId);
  if (!set) {
    set = new Set();
    b.set(userId, set);
  }
  set.add(fn);
  return () => {
    const s = b.get(userId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) b.delete(userId);
  };
}

/** Push an event to every live connection a user has open. No-op if offline. */
export function publish(userId: string, event: JCEvent): void {
  const set = bus().get(userId);
  if (!set) return;
  for (const fn of [...set]) {
    try {
      fn(event);
    } catch {
      /* a dead connection shouldn't break the others */
    }
  }
}
