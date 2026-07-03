"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/context";
import { SHOP_NAME } from "@/lib/constants";

export function LoginIntro({ onDone }: { onDone: () => void }) {
  const { darkMode } = useApp();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(onDone, reduced ? 0 : 4800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`login-intro ${darkMode ? "dark" : ""}`} role="status" aria-label="Logged in, loading OptiManage">
      <span className="welcome-blob b1" aria-hidden="true" />
      <span className="welcome-blob b2" aria-hidden="true" />

      <div className="welcome-content">
        <div className="welcome-mark">
          <div className="welcome-mark-ring" />
        </div>

        <h1 className="welcome-title">Welcome back</h1>
        <p className="welcome-sub">{SHOP_NAME}</p>

        <div className="welcome-progress">
          <div className="welcome-progress-fill">
            <span className="welcome-progress-sheen" />
          </div>
        </div>

        <div className="welcome-status">
          <span className="welcome-status-line p1">Loading inventory</span>
          <span className="welcome-status-line p2">Syncing prescriptions</span>
          <span className="welcome-status-line p3">Preparing your dashboard</span>
          <span className="welcome-status-line p4">
            <span className="welcome-check"><span /><span /></span>
            All set — opening dashboard
          </span>
        </div>
      </div>
    </div>
  );
}
