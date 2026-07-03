"use client";

import { useState } from "react";

type ThemeKey = "saas" | "premium" | "vibrant" | "minimal";

interface Theme {
  name: string;
  tagline: string;
  vars: Record<string, string>;
  sidebarDark: boolean;
  headingSerif: boolean;
  kpiColorful: boolean;
  pageBg: string;
}

const THEMES: Record<ThemeKey, Theme> = {
  saas: {
    name: "Modern SaaS",
    tagline: "Linear / Vercel — crisp, minimal, fast",
    sidebarDark: true,
    headingSerif: false,
    kpiColorful: false,
    pageBg: "#f6f7f9",
    vars: {
      "--bg": "#f6f7f9", "--panel": "#0e1116", "--panelText": "#c7cdd6", "--card": "#ffffff",
      "--text": "#0b1220", "--muted": "#6b7280", "--accent": "#4f46e5", "--accent2": "#818cf8",
      "--border": "#e6e8ec", "--radius": "12px", "--font": "'Inter', system-ui, sans-serif",
      "--heading": "'Inter', system-ui, sans-serif", "--shadow": "0 1px 2px rgba(2,6,23,.05), 0 10px 30px rgba(2,6,23,.05)",
    },
  },
  premium: {
    name: "Premium optical",
    tagline: "Dark + gold — luxe, editorial boutique",
    sidebarDark: true,
    headingSerif: true,
    kpiColorful: false,
    pageBg: "#0d0d10",
    vars: {
      "--bg": "#0d0d10", "--panel": "#121217", "--panelText": "#b7ad96", "--card": "#17171d",
      "--text": "#f3eee2", "--muted": "#9d9484", "--accent": "#d4af37", "--accent2": "#e8cf8f",
      "--border": "#26262f", "--radius": "10px", "--font": "'Inter', system-ui, sans-serif",
      "--heading": "'Playfair Display', Georgia, serif", "--shadow": "0 16px 40px rgba(0,0,0,.5)",
    },
  },
  vibrant: {
    name: "Bold & vibrant",
    tagline: "Colorful gradients, big type, energetic",
    sidebarDark: false,
    headingSerif: false,
    kpiColorful: true,
    pageBg: "linear-gradient(135deg, #f4f0ff 0%, #fef1f7 50%, #fff5ec 100%)",
    vars: {
      "--bg": "transparent", "--panel": "#ffffff", "--panelText": "#4b3b6b", "--card": "#ffffff",
      "--text": "#1c1230", "--muted": "#8b7ba6", "--accent": "#8b3ff0", "--accent2": "#ff477e",
      "--border": "#efe6fb", "--radius": "20px", "--font": "'Poppins', system-ui, sans-serif",
      "--heading": "'Poppins', system-ui, sans-serif", "--shadow": "0 12px 40px rgba(139,63,240,.14)",
    },
  },
  minimal: {
    name: "Apple-like minimal",
    tagline: "Whitespace, soft glass, calm & premium",
    sidebarDark: false,
    headingSerif: false,
    kpiColorful: false,
    pageBg: "linear-gradient(180deg, #fbfbfd 0%, #f2f4f8 100%)",
    vars: {
      "--bg": "transparent", "--panel": "rgba(255,255,255,.72)", "--panelText": "#43454a", "--card": "rgba(255,255,255,.7)",
      "--text": "#1d1d1f", "--muted": "#86868b", "--accent": "#0071e3", "--accent2": "#5ea9ff",
      "--border": "rgba(0,0,0,.07)", "--radius": "18px", "--font": "'Inter', -apple-system, system-ui, sans-serif",
      "--heading": "'Inter', -apple-system, system-ui, sans-serif", "--shadow": "0 12px 44px rgba(0,0,0,.07)",
    },
  },
};

const NAV = [
  { label: "Dashboard", icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z", active: true },
  { label: "New Sale (POS)", icon: "M3 3h2l2 12h11l2-8H6" },
  { label: "Inventory", icon: "M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7" },
  { label: "Customers", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8" },
  { label: "Analytics", icon: "M3 3v18h18M7 15l3-4 4 3 5-7" },
];

const KPIS = [
  { label: "Today's Sales", value: "Rs 48,500", delta: "+12%", up: true, tint: "#4f46e5" },
  { label: "Invoices", value: "37", delta: "+3", up: true, tint: "#0ea5e9" },
  { label: "Outstanding", value: "Rs 12,400", delta: "-8%", up: false, tint: "#f59e0b" },
  { label: "Low Stock", value: "5 items", delta: "review", up: false, tint: "#ef4444" },
];

const BRANDS = [
  { name: "Ray-Ban", v: 92 }, { name: "Oakley", v: 74 }, { name: "Gucci", v: 61 },
  { name: "Titan", v: 48 }, { name: "Essilor", v: 35 },
];

const RECENT = [
  { name: "Ahmed Khan", inv: "INV-2026-041", amt: "Rs 7,500", status: "Paid" },
  { name: "Ayesha Malik", inv: "INV-2026-040", amt: "Rs 21,500", status: "Advance" },
  { name: "Usman Ali", inv: "INV-2026-039", amt: "Rs 3,200", status: "Paid" },
  { name: "Sana Sheikh", inv: "INV-2026-038", amt: "Rs 9,800", status: "Balance" },
];

export default function DesignShowcase() {
  const [themeKey, setThemeKey] = useState<ThemeKey>("saas");
  const t = THEMES[themeKey];

  return (
    <div className="dz" style={{ ...t.vars, background: t.pageBg } as React.CSSProperties}>
      <style>{CSS}</style>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <div className="dz-switch">
        <span className="dz-switch-label">Preview theme:</span>
        {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
          <button key={k} onClick={() => setThemeKey(k)} className={`dz-pill ${themeKey === k ? "on" : ""}`}>
            {THEMES[k].name}
          </button>
        ))}
      </div>
      <p className="dz-tagline">{t.tagline}</p>

      <div className="dz-app" key={themeKey}>
        <aside className="dz-side" data-dark={t.sidebarDark}>
          <div className="dz-brand">
            <div className="dz-logo">◎</div>
            <span>OptiManage</span>
          </div>
          <nav>
            {NAV.map((n) => (
              <a key={n.label} className={`dz-nav ${n.active ? "on" : ""}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={n.icon} /></svg>
                {n.label}
              </a>
            ))}
          </nav>
          <div className="dz-side-foot">
            <div className="dz-ava">AM</div>
            <div><p>Dr. Asif Mahmood</p><span>Owner</span></div>
          </div>
        </aside>

        <div className="dz-main">
          <header className="dz-top">
            <div className="dz-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg><span>Search products, customers, invoices…</span></div>
            <div className="dz-top-right">
              <span className="dz-online">● Online</span>
              <div className="dz-ava sm">AM</div>
            </div>
          </header>

          <div className="dz-content">
            <div className="dz-titlerow">
              <div>
                <h1 style={{ fontFamily: "var(--heading)" }}>Dashboard</h1>
                <p>Overview of your optical store performance</p>
              </div>
              <button className="dz-cta">New Sale</button>
            </div>

            <div className="dz-kpis">
              {KPIS.map((k, i) => (
                <div className="dz-kpi reveal" style={{ animationDelay: `${i * 60}ms` }} key={k.label}>
                  {t.kpiColorful && <span className="dz-kpi-bar" style={{ background: k.tint }} />}
                  <div className="dz-kpi-top">
                    <span className="dz-kpi-dot" style={{ background: t.kpiColorful ? k.tint : "var(--accent)" }} />
                    <span className={`dz-delta ${k.up ? "up" : "down"}`}>{k.delta}</span>
                  </div>
                  <p className="dz-kpi-val" style={{ fontFamily: "var(--heading)" }}>{k.value}</p>
                  <p className="dz-kpi-label">{k.label}</p>
                </div>
              ))}
            </div>

            <div className="dz-grid2">
              <div className="dz-card reveal" style={{ animationDelay: "120ms" }}>
                <h3>Sales Trend</h3>
                <svg className="dz-chart" viewBox="0 0 520 200" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="dzfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon className="dz-area" points="20,150 90,120 160,135 230,80 300,95 370,55 440,70 500,35 500,185 20,185" fill="url(#dzfill)" />
                  <polyline className="dz-line" points="20,150 90,120 160,135 230,80 300,95 370,55 440,70 500,35" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="dz-card reveal" style={{ animationDelay: "180ms" }}>
                <h3>Top Brands</h3>
                <div className="dz-bars">
                  {BRANDS.map((b, i) => (
                    <div className="dz-bar-row" key={b.name}>
                      <span className="dz-bar-label">{b.name}</span>
                      <div className="dz-bar-track"><div className="dz-bar-fill" style={{ "--w": `${b.v}%`, animationDelay: `${300 + i * 90}ms` } as React.CSSProperties} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="dz-card reveal" style={{ animationDelay: "240ms" }}>
              <h3>Recent Sales</h3>
              <div className="dz-list">
                {RECENT.map((r) => (
                  <div className="dz-list-row" key={r.inv}>
                    <div className="dz-list-left">
                      <div className="dz-ava sm">{r.name.split(" ").map((w) => w[0]).join("")}</div>
                      <div><p>{r.name}</p><span>{r.inv}</span></div>
                    </div>
                    <div className="dz-list-right">
                      <p>{r.amt}</p>
                      <span className={`dz-chip ${r.status.toLowerCase()}`}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.dz{min-height:100vh;padding:20px 22px 60px;font-family:var(--font);color:var(--text);}
.dz *{box-sizing:border-box;}
.dz-switch{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;}
.dz-switch-label{font-size:13px;color:var(--muted);margin-right:4px;}
.dz-pill{border:1px solid var(--border);background:var(--card);color:var(--text);padding:7px 14px;border-radius:999px;font-size:13px;font-weight:500;cursor:pointer;font-family:var(--font);transition:all .2s;}
.dz-pill:hover{transform:translateY(-1px);}
.dz-pill.on{background:var(--accent);color:#fff;border-color:var(--accent);}
.dz-tagline{font-size:13px;color:var(--muted);margin:0 0 18px;}
.dz-app{display:flex;border-radius:calc(var(--radius) + 6px);overflow:hidden;box-shadow:var(--shadow);border:1px solid var(--border);min-height:640px;background:var(--bg);}
.dz-side{width:230px;flex-shrink:0;background:var(--panel);padding:20px 14px;display:flex;flex-direction:column;gap:6px;}
.dz-side[data-dark="true"]{color:var(--panelText);}
.dz-side[data-dark="false"]{color:var(--panelText);border-right:1px solid var(--border);}
.dz-brand{display:flex;align-items:center;gap:10px;padding:4px 8px 18px;font-weight:600;font-size:16px;color:#fff;}
.dz-side[data-dark="false"] .dz-brand{color:var(--text);}
.dz-logo{width:30px;height:30px;border-radius:9px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;}
.dz-nav{display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:11px;font-size:13.5px;font-weight:500;cursor:pointer;color:inherit;opacity:.72;transition:all .18s;}
.dz-nav svg{width:17px;height:17px;flex-shrink:0;}
.dz-nav:hover{opacity:1;background:rgba(125,125,155,.12);}
.dz-nav.on{opacity:1;background:var(--accent);color:#fff;}
.dz-side-foot{margin-top:auto;display:flex;align-items:center;gap:10px;padding:10px 8px 2px;}
.dz-side-foot p{margin:0;font-size:12.5px;font-weight:500;color:inherit;}
.dz-side-foot span{font-size:11px;opacity:.6;}
.dz-ava{width:34px;height:34px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;}
.dz-ava.sm{width:30px;height:30px;font-size:11px;}
.dz-main{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--bg);}
.dz-top{height:60px;display:flex;align-items:center;gap:14px;padding:0 22px;border-bottom:1px solid var(--border);}
.dz-search{flex:1;max-width:420px;display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--border);border-radius:11px;padding:9px 13px;color:var(--muted);font-size:13px;}
.dz-search svg{width:16px;height:16px;}
.dz-top-right{margin-left:auto;display:flex;align-items:center;gap:14px;}
.dz-online{font-size:12px;color:#16a34a;font-weight:500;}
.dz-content{padding:24px 22px;display:flex;flex-direction:column;gap:18px;}
.dz-titlerow{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;}
.dz-titlerow h1{margin:0;font-size:26px;font-weight:700;letter-spacing:-.02em;}
.dz-titlerow p{margin:3px 0 0;font-size:13.5px;color:var(--muted);}
.dz-cta{background:var(--accent);color:#fff;border:none;padding:10px 18px;border-radius:var(--radius);font-size:13.5px;font-weight:600;cursor:pointer;font-family:var(--font);}
.dz-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
.dz-kpi{position:relative;background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px 16px 15px;overflow:hidden;}
.dz-kpi-bar{position:absolute;left:0;top:0;bottom:0;width:4px;}
.dz-kpi-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.dz-kpi-dot{width:30px;height:30px;border-radius:9px;opacity:.16;}
.dz-delta{font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:999px;}
.dz-delta.up{color:#16a34a;background:rgba(22,163,74,.1);}
.dz-delta.down{color:#dc2626;background:rgba(220,38,38,.1);}
.dz-kpi-val{margin:0;font-size:23px;font-weight:700;letter-spacing:-.02em;}
.dz-kpi-label{margin:3px 0 0;font-size:12.5px;color:var(--muted);}
.dz-grid2{display:grid;grid-template-columns:1.7fr 1fr;gap:14px;}
.dz-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:18px 18px 20px;}
.dz-card h3{margin:0 0 16px;font-size:14.5px;font-weight:600;}
.dz-chart{width:100%;height:190px;display:block;}
.dz-line{stroke-dasharray:900;stroke-dashoffset:900;animation:dzdraw 1.6s ease-out forwards;}
.dz-area{opacity:0;animation:dzfade .9s ease-out .7s forwards;}
.dz-bars{display:flex;flex-direction:column;gap:13px;}
.dz-bar-row{display:flex;align-items:center;gap:12px;}
.dz-bar-label{width:72px;font-size:12.5px;color:var(--muted);text-align:right;flex-shrink:0;}
.dz-bar-track{flex:1;height:9px;background:rgba(125,125,155,.13);border-radius:999px;overflow:hidden;}
.dz-bar-fill{height:100%;background:var(--accent);border-radius:999px;width:0;animation:dzbar 1s cubic-bezier(.2,.8,.2,1) forwards;}
.dz-list{display:flex;flex-direction:column;}
.dz-list-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border);}
.dz-list-row:last-child{border-bottom:none;}
.dz-list-left{display:flex;align-items:center;gap:12px;}
.dz-list-left p{margin:0;font-size:13.5px;font-weight:500;}
.dz-list-left span{font-size:11.5px;color:var(--muted);}
.dz-list-right{text-align:right;}
.dz-list-right p{margin:0;font-size:13.5px;font-weight:600;}
.dz-chip{display:inline-block;margin-top:3px;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:999px;}
.dz-chip.paid{color:#16a34a;background:rgba(22,163,74,.12);}
.dz-chip.advance{color:#d97706;background:rgba(217,119,6,.12);}
.dz-chip.balance{color:#dc2626;background:rgba(220,38,38,.12);}
.reveal{opacity:0;transform:translateY(10px);animation:dzrise .5s cubic-bezier(.2,.8,.2,1) forwards;}
@keyframes dzrise{to{opacity:1;transform:none;}}
@keyframes dzdraw{to{stroke-dashoffset:0;}}
@keyframes dzfade{to{opacity:1;}}
@keyframes dzbar{to{width:var(--w,60%);}}
@media(max-width:860px){.dz-kpis{grid-template-columns:repeat(2,1fr);}.dz-grid2{grid-template-columns:1fr;}.dz-side{display:none;}}
`;
