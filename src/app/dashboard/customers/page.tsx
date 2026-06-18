"use client";

import { useState, useMemo } from "react";
import { customers } from "@/lib/mock";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Search, Users } from "lucide-react";
import Link from "next/link";

export default function CustomersPage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{customers.length} customers registered</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 glass-card text-sm">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-medium">{customers.length}</span>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by name, phone, or email..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 glass-input text-sm" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Phone</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-left py-3 px-3 text-xs font-medium text-muted-foreground">Last Visit</th>
                <th className="text-right py-3 px-3 text-xs font-medium text-muted-foreground">Total Spend</th>
                <th className="text-center py-3 px-3 text-xs font-medium text-muted-foreground">Prescriptions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-surface-hover/50 transition-colors">
                  <td className="py-3 px-3">
                    <Link href={`/dashboard/customers/${c.id}`} className="flex items-center gap-3 hover:text-primary">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                        {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="font-medium">{c.name}</span>
                    </Link>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">{c.phone}</td>
                  <td className="py-3 px-3 text-muted-foreground text-xs">{c.email}</td>
                  <td className="py-3 px-3 text-muted-foreground">{formatDate(c.lastVisit)}</td>
                  <td className="py-3 px-3 text-right font-medium">{formatCurrency(c.totalSpend)}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="chip bg-primary/10 text-primary">{c.prescriptions.length}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
