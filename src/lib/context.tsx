"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface AppContextValue {
  activeBranch: string;
  setActiveBranch: (id: string) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  isOnline: boolean;
  toggleOnline: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toasts: Toast[];
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
  showWelcome: boolean;
  setShowWelcome: (show: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeBranch, setActiveBranch] = useState("branch-1");
  const [darkMode, setDarkMode] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);

  const toggleDarkMode = useCallback(() => setDarkMode((d) => !d), []);
  const toggleOnline = useCallback(() => setIsOnline((o) => !o), []);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeBranch, setActiveBranch,
        darkMode, toggleDarkMode,
        isOnline, toggleOnline,
        sidebarOpen, setSidebarOpen,
        toasts, showToast, removeToast,
        showWelcome, setShowWelcome,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
