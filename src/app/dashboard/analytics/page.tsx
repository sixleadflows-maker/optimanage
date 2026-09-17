import Link from "next/link";
import { Lock } from "lucide-react";
import { getAnalyticsData } from "@/lib/data";
import { auth } from "@/lib/auth";
import { AnalyticsClient } from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await auth();
  // Profit, cost and stock value are the owner's figures. Managers and cashiers
  // don't get here even with the PIN.
  if (session?.user?.role !== "OWNER") {
    return (
      <div className="flex items-center justify-center py-24 px-4">
        <div className="glass-card p-8 max-w-sm text-center animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4">
            <Lock className="w-5 h-5 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold font-display">Owner only</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Analytics shows profit, costs and stock value, so it&apos;s limited to the shop owner&apos;s account.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex mt-5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const data = await getAnalyticsData();
  return <AnalyticsClient data={data} />;
}
