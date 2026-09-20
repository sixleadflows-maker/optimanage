"use client";

import { useEffect } from "react";

/** Registers /sw.js so the till keeps working when the internet drops. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Not during development: a worker serving kept pages fights hot reload.
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Without it the app still works; it just can't open while offline.
    });
  }, []);
  return null;
}

/** Drops the pages kept for offline use — they hold the signed-in user's view. */
export async function clearOfflinePages() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    registration?.active?.postMessage("clear-pages");
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("pages-")).map((k) => caches.delete(k)));
  } catch {
    // Nothing kept, or storage unavailable.
  }
}
