"use client";

import { useApp } from "@/lib/context";
import { ToastContainer } from "./ToastContainer";
import { NavigationProgress } from "@/components/ui/NavigationProgress";

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { darkMode } = useApp();
  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen app-canvas text-foreground">
        <NavigationProgress />
        {children}
        <ToastContainer />
      </div>
    </div>
  );
}
