import { currentUserId } from "@/lib/auth";
import { subscribe, type JCEvent } from "@/lib/events";

// Server-Sent Events stream of live updates for the signed-in user. The client
// (chat + the global notifier) opens an EventSource here instead of polling.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const uid = await currentUserId();
  if (!uid) return new Response("unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* stream already closed */
        }
      };

      enqueue(": connected\n\n");

      const send = (e: JCEvent) =>
        enqueue(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
      unsubscribe = subscribe(uid, send);

      // Comment pings keep proxies from closing an idle connection.
      keepAlive = setInterval(() => enqueue(": ping\n\n"), 25000);

      // Tidy up if the client disconnects.
      req.signal.addEventListener("abort", () => {
        unsubscribe();
        if (keepAlive) clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsubscribe();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
