"use client";

import { useApp } from "@/lib/context";
import { ToastContainer } from "./ToastContainer";
import { NavigationProgress } from "@/components/ui/NavigationProgress";
import { LoginIntro } from "@/components/ui/LoginIntro";

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const { darkMode, showWelcome, setShowWelcome } = useApp();
  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen app-canvas text-foreground">
        <NavigationProgress />
        {children}
        <ToastContainer />
        {showWelcome && <LoginIntro onDone={() => setShowWelcome(false)} />}
      </div>
    </div>
  );
}
