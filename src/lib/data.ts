import { db } from "@/lib/db";
import type {
  Product, Customer, Sale, Supplier, Expense, LabOrder, Prescription,
} from "@/lib/mock/types";

// ─── Enum mappers (DB enum → UI title-case) ─────────────────
const brandTagLabel = { ORIGINAL: "Original", COPY: "Copy", UNBRANDED: "Unbranded" } as const;
const paymentStatusLabel = { PAID: "Paid", ADVANCE: "Advance", BALANCE: "Balance" } as const;
const labStatusLabel = { ORDERED: "Ordered", IN_PROGRESS: "In Progress", RECEIVED: "Received", FITTED: "Fitted" } as const;

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

// ─── Products ───────────────────────────────────────────────
export async function getProducts(): Promise<Product[]> {
  const rows = await db.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    model: p.model,
    category: p.category as Product["category"],
    type: p.type,
    colour: p.colour,
    size: p.size,
    costPrice: p.costPrice,
    salePrice: p.salePrice,
    stock: p.stock,
    barcode: p.barcode,
    lowStockThreshold: p.lowStockThreshold,
    image: p.image || undefined,
    brandTag: brandTagLabel[p.brandTag],
    priceThreshold: p.priceThreshold || undefined,
  }));
}

export async function getProduct(id: string): Promise<Product | null> {
  const p = await db.product.findUnique({ where: { id } });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    model: p.model,
    category: p.category as Product["category"],
    type: p.type,
    colour: p.colour,
    size: p.size,
    costPrice: p.costPrice,
    salePrice: p.salePrice,
    stock: p.stock,
    barcode: p.barcode,
    lowStockThreshold: p.lowStockThreshold,
    image: p.image || undefined,
    brandTag: brandTagLabel[p.brandTag],
    priceThreshold: p.priceThreshold || undefined,
  };
}

// ─── Customers ──────────────────────────────────────────────
export type CustomerView = Customer & { visitCount: number };

function mapPrescription(p: {
  id: string; date: Date; rightSph: number; rightCyl: number; rightAxis: number; rightPd: number; rightAdd: number;
  leftSph: number; leftCyl: number; leftAxis: number; leftPd: number; leftAdd: number; notes: string;
}): Prescription {
  return {
    id: p.id,
    date: iso(p.date),
    rightEye: { sph: p.rightSph, cyl: p.rightCyl, axis: p.rightAxis, pd: p.rightPd, add: p.rightAdd },
    leftEye: { sph: p.leftSph, cyl: p.leftCyl, axis: p.leftAxis, pd: p.leftPd, add: p.leftAdd },
    notes: p.notes,
  };
}

export async function getCustomers(): Promise<CustomerView[]> {
  const rows = await db.customer.findMany({
    orderBy: { name: "asc" },
    include: { prescriptions: { orderBy: { date: "desc" } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    lastVisit: iso(c.lastVisit),
    totalSpend: c.totalSpend,
    visitCount: c.visitCount,
    prescriptions: c.prescriptions.map(mapPrescription),
  }));
}

export async function getCustomer(id: string): Promise<CustomerView | null> {
  const c = await db.customer.findUnique({
    where: { id },
    include: { prescriptions: { orderBy: { date: "desc" } } },
  });
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    lastVisit: iso(c.lastVisit),
    totalSpend: c.totalSpend,
    visitCount: c.visitCount,
    prescriptions: c.prescriptions.map(mapPrescription),
  };
}

// ─── Sales ──────────────────────────────────────────────────
export type SaleView = Sale & { profit: number; totalCost: number; createdByName: string; receivedByName: string };

function mapSale(s: {
  id: string; invoiceNo: string; date: Date; customerId: string | null; customer: { name: string } | null;
  items: { productId: string; productName: string; quantity: number; unitPrice: number; discount: number; total: number }[];
  subtotal: number; discount: number; tax: number; total: number; paid: number; balance: number;
  paymentMethod: string; paymentStatus: "PAID" | "ADVANCE" | "BALANCE"; branchId: string | null;
  profit: number; totalCost: number; createdBy?: { name: string } | null; receivedBy?: { name: string } | null;
}): SaleView {
  return {
    id: s.id,
    invoiceNo: s.invoiceNo,
    date: iso(s.date),
    customerId: s.customerId ?? "",
    customerName: s.customer?.name ?? "Walk-in",
    items: s.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount,
      total: it.total,
    })),
    subtotal: s.subtotal,
    discount: s.discount,
    tax: s.tax,
    total: s.total,
    paid: s.paid,
    balance: s.balance,
    paymentMethod: s.paymentMethod,
    paymentStatus: paymentStatusLabel[s.paymentStatus],
    branchId: s.branchId ?? "",
    profit: s.profit,
    totalCost: s.totalCost,
    createdByName: s.createdBy?.name ?? "",
    receivedByName: s.receivedBy?.name ?? "",
  };
}

export async function getCustomerSales(customerId: string): Promise<SaleView[]> {
  const rows = await db.sale.findMany({
    where: { customerId },
    orderBy: { date: "desc" },
    include: { items: true, customer: true, createdBy: true, receivedBy: true },
  });
  return rows.map(mapSale);
}

export async function getSales(): Promise<SaleView[]> {
  const rows = await db.sale.findMany({
    orderBy: { date: "desc" },
    include: { items: true, customer: true, createdBy: true, receivedBy: true },
  });
  return rows.map((s) => ({
    id: s.id,
    invoiceNo: s.invoiceNo,
    date: iso(s.date),
    customerId: s.customerId ?? "",
    customerName: s.customer?.name ?? "Walk-in",
    items: s.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount,
      total: it.total,
    })),
    subtotal: s.subtotal,
    discount: s.discount,
    tax: s.tax,
    total: s.total,
    paid: s.paid,
    balance: s.balance,
    paymentMethod: s.paymentMethod,
    paymentStatus: paymentStatusLabel[s.paymentStatus],
    branchId: s.branchId ?? "",
    profit: s.profit,
    totalCost: s.totalCost,
    createdByName: s.createdBy?.name ?? "",
    receivedByName: s.receivedBy?.name ?? "",
  }));
}

// ─── Suppliers ──────────────────────────────────────────────
export async function getSuppliers(): Promise<Supplier[]> {
  const rows = await db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    contact: s.contact,
    phone: s.phone,
    email: s.email,
    address: s.address,
    gst: s.ntn,
  }));
}

// ─── Purchase Orders ────────────────────────────────────────
import type { PurchaseOrder } from "@/lib/mock/types";

const poStatusLabel = { DRAFT: "Draft", ORDERED: "Ordered", PARTIAL: "Partial", RECEIVED: "Received" } as const;

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const rows = await db.purchaseOrder.findMany({
    orderBy: { date: "desc" },
    include: { supplier: true, items: true },
  });
  return rows.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    supplierName: po.supplier?.name ?? "",
    date: iso(po.date),
    items: po.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitCost: it.unitCost,
      total: it.total,
      received: it.received,
    })),
    total: po.total,
    status: poStatusLabel[po.status],
  }));
}

// ─── Expenses ───────────────────────────────────────────────
export async function getExpenses(): Promise<Expense[]> {
  const rows = await db.expense.findMany({ orderBy: { date: "desc" } });
  return rows.map((e) => ({
    id: e.id,
    date: iso(e.date),
    category: e.category,
    description: e.description,
    amount: e.amount,
    paidBy: e.paidBy,
  }));
}

// ─── Lab Orders ─────────────────────────────────────────────
export async function getLabOrders(): Promise<LabOrder[]> {
  const rows = await db.labOrder.findMany({
    orderBy: { orderedDate: "desc" },
    include: { customer: true },
  });
  return rows.map((l) => ({
    id: l.id,
    orderNo: l.orderNo,
    customerId: l.customerId,
    customerName: l.customer?.name ?? "",
    lab: l.lab,
    lensType: l.lensType,
    prescription: l.prescription,
    price: l.price,
    status: labStatusLabel[l.status],
    orderedDate: iso(l.orderedDate),
    expectedDate: iso(l.expectedDate),
    notes: l.notes,
  }));
}

// ─── Prescriptions (flat, with customer name) ───────────────
export type PrescriptionView = Prescription & { customerId: string; customerName: string };

export async function getPrescriptions(): Promise<PrescriptionView[]> {
  const rows = await db.prescription.findMany({
    orderBy: { date: "desc" },
    include: { customer: true },
  });
  return rows.map((p) => ({
    ...mapPrescription(p),
    customerId: p.customerId,
    customerName: p.customer?.name ?? "",
  }));
}

// ─── WhatsApp Messages ──────────────────────────────────────
const messageStatusLabel = { SENT: "Sent", DELIVERED: "Delivered", READ: "Read", FAILED: "Failed" } as const;

export interface WhatsAppMessageView {
  id: string; to: string; customerName: string; template: string; message: string; sentAt: string; status: string;
}

export async function getWhatsAppMessages(): Promise<WhatsAppMessageView[]> {
  const rows = await db.whatsAppMessage.findMany({ orderBy: { sentAt: "desc" }, take: 100 });
  return rows.map((m) => ({
    id: m.id,
    to: m.to,
    customerName: m.customerName,
    template: m.template,
    message: m.message,
    sentAt: m.sentAt.toISOString(),
    status: messageStatusLabel[m.status],
  }));
}

// ─── Reminders (eye test / lens change follow-ups) ──────────
const EYE_TEST_REMINDER_TEMPLATE = "Eye Test Reminder";
const LENS_CHANGE_REMINDER_TEMPLATE = "Lens Change Reminder";
const EYE_TEST_DUE_DAYS = 365;
const LENS_CHANGE_DUE_DAYS = 180;

export interface ReminderItem {
  customerId: string;
  customerName: string;
  phone: string;
  type: "EYE_TEST" | "LENS_CHANGE";
  template: string;
  lastDate: string;
  daysSince: number;
  message: string;
}

export async function getReminders(): Promise<ReminderItem[]> {
  const customers = await db.customer.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      prescriptions: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
      sales: {
        where: { OR: [{ lensProductId: { not: null } }, { customLensPrice: { gt: 0 } }] },
        select: { date: true },
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  // A customer drops off the due list once a reminder of that type has been
  // logged for them more recently than the event (test/change) that made them due.
  const sentMessages = await db.whatsAppMessage.findMany({
    where: { template: { in: [EYE_TEST_REMINDER_TEMPLATE, LENS_CHANGE_REMINDER_TEMPLATE] } },
    select: { to: true, template: true, sentAt: true },
  });
  const lastSentMap = new Map<string, Date>();
  for (const m of sentMessages) {
    const key = `${m.to}::${m.template}`;
    const prev = lastSentMap.get(key);
    if (!prev || m.sentAt > prev) lastSentMap.set(key, m.sentAt);
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const items: ReminderItem[] = [];

  for (const c of customers) {
    if (!c.phone) continue;

    const lastEyeTest = c.prescriptions[0]?.date;
    if (lastEyeTest) {
      const daysSince = Math.floor((now - lastEyeTest.getTime()) / dayMs);
      const lastSent = lastSentMap.get(`${c.phone}::${EYE_TEST_REMINDER_TEMPLATE}`);
      if (daysSince >= EYE_TEST_DUE_DAYS && (!lastSent || lastSent < lastEyeTest)) {
        items.push({
          customerId: c.id,
          customerName: c.name,
          phone: c.phone,
          type: "EYE_TEST",
          template: EYE_TEST_REMINDER_TEMPLATE,
          lastDate: iso(lastEyeTest),
          daysSince,
          message: `Hello ${c.name}, it's been a year since your last eye test at Noor Optics. Book an appointment to get your eyes checked!`,
        });
      }
    }

    const lastLensChange = c.sales[0]?.date;
    if (lastLensChange) {
      const daysSince = Math.floor((now - lastLensChange.getTime()) / dayMs);
      const lastSent = lastSentMap.get(`${c.phone}::${LENS_CHANGE_REMINDER_TEMPLATE}`);
      if (daysSince >= LENS_CHANGE_DUE_DAYS && (!lastSent || lastSent < lastLensChange)) {
        items.push({
          customerId: c.id,
          customerName: c.name,
          phone: c.phone,
          type: "LENS_CHANGE",
          template: LENS_CHANGE_REMINDER_TEMPLATE,
          lastDate: iso(lastLensChange),
          daysSince,
          message: `Hello ${c.name}, it's been 6 months since your last lens change at Noor Optics. Visit us for a check-up and fresh lenses!`,
        });
      }
    }
  }

  items.sort((a, b) => b.daysSince - a.daysSince);
  return items;
}

// ─── Shop Settings ──────────────────────────────────────────
export interface SettingsView {
  name: string; address: string; phone: string; email: string; ntn: string;
  taxRate: number; receiptFooter: string;
  barcodeWidth: number; barcodeHeight: number;
  hasAnalyticsPin: boolean;
}

export async function getSettings(): Promise<SettingsView> {
  const s = await db.shopSettings.findUnique({ where: { id: "default" } });
  return {
    name: s?.name ?? "Noor Optics",
    address: s?.address ?? "",
    phone: s?.phone ?? "",
    email: s?.email ?? "",
    ntn: s?.ntn ?? "",
    taxRate: s?.taxRate ?? 0,
    receiptFooter: s?.receiptFooter ?? "",
    barcodeWidth: s?.barcodeWidth ?? 2,
    barcodeHeight: s?.barcodeHeight ?? 40,
    hasAnalyticsPin: !!(s?.analyticsPin),
  };
}

// ─── Users ──────────────────────────────────────────────────
const roleLabel = { OWNER: "Owner", MANAGER: "Manager", CASHIER: "Cashier" } as const;

export interface UserView {
  id: string; name: string; email: string; role: string; avatar: string; active: boolean;
}

export async function getUsers(): Promise<UserView[]> {
  const rows = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: roleLabel[u.role],
    avatar: u.avatar || u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
    active: u.active,
  }));
}

// ─── Analytics ──────────────────────────────────────────────
export interface AnalyticsData {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  dailySales: { label: string; value: number }[];
  brandRevenue: { label: string; value: number }[];
  categoryRevenue: { name: string; value: number }[];
  profitMargins: { label: string; value: number }[];
  fastMoving: { id: string; name: string; brand: string; model: string; sold: number; stock: number }[];
  deadStock: { id: string; name: string; brand: string; model: string; category: string; stock: number; value: number }[];
  requiresPin: boolean;
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  const [products, sales, expenses, settings] = await Promise.all([
    db.product.findMany({ where: { active: true } }),
    db.sale.findMany({ include: { items: true } }),
    db.expense.findMany(),
    db.shopSettings.findUnique({ where: { id: "default" } }),
  ]);

  const productById = new Map(products.map((p) => [p.id, p]));

  const brands: Record<string, number> = {};
  const cats: Record<string, number> = {};
  const itemSales: Record<string, number> = {};
  const days: Record<string, number> = {};
  let totalCost = 0;

  sales.forEach((s) => {
    const day = iso(s.date);
    days[day] = (days[day] || 0) + s.total;
    s.items.forEach((it) => {
      const p = productById.get(it.productId);
      if (p) {
        brands[p.brand] = (brands[p.brand] || 0) + it.total;
        cats[p.category] = (cats[p.category] || 0) + it.total;
        totalCost += p.costPrice * it.quantity;
      }
      itemSales[it.productId] = (itemSales[it.productId] || 0) + it.quantity;
    });
  });

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const grossProfit = totalRevenue - totalCost;

  const dailySales = Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({
    label: new Date(date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" }),
    value: total,
  }));

  const brandRevenue = Object.entries(brands).sort(([, a], [, b]) => b - a).map(([label, value]) => ({ label, value }));
  const categoryRevenue = Object.entries(cats).map(([name, value]) => ({ name, value }));

  const profitMargins = products
    .map((p) => ({ label: `${p.brand} ${p.name}`.slice(0, 25), value: p.salePrice > 0 ? ((p.salePrice - p.costPrice) / p.salePrice) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const fastMoving = products
    .map((p) => ({ id: p.id, name: p.name, brand: p.brand, model: p.model, sold: itemSales[p.id] || 0, stock: p.stock }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 8);

  const deadStock = products
    .filter((p) => !itemSales[p.id])
    .slice(0, 5)
    .map((p) => ({ id: p.id, name: p.name, brand: p.brand, model: p.model, category: p.category, stock: p.stock, value: p.salePrice * p.stock }));

  return {
    totalRevenue, totalCost, grossProfit, totalExpenses, netProfit: grossProfit - totalExpenses,
    dailySales, brandRevenue, categoryRevenue, profitMargins, fastMoving, deadStock,
    requiresPin: !!settings?.analyticsPin,
  };
}

// ─── Daily Cash Collection ──────────────────────────────────
export interface CashCollectionData {
  date: string;
  cashSales: number;
  cardSales: number;
  bankTransfer: number;
  jazzCash: number;
  totalCollection: number;
  expenses: number;
  invoiceCount: number;
  saved: { openingCash: number; closingCash: number; notes: string; closedBy: string } | null;
}

function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function getCashCollection(dateStr: string, branchId?: string): Promise<CashCollectionData> {
  const { start, end } = dayRange(dateStr);
  const saleWhere = { date: { gte: start, lt: end }, ...(branchId ? { branchId } : {}) };
  const [sales, expenses, saved] = await Promise.all([
    db.sale.findMany({ where: saleWhere }),
    db.expense.findMany({ where: { date: { gte: start, lt: end } } }),
    db.cashCollection.findFirst({ where: { date: { gte: start, lt: end }, ...(branchId ? { branchId } : {}) } }),
  ]);

  const byMethod = (m: string) => sales.filter((s) => s.paymentMethod === m).reduce((sum, s) => sum + s.paid, 0);
  const totalCollection = sales.reduce((sum, s) => sum + s.paid, 0);

  return {
    date: dateStr,
    cashSales: byMethod("Cash"),
    cardSales: byMethod("Card"),
    bankTransfer: byMethod("Bank Transfer"),
    jazzCash: byMethod("JazzCash"),
    totalCollection,
    expenses: expenses.reduce((sum, e) => sum + e.amount, 0),
    invoiceCount: sales.length,
    saved: saved ? { openingCash: saved.openingCash, closingCash: saved.closingCash, notes: saved.notes, closedBy: saved.closedBy } : null,
  };
}

// ─── Dashboard aggregates ───────────────────────────────────
export interface DashboardData {
  todayRevenue: number;
  totalInvoices: number;
  outstanding: number;
  lowStockCount: number;
  totalProfit: number;
  dailyTrend: { label: string; value: number }[];
  topBrands: { label: string; value: number }[];
  recentSales: { id: string; invoiceNo: string; date: string; customerName: string; total: number; paymentStatus: string }[];
  reminders: { text: string; type: "balance" | "pickup" | "lab" | "stock"; date: string }[];
}

export async function getDashboardData(branchId?: string): Promise<DashboardData> {
  const saleWhere = branchId ? { branchId } : {};
  const [products, sales] = await Promise.all([
    db.product.findMany({ where: { active: true } }),
    db.sale.findMany({
      where: saleWhere,
      orderBy: { date: "desc" },
      include: { customer: true, items: true },
    }),
  ]);

  const productBrand = new Map(products.map((p) => [p.id, p.brand]));
  const today = new Date().toISOString().slice(0, 10);

  const todayRevenue = sales.filter((s) => iso(s.date) === today).reduce((sum, s) => sum + s.total, 0);
  const outstanding = sales.filter((s) => s.paymentStatus !== "PAID").reduce((sum, s) => sum + s.balance, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
  const lowStock = products.filter((p) => p.stock <= p.lowStockThreshold);

  // Daily trend (last 14 days that have sales)
  const days: Record<string, number> = {};
  sales.forEach((s) => { const d = iso(s.date); days[d] = (days[d] || 0) + s.total; });
  const dailyTrend = Object.entries(days)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, total]) => ({
      label: new Date(date).toLocaleDateString("en-PK", { day: "2-digit", month: "short" }),
      value: total,
    }));

  // Top brands by revenue
  const brands: Record<string, number> = {};
  sales.forEach((s) => s.items.forEach((it) => {
    const brand = productBrand.get(it.productId);
    if (brand) brands[brand] = (brands[brand] || 0) + it.total;
  }));
  const topBrands = Object.entries(brands)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([brand, revenue]) => ({ label: brand, value: revenue }));

  // Reminders: outstanding balances + low stock
  const reminders: DashboardData["reminders"] = [];
  sales.filter((s) => s.paymentStatus !== "PAID" && s.balance > 0).slice(0, 2).forEach((s) => {
    reminders.push({ text: `${s.customer?.name ?? "Walk-in"} — balance ${Math.round(s.balance).toLocaleString()} Rs due`, type: "balance", date: iso(s.date) });
  });
  lowStock.slice(0, 3).forEach((p) => {
    reminders.push({ text: `Low stock: ${p.name} (${p.stock} left)`, type: "stock", date: "Now" });
  });

  return {
    todayRevenue,
    totalInvoices: sales.length,
    outstanding,
    lowStockCount: lowStock.length,
    totalProfit,
    dailyTrend,
    topBrands,
    recentSales: sales.slice(0, 5).map((s) => ({
      id: s.id, invoiceNo: s.invoiceNo, date: iso(s.date),
      customerName: s.customer?.name ?? "Walk-in", total: s.total,
      paymentStatus: paymentStatusLabel[s.paymentStatus],
    })),
    reminders,
  };
}
