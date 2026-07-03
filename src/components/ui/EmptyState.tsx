import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6d5ef0]/15 to-[#14b8a6]/15 flex items-center justify-center mb-4">
        {Icon ? (
          <Icon className="w-6 h-6 text-primary" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-6 h-6 text-primary">
            <circle cx="7" cy="14" r="3.4" />
            <circle cx="17" cy="14" r="3.4" />
            <path d="M10.4 14h3.2M3.6 14 2 8m18.4 6L22 8" />
          </svg>
        )}
      </div>
      <p className="text-sm font-semibold font-display">{title}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
