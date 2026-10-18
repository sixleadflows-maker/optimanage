import Link from "next/link";
import { Lock } from "lucide-react";
import { getPayroll } from "@/lib/data";
import { auth } from "@/lib/auth";
import { isMonthKey, monthKey } from "@/lib/salaries";
import { SalariesClient } from "./SalariesClient";

export const dynamic = "force-dynamic";

export default async function SalariesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  // What each person earns is the owner's business, like Analytics.
  if (session?.user?.role !== "OWNER") {
    return (
      <div className="flex items-center justify-center py-24 px-4">
        <div className="glass-card p-8 max-w-sm text-center animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold font-display">Owner only</h1>
          <p className="text-sm text-muted-foreground mt-2">Salaries show what each person is paid, so they&apos;re limited to the shop owner&apos;s account.</p>
          <Link href="/dashboard"
            className="inline-flex mt-5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { month: asked } = await searchParams;
  const month = asked && isMonthKey(asked) ? asked : monthKey(new Date());
  const employees = await getPayroll(month);
  return <SalariesClient key={month} month={month} employees={employees} />;
}
