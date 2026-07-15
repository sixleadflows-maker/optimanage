import type { Metadata } from "next";
import { Geist, Geist_Mono, Manrope } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/context";
import { ThemeWrapper } from "@/components/layout/ThemeWrapper";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "OptiManage - Optical Store Management",
  description: "Modern optical store management system for EyeSpy — inventory, POS, prescriptions, lab orders & WhatsApp CRM",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "OptiManage — Optical Store Management",
    description: "All-in-one optical store management: inventory, POS, prescriptions, lab orders, WhatsApp CRM & analytics.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <AppProvider>
          <ThemeWrapper>{children}</ThemeWrapper>
        </AppProvider>
      </body>
    </html>
  );
}
