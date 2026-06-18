"use client";

import { useApp } from "@/lib/context";
import { ToastContainer } from "./ToastContainer";

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { darkMode } = useApp();
  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-background text-foreground">
        {children}
        <ToastContainer />
      </div>
    </div>
  );
}
