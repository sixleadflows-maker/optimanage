"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Store, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("asif@nooroptics.pk");
  const [password, setPassword] = useState("owner123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#4c3de0] via-[#6d5ef0] to-[#149f8c] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-60" />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-8">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">OptiManage</h1>
          <p className="text-xl text-white/80 leading-relaxed max-w-md">
            The complete optical store management system. Inventory, sales, prescriptions, and more — all in one place.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-6">
            {[
              { label: "Products Tracked", value: "2,400+" },
              { label: "Daily Invoices", value: "35-50" },
              { label: "Customer Records", value: "8,000+" },
              { label: "Branches Managed", value: "Multi" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-white/70 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm glass-card p-8 animate-rise">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">OptiManage</span>
          </div>

          <h2 className="text-3xl font-bold mb-1 text-gradient">Welcome back</h2>
          <p className="text-muted-foreground text-sm mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 glass-input text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 glass-input text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground mt-6">
            Owner: asif@nooroptics.pk · Manager: rabia@nooroptics.pk · Cashier: waqar@nooroptics.pk
          </p>
        </div>
      </div>
    </div>
  );
}
