"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEventStream } from "./useEventStream";
import type { JCEvent } from "@/lib/events";

// App-wide live notifications. Listens to the SSE stream and surfaces new
// matches and messages as in-app toasts (always) plus native browser
// notifications (when the user has granted permission). Mounted once in the
// root layout so it works on every screen.

type Toast = {
  key: number;
  title: string;
  body: string;
  href: string;
};

export function LiveNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Best-effort: ask once for native notification permission.
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const pushToast = useCallback((t: Omit<Toast, "key">) => {
    const key = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, key }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.key !== key));
    }, 6000);
  }, []);

  const notify = useCallback(
    (title: string, body: string, href: string) => {
      pushToast({ title, body, href });
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(title, { body, tag: href });
          n.onclick = () => {
            window.focus();
            router.push(href);
            n.close();
          };
        } catch {
          /* some browsers throw if constructed outside a SW — toast still shows */
        }
      }
    },
    [pushToast, router],
  );

  const onEvent = useCallback(
    (e: JCEvent) => {
      const href = `/matches/${e.matchId}`;
      if (e.type === "match") {
        notify("you matched ☕", `${e.withName} said yes too. plan your coffee →`, href);
        return;
      }
      // Don't buzz someone for a chat they're already looking at.
      const onThisChat = pathname === href && document.visibilityState === "visible";
      if (e.type === "message" && !onThisChat) {
        notify(`${e.fromName}`, e.preview, href);
      }
    },
    [notify, pathname],
  );

  useEventStream(onEvent);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.key}
          onClick={() => {
            router.push(t.href);
            setToasts((prev) => prev.filter((x) => x.key !== t.key));
          }}
          className="pointer-events-auto w-full max-w-sm animate-sheet-up rounded-2xl border border-tan/40 bg-[#FBF7EC] px-4 py-3 text-left shadow-card transition active:scale-[0.99]"
        >
          <p className="text-sm font-bold text-ink">{t.title}</p>
          <p className="truncate text-sm text-ink/65">{t.body}</p>
        </button>
      ))}
    </div>
  );
}
