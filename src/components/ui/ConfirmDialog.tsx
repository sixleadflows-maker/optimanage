"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

/**
 * The one confirmation box for deleting things. `requireText` makes the user
 * type a word first — kept for actions that can't be undone.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Move to Trash",
  tone = "danger",
  requireText,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "default";
  requireText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ready = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();
  const danger = tone === "danger";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && onCancel()}>
      <div className="glass-modal p-6 w-full max-w-md animate-rise" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            {requireText ? <AlertTriangle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{title}</h3>
            <div className="text-sm text-muted-foreground mt-1">{message}</div>
          </div>
        </div>

        {requireText && (
          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Type <span className="font-mono font-semibold text-foreground">{requireText}</span> to confirm
            </label>
            <input
              type="text" value={typed} autoFocus onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ready && !busy && onConfirm()}
              className="w-full px-3 py-2.5 glass-input text-sm"
            />
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onCancel} disabled={busy} className="flex-1 py-2.5 glass-card text-sm font-medium cursor-pointer disabled:opacity-60">
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={busy || !ready} autoFocus={!requireText}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer ${
              danger ? "bg-destructive hover:opacity-90" : "bg-primary hover:bg-primary-hover"
            }`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
