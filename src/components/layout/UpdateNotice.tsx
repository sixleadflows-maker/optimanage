"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const BUILT = process.env.NEXT_PUBLIC_BUILD_VERSION ?? "local";
const OUTDATED_EVENT = "optimanage:outdated";

/**
 * Call when the server turns down a request because this page comes from an
 * older release (Next's "unrecognized action" error): the notice comes up at
 * once instead of at the next check.
 */
export function reportOutdatedPage() {
  window.dispatchEvent(new Event(OUTDATED_EVENT));
}

/**
 * A page left open across a release keeps running the old code, and the server
 * may stop recognising what it sends -- searches and saves then fail until the
 * page is refreshed. This notices the newer release and says so. It never
 * refreshes by itself: there may be a bill half rung up on the till.
 */
export function UpdateNotice() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible" || navigator.onLine === false) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (!stopped && version && version !== BUILT) setReady(true);
      } catch {
        // No connection: nothing to compare against yet.
      }
    };
    const flag = () => setReady(true);
    const timer = setInterval(check, 5 * 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    window.addEventListener(OUTDATED_EVENT, flag);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      window.removeEventListener(OUTDATED_EVENT, flag);
    };
  }, [ready]);

  if (!ready) return null;
  return (
    <div className="no-print fixed bottom-4 inset-x-4 mx-auto z-[80] max-w-md topbar-popover rounded-2xl p-3 flex items-center gap-3 animate-rise">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">The system has been updated</p>
        <p className="text-[11px] text-muted-foreground">
          Refresh this page to keep searching and saving. Finish the bill you&apos;re on first — refreshing clears it.
        </p>
      </div>
      <button onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer flex-shrink-0">
        <RefreshCw className="w-3.5 h-3.5" /> Refresh
      </button>
    </div>
  );
}
