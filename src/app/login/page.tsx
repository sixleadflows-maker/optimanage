"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Store, Eye, EyeOff } from "lucide-react";
import { LensLoader } from "@/components/ui/LensLoader";
import { useApp } from "@/lib/context";

const SLIDES = [
  {
    heading: "Run the whole shop from one screen",
    body: "Inventory, POS, prescriptions, and lab orders — all in one place.",
    stats: [
      { label: "Products Tracked", value: "2,400+" },
      { label: "Daily Invoices", value: "35–50" },
    ],
  },
  {
    heading: "Real profit on every prescription",
    body: "Lens, lab, and fitting costs are tracked per order — not guessed at month end.",
    stats: [
      { label: "Branches Managed", value: "Multi" },
      { label: "Job Costing", value: "Live" },
    ],
  },
  {
    heading: "Your customers, remembered",
    body: "Phone search, visit history, and prescriptions on file for every visit.",
    stats: [
      { label: "Customer Records", value: "8,000+" },
      { label: "Return Visits", value: "Tracked" },
    ],
  },
];

function LoginCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 4800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full max-w-md overflow-hidden">
      <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {SLIDES.map((slide) => (
          <div key={slide.heading} className="w-full flex-shrink-0 pr-1">
            <h1 className="text-4xl font-bold mb-4 tracking-tight font-display">{slide.heading}</h1>
            <p className="text-xl text-white/80 leading-relaxed">{slide.body}</p>
            <div className="mt-12 grid grid-cols-2 gap-6">
              {slide.stats.map((stat) => (
                <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <p className="text-2xl font-bold font-display">{stat.value}</p>
                  <p className="text-sm text-white/70 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-10 text-white">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.heading}
            onClick={() => setIndex(i)}
            aria-label={`Show slide ${i + 1}`}
            className={`carousel-dot ${i === index ? "on" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setShowWelcome } = useApp();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

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
    // Show the welcome overlay (rendered at the app root, so it survives the
    // route change) and navigate immediately — the overlay covers the
    // transition instead of racing it, so the login form never flashes back.
    setShowWelcome(true);
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
          <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase mb-3">OptiManage</p>
          <LoginCarousel />
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
                placeholder="name@nooroptics.pk"
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
                  placeholder="••••••••"
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
              {loading && <LensLoader light />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground mt-6">
            Staff access only · Contact your manager for an account
          </p>
        </div>
      </div>
    </div>
  );
}
