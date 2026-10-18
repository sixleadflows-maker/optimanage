"use server";

import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { paymentsOnDays } from "@/lib/sales/received";

export async function verifyAnalyticsPin(pin: string): Promise<{ ok: boolean }> {
  const session = await auth();
  // Profit, costs and stock value are the owner's alone — the PIN is the second
  // lock, not the only one, so a manager who learns it still can't get in.
  if (session?.user?.role !== "OWNER") return { ok: false };
  const settings = await db.shopSettings.findUnique({ where: { id: "default" } });
  if (!settings?.analyticsPin) return { ok: true }; // no PIN configured → owner passes
  const valid = await compare(pin, settings.analyticsPin);
  return { ok: valid };
}

export interface MonthlyAnalyticsData {
  year: number;
  month: number; // 1-12
  totalSales: number;
  totalOrders: number;
  totalCost: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  avgOrderValue: number;
  dailyTrend: { label: string; value: number }[];
  topBrands: { label: string; value: number }[];
  prevMonthSales: number;
  prevMonthOrders: number;
  prevMonthNetProfit: number;
  // Day by day, newest first: the payments made that day (each on the day it was
  // paid, whatever day its invoice is from), the profit on them, and how many
  // invoices were made.
  days: MonthDay[];
}

export interface MonthDay {
  date: string;
  sales: number;
  profit: number;
  invoices: number;
  payments: {
    invoiceNo: string;
    customer: string;
    amount: number;
    profit: number;
    method: string;
    // Paid on an invoice made on an earlier day.
    earlier: boolean;
  }[];
}

export async function getMonthlyAnalytics(year: number, month: number): Promise<MonthlyAnalyticsData> {
  const session = await auth();
  if (session?.user?.role !== "OWNER") throw new Error("Unauthorized");

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1));
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
  const thisMonth = { gte: start, lt: end };
  const lastMonth = { gte: prevStart, lt: start };

  // Invoices made in the month, and older ones that were paid on in it.
  const [products, sales, prevSales, expenses, prevExpenses, salaryPay, prevSalaryPay] = await Promise.all([
    db.product.findMany({ where: { active: true } }),
    db.sale.findMany({
      where: { OR: [{ date: thisMonth }, { payments: { some: { date: thisMonth } } }] },
      include: {
        items: true,
        payments: { select: { amount: true, date: true, method: true } },
        customer: { select: { name: true, phone: true } },
      },
    }),
    db.sale.findMany({
      where: { OR: [{ date: lastMonth }, { payments: { some: { date: lastMonth } } }] },
      include: { payments: { select: { amount: true, date: true } } },
    }),
    db.expense.findMany({ where: { date: thisMonth } }),
    db.expense.findMany({ where: { date: lastMonth } }),
    // Salary handed over in the month is a cost too (a cut moves no money).
    db.salaryEntry.aggregate({ where: { date: thisMonth, kind: { not: "DEDUCTION" } }, _sum: { amount: true } }),
    db.salaryEntry.aggregate({ where: { date: lastMonth, kind: { not: "DEDUCTION" } }, _sum: { amount: true } }),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const within = (d: Date, from: Date, to: Date) => d >= from && d < to;
  const dayOf = (d: Date) => d.toISOString().slice(0, 10);

  const brands: Record<string, number> = {};
  const byDay = new Map<string, MonthDay>();
  const dayRow = (date: string) => {
    let row = byDay.get(date);
    if (!row) { row = { date, sales: 0, profit: 0, invoices: 0, payments: [] }; byDay.set(date, row); }
    return row;
  };
  let totalSales = 0;
  let grossProfit = 0;
  let invoiced = 0;
  let totalOrders = 0;

  for (const s of sales) {
    const madeInMonth = within(s.date, start, end);
    if (madeInMonth) {
      totalOrders++;
      invoiced += s.total;
      dayRow(dayOf(s.date)).invoices++;
      s.items.forEach((it) => {
        // Typed-in items (no productId) have no brand to attribute.
        const p = it.productId ? productById.get(it.productId) : undefined;
        if (p) brands[p.brand] = (brands[p.brand] || 0) + it.total;
      });
    }
    const customer = s.customer ? s.customer.name.trim() || s.customer.phone || "No name yet" : "Walk-in";
    const paidOn = paymentsOnDays({
      dateTime: s.date, total: s.total, profit: s.profit, paid: s.paid, paymentMethod: s.paymentMethod, payments: s.payments,
    });
    for (const p of paidOn) {
      if (!within(p.date, start, end)) continue;
      totalSales += p.amount;
      grossProfit += p.profit;
      const row = dayRow(dayOf(p.date));
      row.sales += p.amount;
      row.profit += p.profit;
      row.payments.push({
        invoiceNo: s.invoiceNo, customer, amount: p.amount, profit: p.profit, method: p.method,
        earlier: dayOf(s.date) < dayOf(p.date),
      });
    }
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0) + (salaryPay._sum.amount ?? 0);
  const netProfit = grossProfit - totalExpenses;
  const days = [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));

  const dailyTrend = [...days]
    .reverse()
    .filter((d) => d.sales !== 0)
    .map((d) => ({
      label: new Date(d.date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" }),
      value: d.sales,
    }));

  const topBrands = Object.entries(brands)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  let prevMonthSales = 0;
  let prevMonthGrossProfit = 0;
  for (const s of prevSales) {
    for (const p of paymentsOnDays({ dateTime: s.date, total: s.total, profit: s.profit, paid: s.paid, payments: s.payments })) {
      if (!within(p.date, prevStart, start)) continue;
      prevMonthSales += p.amount;
      prevMonthGrossProfit += p.profit;
    }
  }
  const prevMonthExpenses = prevExpenses.reduce((sum, e) => sum + e.amount, 0) + (prevSalaryPay._sum.amount ?? 0);

  return {
    year, month,
    totalSales, totalOrders, totalCost: totalSales - grossProfit, grossProfit, totalExpenses, netProfit,
    avgOrderValue: totalOrders > 0 ? invoiced / totalOrders : 0,
    dailyTrend, topBrands,
    prevMonthSales,
    prevMonthOrders: prevSales.filter((s) => within(s.date, prevStart, start)).length,
    prevMonthNetProfit: prevMonthGrossProfit - prevMonthExpenses,
    days,
  };
}
