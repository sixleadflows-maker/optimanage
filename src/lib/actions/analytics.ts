"use server";

import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function verifyAnalyticsPin(pin: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { ok: false };
  const settings = await db.shopSettings.findUnique({ where: { id: "default" } });
  if (!settings?.analyticsPin) return { ok: true }; // no PIN configured → open
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
}

export async function getMonthlyAnalytics(year: number, month: number): Promise<MonthlyAnalyticsData> {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1));
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevStart = new Date(Date.UTC(prevYear, prevMonth - 1, 1));

  const [products, sales, prevSales, expenses, prevExpenses] = await Promise.all([
    db.product.findMany({ where: { active: true } }),
    db.sale.findMany({ where: { date: { gte: start, lt: end } }, include: { items: true } }),
    db.sale.findMany({ where: { date: { gte: prevStart, lt: start } } }),
    db.expense.findMany({ where: { date: { gte: start, lt: end } } }),
    db.expense.findMany({ where: { date: { gte: prevStart, lt: start } } }),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const brands: Record<string, number> = {};
  const days: Record<string, number> = {};
  let totalCost = 0;

  sales.forEach((s) => {
    const day = s.date.toISOString().slice(0, 10);
    days[day] = (days[day] || 0) + s.total;
    s.items.forEach((it) => {
      const p = productById.get(it.productId);
      if (p) {
        brands[p.brand] = (brands[p.brand] || 0) + it.total;
        totalCost += p.costPrice * it.quantity;
      }
    });
  });

  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const grossProfit = totalSales - totalCost;
  const netProfit = grossProfit - totalExpenses;
  const totalOrders = sales.length;

  const dailyTrend = Object.entries(days)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({
      label: new Date(date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" }),
      value: total,
    }));

  const topBrands = Object.entries(brands)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  const prevMonthSales = prevSales.reduce((sum, s) => sum + s.total, 0);
  const prevMonthGrossProfit = prevSales.reduce((sum, s) => sum + s.profit, 0);
  const prevMonthExpenses = prevExpenses.reduce((sum, e) => sum + e.amount, 0);
  const prevMonthNetProfit = prevMonthGrossProfit - prevMonthExpenses;

  return {
    year, month,
    totalSales, totalOrders, totalCost, grossProfit, totalExpenses, netProfit,
    avgOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
    dailyTrend, topBrands,
    prevMonthSales, prevMonthOrders: prevSales.length, prevMonthNetProfit,
  };
}
