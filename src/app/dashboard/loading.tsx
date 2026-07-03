export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <div className="skeleton h-7 w-44" />
        <div className="skeleton h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <div className="skeleton h-9 w-9 rounded-xl" />
            <div className="skeleton h-7 w-24" />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-5 space-y-4">
          <div className="skeleton h-4 w-28" />
          <div className="skeleton h-56 w-full rounded-xl" />
        </div>
        <div className="glass-card p-5 space-y-4">
          <div className="skeleton h-4 w-32" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-5 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
