import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type {
  Product, Customer, Sale, Supplier, Expense, LabOrder, Prescription,
} from "@/lib/mock/types";

// ─── Enum mappers (DB enum → UI title-case) ─────────────────
const brandTagLabel = { ORIGINAL: "Original", COPY: "Copy", BRANDED: "Branded", UNBRANDED: "Unbranded" } as const;
const paymentStatusLabel = { PAID: "Full Payment", ADVANCE: "Advance", BALANCE: "Balance" } as const;
const labStatusLabel = { ORDERED: "Ordered", IN_PROGRESS: "In Progress", RECEIVED: "Received", FITTED: "Fitted" } as const;
const saleSourceLabel = { POS: "POS", ONLINE: "Online" } as const;
const fulfillmentTypeLabel = { PICKUP: "Pickup", DELIVERY: "Delivery" } as const;
const onlineOrderStatusLabel = {
  PROCESSING: "Processing", READY_FOR_PICKUP: "Ready for Pickup", OUT_FOR_DELIVERY: "Out for Delivery",
  COMPLETED: "Completed", CANCELLED: "Cancelled",
} as const;

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

// ─── Products ───────────────────────────────────────────────
type ProductRow = Awaited<ReturnType<typeof db.product.findMany>>[number];

function mapProduct(p: ProductRow): Product {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    model: p.model,
    category: p.category as Product["category"],
    type: p.type,
    colour: p.colour,
    size: p.size,
    description: p.description,
    costPrice: p.costPrice,
    salePrice: p.salePrice,
    stock: p.stock,
    barcode: p.barcode,
    lowStockThreshold: p.lowStockThreshold,
    image: p.image || undefined,
    brandTag: brandTagLabel[p.brandTag],
    priceThreshold: p.priceThreshold || undefined,
    isDamaged: p.isDamaged,
    damageType: p.damageType,
  };
}

export async function getProducts(): Promise<Product[]> {
  const rows = await db.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  return rows.map(mapProduct);
}

export async function getStorefrontProducts(): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((p) => p.stock > 0);
}

export async function getProduct(id: string): Promise<Product | null> {
  const p = await db.product.findUnique({ where: { id } });
  return p ? mapProduct(p) : null;
}

// ─── Customers ──────────────────────────────────────────────
export type CustomerView = Customer & { visitCount: number };

function mapPrescription(p: {
  id: string; date: Date; rightSph: number; rightCyl: number; rightAxis: number; rightPd: number; rightAdd: number;
  leftSph: number; leftCyl: number; leftAxis: number; leftPd: number; leftAdd: number; notes: string;
  rightSphText: string; rightCylText: string; rightAddText: string; leftSphText: string; leftCylText: string; leftAddText: string;
  label: string; notesHidden: boolean; isOwnPrescription: boolean;
}): Prescription {
  return {
    id: p.id,
    date: iso(p.date),
    rightEye: {
      sph: p.rightSph, cyl: p.rightCyl, axis: p.rightAxis, pd: p.rightPd, add: p.rightAdd,
      sphText: p.rightSphText, cylText: p.rightCylText, addText: p.rightAddText,
    },
    leftEye: {
      sph: p.leftSph, cyl: p.leftCyl, axis: p.leftAxis, pd: p.leftPd, add: p.leftAdd,
      sphText: p.leftSphText, cylText: p.leftCylText, addText: p.leftAddText,
    },
    label: p.label,
    notes: p.notes,
    notesHidden: p.notesHidden,
    isOwnPrescription: p.isOwnPrescription,
  };
}

export async function getCustomers(): Promise<CustomerView[]> {
  const rows = await db.customer.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { prescriptions: { orderBy: { date: "desc" } } },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    serialNumber: c.serialNumber,
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
  if (!c || !c.active) return null;
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    serialNumber: c.serialNumber,
    email: c.email,
    address: c.address,
    lastVisit: iso(c.lastVisit),
    totalSpend: c.totalSpend,
    visitCount: c.visitCount,
    prescriptions: c.prescriptions.map(mapPrescription),
  };
}

// ─── Sales ──────────────────────────────────────────────────
export type SaleView = Sale & {
  profit: number; totalCost: number; createdByName: string; receivedByName: string;
  // Everything needed to reopen and reprint a past invoice exactly as it was billed.
  dateTime: string;
  customerPhone: string;
  // The customer's own serial number, so an invoice can be found by it.
  customerSerial: string;
  customLensName: string;
  customLensPrice: number;
  customLensQty: number;
  // Temporary number printed on a bill made offline; searchable.
  offlineRef: string;
  // False for an old invoice entered without taking items out of stock.
  stockDeducted: boolean;
  // When it was keyed in, which differs from `dateTime` for an old invoice.
  enteredAt: string;
  lensProductId: string;
  lensName: string;
  lensPrice: number;
  lensColor: string;
  lensDescription: string;
  labCharges: number;
  fittingCharges: number;
  // Money taken after the sale itself (an advance being settled), oldest first.
  payments: SalePaymentView[];
  hasReturn: boolean;
  returns: { id: string; returnNo: string; date: string; totalRefund: number; reason: string }[];
  // Every prescription taken with this sale, in the order they were entered.
  prescriptions: Prescription[];
};

export interface SalePaymentView {
  id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
  receivedByName: string;
}

const saleInclude = {
  items: { include: { product: { select: { brand: true } } } },
  customer: true,
  createdBy: true,
  receivedBy: true,
  lensProduct: { select: { brand: true, name: true, salePrice: true } },
  payments: { orderBy: { date: "asc" }, include: { receivedBy: { select: { name: true } } } },
  returns: { select: { id: true, returnNo: true, date: true, totalRefund: true, reason: true }, orderBy: { date: "asc" } },
  prescriptions: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.SaleInclude;

type SaleRow = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;

// Sales made before the brand was saved into the line name only stored the
// product's own name (often just "Frame"), so put the brand back in front.
function saleItemName(productName: string, brand: string | undefined) {
  if (!brand) return productName;
  return productName.toLowerCase().startsWith(brand.toLowerCase()) ? productName : `${brand} ${productName}`;
}

function mapSale(s: SaleRow): SaleView {
  return {
    id: s.id,
    invoiceNo: s.invoiceNo,
    date: iso(s.date),
    dateTime: s.date.toISOString(),
    customerId: s.customerId ?? "",
    customerName: s.customer?.name ?? "Walk-in",
    customerPhone: s.customer?.phone ?? "",
    customerSerial: s.customer?.serialNumber ?? "",
    items: s.items.map((it) => ({
      id: it.id,
      productId: it.productId ?? "",
      productName: saleItemName(it.productName, it.product?.brand),
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount,
      total: it.total,
      returnedQuantity: it.returnedQuantity,
    })),
    customLensName: s.customLensName,
    customLensPrice: s.customLensPrice,
    customLensQty: s.customLensQty,
    offlineRef: s.offlineRef,
    stockDeducted: s.stockDeducted,
    enteredAt: s.createdAt.toISOString(),
    lensProductId: s.lensProductId ?? "",
    lensName: s.lensProduct ? [s.lensProduct.brand, s.lensProduct.name].map((t) => t.trim()).filter(Boolean).join(" ") : "",
    lensPrice: s.lensProduct?.salePrice ?? 0,
    lensColor: s.lensColor,
    lensDescription: s.lensDescription,
    labCharges: s.labCharges,
    fittingCharges: s.fittingCharges,
    payments: s.payments.map((p) => ({
      id: p.id,
      date: p.date.toISOString(),
      amount: p.amount,
      method: p.method,
      note: p.note,
      receivedByName: p.receivedBy?.name ?? "",
    })),
    hasReturn: s.returns.length > 0,
    returns: s.returns.map((r) => ({ id: r.id, returnNo: r.returnNo, date: r.date.toISOString(), totalRefund: r.totalRefund, reason: r.reason })),
    prescriptions: s.prescriptions.map(mapPrescription),
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
    source: saleSourceLabel[s.source],
    fulfillmentType: s.fulfillmentType ? fulfillmentTypeLabel[s.fulfillmentType] : undefined,
    deliveryAddress: s.deliveryAddress,
    deliveryFee: s.deliveryFee,
    onlineOrderStatus: s.onlineOrderStatus ? onlineOrderStatusLabel[s.onlineOrderStatus] : undefined,
  };
}

export async function getCustomerSales(customerId: string): Promise<SaleView[]> {
  const rows = await db.sale.findMany({
    where: { customerId },
    orderBy: { date: "desc" },
    include: saleInclude,
  });
  return rows.map(mapSale);
}

// Who was picked on the last bill rung up. The till starts with them rather
// than whoever's account it's signed in to -- one shared login rings up for
// everyone, so that account's name was nearly always the wrong one.
export async function getLastInvoiceStaff() {
  const last = await db.sale.findFirst({
    where: { source: "POS" },
    orderBy: { createdAt: "desc" },
    select: { createdById: true, receivedById: true },
  });
  return { orderTakenById: last?.createdById ?? null, billGeneratedById: last?.receivedById ?? null };
}

// Every invoice ever made, newest first -- there is deliberately no date
// cut-off, so an old bill can always be found, reopened and reprinted.
export async function getSales(): Promise<SaleView[]> {
  const rows = await db.sale.findMany({
    orderBy: { date: "desc" },
    include: saleInclude,
  });
  return rows.map(mapSale);
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
      id: it.id,
      productId: it.productId ?? "",
      productName: it.productName,
      description: it.description,
      quantity: it.quantity,
      unitCost: it.unitCost,
      total: it.total,
      received: it.received,
    })),
    total: po.total,
    status: poStatusLabel[po.status],
    supplierInvoiceNo: po.supplierInvoiceNo,
    expectedDate: iso(po.expectedDate),
    notes: po.notes,
    purchaseType: po.purchaseType,
    purchaseTypeNote: po.purchaseTypeNote,
    paymentMethod: po.paymentMethod,
    paymentReference: po.paymentReference,
    bankName: po.bankName,
    paymentDate: iso(po.paymentDate),
    amountPaid: po.amountPaid,
    chequeCleared: po.chequeCleared,
    chequeClearedDate: iso(po.chequeClearedDate),
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
    paymentMethod: e.paymentMethod || "Cash",
  }));
}

// ─── Lab Orders ─────────────────────────────────────────────
export async function getLabOrders(): Promise<LabOrder[]> {
  const rows = await db.labOrder.findMany({
    orderBy: { orderedDate: "desc" },
    include: { customer: true, lab: true },
  });
  return rows.map((l) => ({
    id: l.id,
    orderNo: l.orderNo,
    customerId: l.customerId,
    customerName: l.customer?.name ?? "",
    labId: l.labId,
    lab: l.lab.name,
    lensType: l.lensType,
    prescription: l.prescription,
    price: l.price,
    status: labStatusLabel[l.status],
    orderedDate: iso(l.orderedDate),
    expectedDate: iso(l.expectedDate),
    notes: l.notes,
  }));
}

export interface LabVendorView {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
}

export async function getLabs(): Promise<LabVendorView[]> {
  const rows = await db.lab.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    contact: l.contact,
    phone: l.phone,
    email: l.email,
    address: l.address,
  }));
}

// ─── Prescriptions (flat, with customer name) ───────────────
export type PrescriptionView = Prescription & { customerId: string; customerName: string };

/** Just enough about an invoice to add a prescription to it later. */
export async function getSaleBrief(id: string) {
  const sale = await db.sale.findUnique({ where: { id }, select: { id: true, invoiceNo: true, customerId: true, customer: { select: { name: true } } } });
  if (!sale) return null;
  return { id: sale.id, invoiceNo: sale.invoiceNo, customerId: sale.customerId ?? "", customerName: sale.customer?.name ?? "" };
}

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
    where: { active: true },
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
          message: `Hello ${c.name}, it's been a year since your last eye test at EyeSpy. Book an appointment to get your eyes checked!`,
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
          message: `Hello ${c.name}, it's been 6 months since your last lens change at EyeSpy. Visit us for a check-up and fresh lenses!`,
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
  deliveryFee: number;
}

export async function getSettings(): Promise<SettingsView> {
  const s = await db.shopSettings.findUnique({ where: { id: "default" } });
  return {
    name: s?.name ?? "EyeSpy",
    address: s?.address ?? "",
    phone: s?.phone ?? "",
    email: s?.email ?? "",
    ntn: s?.ntn ?? "",
    taxRate: s?.taxRate ?? 0,
    receiptFooter: s?.receiptFooter ?? "",
    barcodeWidth: s?.barcodeWidth ?? 2,
    barcodeHeight: s?.barcodeHeight ?? 40,
    hasAnalyticsPin: !!(s?.analyticsPin),
    deliveryFee: s?.deliveryFee ?? 0,
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

// ─── Branches / Locations ────────────────────────────────────
export interface BranchView {
  id: string;
  name: string;
  address: string;
  phone: string;
  active: boolean;
}

export async function getBranches(): Promise<BranchView[]> {
  const rows = await db.branch.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    phone: b.phone,
    active: b.active,
  }));
}

// ─── Trash ──────────────────────────────────────────────────
export interface TrashItemView {
  id: string;
  kind: TrashKind;
  title: string;
  detail: string;
  deletedAt: string;
  daysLeft: number;
  expired: boolean;
}

import { TRASH_PURGED_AT, TRASH_RETENTION_DAYS, type TrashKind } from "@/lib/constants";

function trashTiming(deletedAt: Date | null) {
  // Rows deleted before the trash existed have no timestamp; treat them as
  // freshly binned rather than silently unrecoverable.
  const when = deletedAt ?? new Date();
  const days = Math.floor((Date.now() - when.getTime()) / 86_400_000);
  const daysLeft = TRASH_RETENTION_DAYS - days;
  return { deletedAt: when.toISOString(), daysLeft: Math.max(0, daysLeft), expired: daysLeft <= 0 };
}

export async function getTrashItems(): Promise<TrashItemView[]> {
  // Deleted for good (TRASH_PURGED_AT) is gone from the trash too.
  const inTrash = { active: false, OR: [{ deletedAt: null }, { deletedAt: { gt: TRASH_PURGED_AT } }] };
  const [products, customers, branches, users, suppliers, labs, entries] = await Promise.all([
    db.product.findMany({ where: inTrash, orderBy: { deletedAt: "desc" } }),
    db.customer.findMany({ where: inTrash, orderBy: { deletedAt: "desc" } }),
    db.branch.findMany({ where: inTrash, orderBy: { deletedAt: "desc" } }),
    db.user.findMany({ where: inTrash, orderBy: { deletedAt: "desc" } }),
    db.supplier.findMany({ where: inTrash, orderBy: { deletedAt: "desc" } }),
    db.lab.findMany({ where: inTrash, orderBy: { deletedAt: "desc" } }),
    db.trashEntry.findMany({ orderBy: { deletedAt: "desc" }, select: { id: true, kind: true, title: true, detail: true, deletedAt: true } }),
  ]);

  const items: TrashItemView[] = [
    ...products.map((p) => ({
      id: p.id,
      kind: "product" as const,
      title: `${p.brand} ${p.name}`.trim(),
      detail: [p.model, p.colour, p.barcode].filter(Boolean).join(" · "),
      ...trashTiming(p.deletedAt),
    })),
    ...customers.map((c) => ({
      id: c.id,
      kind: "customer" as const,
      title: c.name,
      detail: [c.phone, c.serialNumber && `Serial ${c.serialNumber}`].filter(Boolean).join(" · "),
      ...trashTiming(c.deletedAt),
    })),
    ...branches.map((b) => ({
      id: b.id,
      kind: "location" as const,
      title: b.name,
      detail: [b.address, b.phone].filter(Boolean).join(" · "),
      ...trashTiming(b.deletedAt),
    })),
    ...users.map((u) => ({
      id: u.id,
      kind: "staff" as const,
      title: u.name,
      detail: `${u.email} · ${u.role.charAt(0) + u.role.slice(1).toLowerCase()}`,
      ...trashTiming(u.deletedAt),
    })),
    ...suppliers.map((s) => ({
      id: s.id,
      kind: "supplier" as const,
      title: s.name,
      detail: [s.contact, s.phone].filter(Boolean).join(" · "),
      ...trashTiming(s.deletedAt),
    })),
    ...labs.map((l) => ({
      id: l.id,
      kind: "lab" as const,
      title: l.name,
      detail: [l.contact, l.phone].filter(Boolean).join(" · "),
      ...trashTiming(l.deletedAt),
    })),
    ...entries.map((e) => ({
      id: e.id,
      kind: e.kind as TrashKind,
      title: e.title,
      detail: e.detail,
      ...trashTiming(e.deletedAt),
    })),
  ];

  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

// ─── Stock Adjustments ──────────────────────────────────────
export interface StockAdjustmentView {
  id: string;
  productName: string;
  previousStock: number;
  newStock: number;
  delta: number;
  reason: string;
  notes: string;
  adjustedByName: string;
  date: string;
}

export async function getStockAdjustments(): Promise<StockAdjustmentView[]> {
  const rows = await db.stockAdjustment.findMany({
    orderBy: { createdAt: "desc" },
    include: { adjustedBy: true },
  });
  return rows.map((a) => ({
    id: a.id,
    productName: a.productName,
    previousStock: a.previousStock,
    newStock: a.newStock,
    delta: a.delta,
    reason: a.reason,
    notes: a.notes,
    adjustedByName: a.adjustedBy?.name ?? "",
    date: iso(a.createdAt),
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
  inventory: {
    products: number;
    units: number;
    costValue: number;
    retailValue: number;
    outOfStock: number;
    byCategory: { name: string; units: number; costValue: number; retailValue: number }[];
  };
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
      // Typed-in items (no productId) have no brand, category or cost to attribute.
      if (!it.productId) return;
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

  // What the shelves are worth right now: what the stock cost to buy, and what
  // it would bring in if it all sold at the marked price.
  const stockByCategory = new Map<string, { name: string; units: number; costValue: number; retailValue: number }>();
  let units = 0;
  let inventoryCost = 0;
  let inventoryRetail = 0;
  let outOfStock = 0;
  for (const p of products) {
    const inStock = Math.max(0, p.stock);
    if (inStock === 0) outOfStock++;
    units += inStock;
    inventoryCost += p.costPrice * inStock;
    inventoryRetail += p.salePrice * inStock;
    const row = stockByCategory.get(p.category) ?? { name: p.category, units: 0, costValue: 0, retailValue: 0 };
    row.units += inStock;
    row.costValue += p.costPrice * inStock;
    row.retailValue += p.salePrice * inStock;
    stockByCategory.set(p.category, row);
  }

  return {
    totalRevenue, totalCost, grossProfit, totalExpenses, netProfit: grossProfit - totalExpenses,
    dailySales, brandRevenue, categoryRevenue, profitMargins, fastMoving, deadStock,
    inventory: {
      products: products.length,
      units,
      costValue: inventoryCost,
      retailValue: inventoryRetail,
      outOfStock,
      byCategory: [...stockByCategory.values()].sort((a, b) => b.retailValue - a.retailValue),
    },
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
  // Cash expenses only -- they come out of the drawer. Anything paid by card or
  // cheque is counted separately and leaves the drawer alone.
  expenses: number;
  otherExpenses: number;
  invoiceCount: number;
  saved: { openingCash: number; closingCash: number; notes: string; closedBy: string } | null;
  // What the drawer should open with: the last close, plus the cash taken (less
  // cash spent) on any day since that hasn't been closed off.
  opening: { amount: number; closedOn: string; sinceLastClose: number } | null;
}

function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function getCashCollection(dateStr: string, branchId?: string): Promise<CashCollectionData> {
  const { start, end } = dayRange(dateStr);
  const saleWhere = { date: { gte: start, lt: end }, ...(branchId ? { branchId } : {}) };
  const [sales, laterPayments, expenses, saved] = await Promise.all([
    db.sale.findMany({ where: saleWhere, include: { payments: { select: { amount: true } } } }),
    // An advance settled today belongs to today's drawer, whatever day the
    // glasses were ordered on.
    db.salePayment.findMany({
      where: { date: { gte: start, lt: end }, ...(branchId ? { sale: { branchId } } : {}) },
      select: { amount: true, method: true },
    }),
    db.expense.findMany({ where: { date: { gte: start, lt: end } } }),
    db.cashCollection.findFirst({ where: { date: { gte: start, lt: end }, ...(branchId ? { branchId } : {}) } }),
  ]);

  // A sale's own `paid` is the running total including anything collected
  // later, so take those back out here and count them on their own date.
  const takenAtTill = sales.map((s) => ({
    method: s.paymentMethod,
    amount: s.paid - s.payments.reduce((sum, p) => sum + p.amount, 0),
  }));
  const collected = [...takenAtTill, ...laterPayments];

  const byMethod = (m: string) => collected.filter((c) => c.method === m).reduce((sum, c) => sum + c.amount, 0);
  const totalCollection = collected.reduce((sum, c) => sum + c.amount, 0);
  const cashExpenses = expenses.filter((e) => (e.paymentMethod || "Cash") === "Cash");

  return {
    date: dateStr,
    cashSales: byMethod("Cash"),
    cardSales: byMethod("Card"),
    bankTransfer: byMethod("Bank Transfer"),
    jazzCash: byMethod("JazzCash"),
    totalCollection,
    expenses: cashExpenses.reduce((sum, e) => sum + e.amount, 0),
    otherExpenses: expenses.filter((e) => (e.paymentMethod || "Cash") !== "Cash").reduce((sum, e) => sum + e.amount, 0),
    invoiceCount: sales.length,
    saved: saved ? { openingCash: saved.openingCash, closingCash: saved.closingCash, notes: saved.notes, closedBy: saved.closedBy } : null,
    opening: await openingCashFor(start, branchId),
  };
}

/**
 * What the drawer should start the day with, so nobody types it in: the cash
 * counted at the last close, plus the cash taken (less cash spent) on any day
 * in between that was never closed off.
 */
async function openingCashFor(start: Date, branchId?: string) {
  const lastClose = await db.cashCollection.findFirst({
    where: { date: { lt: start }, ...(branchId ? { branchId } : {}) },
    orderBy: { date: "desc" },
  });
  if (!lastClose) return null;

  const gap = { gte: new Date(lastClose.date.getTime() + 24 * 60 * 60 * 1000), lt: start };
  const [sales, laterPayments, expenses] = await Promise.all([
    db.sale.findMany({
      where: { date: gap, ...(branchId ? { branchId } : {}) },
      select: { paid: true, paymentMethod: true, payments: { select: { amount: true } } },
    }),
    db.salePayment.findMany({
      where: { date: gap, ...(branchId ? { sale: { branchId } } : {}) },
      select: { amount: true, method: true },
    }),
    db.expense.findMany({ where: { date: gap }, select: { amount: true, paymentMethod: true } }),
  ]);

  const takenAtTill = sales.map((s) => ({ method: s.paymentMethod, amount: s.paid - s.payments.reduce((sum, p) => sum + p.amount, 0) }));
  const cashIn = [...takenAtTill, ...laterPayments].filter((c) => c.method === "Cash").reduce((sum, c) => sum + c.amount, 0);
  const cashOut = expenses.filter((e) => (e.paymentMethod || "Cash") === "Cash").reduce((sum, e) => sum + e.amount, 0);
  const sinceLastClose = Math.round((cashIn - cashOut) * 100) / 100;

  return {
    amount: Math.max(0, Math.round((lastClose.closingCash + sinceLastClose) * 100) / 100),
    closedOn: lastClose.date.toISOString().slice(0, 10),
    sinceLastClose,
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
    const brand = it.productId ? productBrand.get(it.productId) : undefined;
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
