"use client";

import { useEffect } from "react";

export function LoginIntro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(onDone, reduced ? 0 : 2700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="login-intro" role="status" aria-label="Logged in, loading OptiManage">
      <div className="login-intro-bg" />

      <div className="login-intro-stage">
        <div className="login-intro-greet">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none">
            <circle cx="32" cy="32" r="28" stroke="url(#introRing)" strokeWidth="3" opacity="0.9" />
            <path className="check-draw" d="M19 33l9 9 17-19" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="introRing" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stopColor="#6d5ef0" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
          </svg>
          <p className="login-intro-greet-text">Logged in</p>
        </div>

        <svg className="login-intro-burst" viewBox="0 0 200 200" width="200" height="200">
          {Array.from({ length: 16 }).map((_, i) => (
            <line
              key={i}
              x1="100" y1="100"
              x2={100 + 92 * Math.cos((i * Math.PI * 2) / 16)}
              y2={100 + 92 * Math.sin((i * Math.PI * 2) / 16)}
              stroke="url(#burstGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ))}
          <defs>
            <linearGradient id="burstGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6d5ef0" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>
          </defs>
        </svg>

        <div className="login-intro-brand">
          <div className="login-intro-mark">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="white" strokeWidth="1.8">
              <circle cx="12" cy="12" r="7.5" />
            </svg>
          </div>
          <h1 className="login-intro-word">NOOR OPTICS</h1>
          <p className="login-intro-tag">Optical Store Management</p>
        </div>
      </div>
    </div>
  );
}
