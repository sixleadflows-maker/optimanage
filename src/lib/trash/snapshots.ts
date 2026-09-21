import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { SnapshotTrashKind } from "@/lib/constants";
import { formatRxPower } from "@/lib/utils/rx";

/**
 * Trash for records that are really removed when deleted.
 *
 * Deleting copies the record (and everything hanging off it) into TrashEntry,
 * undoes its effects (stock, customer spend...) and removes it. Restoring
 * rebuilds it with the same ids and numbers and re-applies those effects —
 * refusing, with a reason staff can act on, when that's no longer possible.
 */
export class TrashError extends Error {}

type Tx = Prisma.TransactionClient;
type Row = Record<string, unknown>;

/** JSON turns dates into strings; turn the named fields back into dates. */
function revive<T extends Row>(row: T, keys: string[]): T {
  const out: Row = { ...row };
  for (const k of keys) if (typeof out[k] === "string") out[k] = new Date(out[k] as string);
  return out as T;
}

function omit<T extends Row>(row: T, keys: string[]): Row {
  const out: Row = { ...row };
  for (const k of keys) delete out[k];
  return out;
}

async function store(tx: Tx, kind: SnapshotTrashKind, recordId: string, title: string, detail: string, data: unknown, deletedById: string | null) {
  await tx.trashEntry.create({
    data: { kind, recordId, title, detail, data: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue, deletedById },
  });
}

const rs = (n: number) => `Rs.${Math.round(n).toLocaleString("en-PK")}`;
const label = (brand: string, name: string) => [brand, name].map((s) => s.trim()).filter(Boolean).join(" ");

// ─── Invoices ───────────────────────────────────────────────

export async function trashInvoice(saleId: string, deletedById: string | null) {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      items: true,
      payments: true,
      returns: { include: { items: true } },
      prescriptions: { select: { id: true } },
      customer: { select: { name: true } },
    },
  });
  if (!sale) throw new TrashError("This invoice has already been deleted");

  const { items, payments, returns, prescriptions, customer, ...row } = sale;
  const checkoutSessions = await db.checkoutSession.findMany({ where: { saleId }, select: { id: true } });

  await db.$transaction(async (tx) => {
    await store(tx, "invoice", sale.id, sale.invoiceNo,
      [customer?.name ?? "Walk-in", rs(sale.total), `${items.length} item${items.length === 1 ? "" : "s"}`].join(" · "),
      { sale: row, items, payments, returns, prescriptionIds: prescriptions.map((p) => p.id), checkoutSessionIds: checkoutSessions.map((c) => c.id) },
      deletedById);

    // Units already returned went back on the shelf at the time, so only the
    // rest are put back now -- nothing gets counted twice. An old invoice
    // entered without touching stock never took any.
    if (sale.stockDeducted) {
      for (const item of items) {
        if (!item.productId) continue;
        const stillOut = item.quantity - item.returnedQuantity;
        if (stillOut > 0) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: stillOut } } });
      }
    }

    if (sale.customerId) {
      const c = await tx.customer.findUnique({ where: { id: sale.customerId } });
      if (c) {
        await tx.customer.update({
          where: { id: c.id },
          data: { totalSpend: Math.max(0, c.totalSpend - sale.total), visitCount: Math.max(0, c.visitCount - 1) },
        });
      }
    }

    // Return items cascade with their return; payments and lines with the
    // sale. The prescription is the customer's eye history -- kept, unlinked.
    await tx.return.deleteMany({ where: { saleId } });
    await tx.checkoutSession.updateMany({ where: { saleId }, data: { saleId: null } });
    await tx.sale.delete({ where: { id: saleId } });
  }, { timeout: 20_000 });

  return { hadReturns: returns.length > 0 };
}

async function restoreInvoice(tx: Tx, data: Row) {
  const sale = revive(data.sale as Row, ["date", "createdAt", "updatedAt"]);
  const items = data.items as Row[];
  const payments = (data.payments as Row[]).map((p) => revive(p, ["date", "createdAt"]));
  const returns = (data.returns as (Row & { items: Row[] })[]).map((r) => ({ ...revive(r, ["date", "createdAt"]), items: r.items }));

  if (await tx.sale.findUnique({ where: { invoiceNo: sale.invoiceNo as string } })) {
    throw new TrashError(`${sale.invoiceNo} is already on the system`);
  }

  if (sale.stockDeducted !== false) {
    for (const item of items) {
      const productId = item.productId as string | null;
      if (!productId) continue;
      const need = (item.quantity as number) - (item.returnedQuantity as number);
      if (need <= 0) continue;
      const res = await tx.product.updateMany({ where: { id: productId, stock: { gte: need } }, data: { stock: { decrement: need } } });
      if (res.count === 0) {
        const p = await tx.product.findUnique({ where: { id: productId }, select: { brand: true, name: true, stock: true } });
        throw new TrashError(
          `Can't restore ${sale.invoiceNo}: it needs ${need} × ${p ? label(p.brand, p.name) : (item.productName as string)} but only ${p?.stock ?? 0} ${p?.stock === 1 ? "is" : "are"} in stock now`
        );
      }
    }
  }

  const customerId = sale.customerId as string | null;
  const customerExists = customerId ? !!(await tx.customer.findUnique({ where: { id: customerId }, select: { id: true } })) : false;

  await tx.sale.create({
    data: {
      ...(omit(sale, ["customerId"]) as Prisma.SaleUncheckedCreateInput),
      customerId: customerExists ? customerId : null,
      items: { create: items.map((i) => omit(i, ["saleId"]) as Prisma.SaleItemUncheckedCreateWithoutSaleInput) },
      payments: { create: payments.map((p) => omit(p, ["saleId"]) as Prisma.SalePaymentUncheckedCreateWithoutSaleInput) },
    },
  });
  for (const r of returns) {
    await tx.return.create({
      data: {
        ...(omit(r, ["items"]) as Prisma.ReturnUncheckedCreateInput),
        items: { create: r.items.map((i) => omit(i, ["returnId"]) as Prisma.ReturnItemUncheckedCreateWithoutReturnInput) },
      },
    });
  }

  if (customerExists && customerId) {
    const c = await tx.customer.findUnique({ where: { id: customerId }, select: { lastVisit: true } });
    const date = sale.date as Date;
    await tx.customer.update({
      where: { id: customerId },
      data: {
        totalSpend: { increment: sale.total as number },
        visitCount: { increment: 1 },
        lastVisit: !c?.lastVisit || c.lastVisit < date ? date : c.lastVisit,
      },
    });
  }

  const prescriptionIds = (data.prescriptionIds as string[]) ?? [];
  if (prescriptionIds.length) {
    await tx.prescription.updateMany({ where: { id: { in: prescriptionIds }, saleId: null }, data: { saleId: sale.id as string } });
  }
  const checkoutSessionIds = (data.checkoutSessionIds as string[]) ?? [];
  if (checkoutSessionIds.length) {
    await tx.checkoutSession.updateMany({ where: { id: { in: checkoutSessionIds }, saleId: null }, data: { saleId: sale.id as string } });
  }
}

// ─── Returns ────────────────────────────────────────────────

/** Undoes a return: the refunded items count as sold again and leave the shelf. */
export async function trashReturn(returnId: string, deletedById: string | null) {
  const ret = await db.return.findUnique({
    where: { id: returnId },
    include: { items: true, sale: { select: { invoiceNo: true } } },
  });
  if (!ret) throw new TrashError("This return has already been undone");

  await db.$transaction(async (tx) => {
    const { items, sale, ...row } = ret;
    await store(tx, "return", ret.id, ret.returnNo,
      [`Against ${sale.invoiceNo}`, `refund ${rs(ret.totalRefund)}`, ret.reason].filter(Boolean).join(" · "),
      { return: row, items }, deletedById);

    for (const item of items) {
      if (item.productId) {
        const res = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (res.count === 0) {
          throw new TrashError(`Can't undo ${ret.returnNo}: ${item.productName} has since been sold again, so it isn't on the shelf to take back`);
        }
      }
      await tx.saleItem.update({ where: { id: item.saleItemId }, data: { returnedQuantity: { decrement: item.quantity } } });
    }
    await tx.return.delete({ where: { id: returnId } });
  }, { timeout: 20_000 });
}

async function restoreReturn(tx: Tx, data: Row) {
  const ret = revive(data.return as Row, ["date", "createdAt"]);
  const items = data.items as Row[];

  if (!(await tx.sale.findUnique({ where: { id: ret.saleId as string }, select: { id: true } }))) {
    throw new TrashError(`Can't restore ${ret.returnNo}: its invoice has been deleted`);
  }
  for (const item of items) {
    const saleItem = await tx.saleItem.findUnique({ where: { id: item.saleItemId as string } });
    const qty = item.quantity as number;
    if (!saleItem || saleItem.quantity - saleItem.returnedQuantity < qty) {
      throw new TrashError(`Can't restore ${ret.returnNo}: the invoice has changed since, and ${item.productName} can't be returned again`);
    }
    await tx.saleItem.update({ where: { id: saleItem.id }, data: { returnedQuantity: { increment: qty } } });
    if (item.productId) await tx.product.update({ where: { id: item.productId as string }, data: { stock: { increment: qty } } });
  }
  await tx.return.create({
    data: {
      ...(ret as Prisma.ReturnUncheckedCreateInput),
      items: { create: items.map((i) => omit(i, ["returnId"]) as Prisma.ReturnItemUncheckedCreateWithoutReturnInput) },
    },
  });
}

// ─── Expenses, prescriptions, lab orders, purchase orders ───

export async function trashExpense(id: string, deletedById: string | null) {
  const e = await db.expense.findUnique({ where: { id } });
  if (!e) throw new TrashError("This expense has already been deleted");
  await db.$transaction(async (tx) => {
    await store(tx, "expense", e.id, `${e.category} — ${rs(e.amount)}`,
      [e.date.toLocaleDateString("en-GB"), e.description, e.paidBy && `paid by ${e.paidBy}`].filter(Boolean).join(" · "),
      { expense: e }, deletedById);
    await tx.expense.delete({ where: { id } });
  });
}

export async function trashPrescription(id: string, deletedById: string | null) {
  const exists = await db.prescription.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new TrashError("This prescription has already been deleted");
  await db.$transaction((tx) => trashPrescriptionRows(tx, [id], deletedById));
}

/**
 * Moves prescriptions to the trash inside a transaction that's already running
 * — a bill corrected at the till drops one it no longer carries in the same
 * step as the rest of the change.
 */
export async function trashPrescriptionRows(tx: Tx, ids: string[], deletedById: string | null) {
  for (const id of ids) {
    const p = await tx.prescription.findUnique({ where: { id }, include: { customer: { select: { name: true } } } });
    if (!p) continue;
    const { customer, ...row } = p;
    await store(tx, "prescription", p.id, `Prescription — ${customer.name}`,
      [
        p.date.toLocaleDateString("en-GB"),
        `OD ${formatRxPower(p.rightSph)}/${formatRxPower(p.rightCyl)} · OS ${formatRxPower(p.leftSph)}/${formatRxPower(p.leftCyl)}`,
      ].join(" · "),
      { prescription: row }, deletedById);
    await tx.prescription.delete({ where: { id } });
  }
}

export async function trashLabOrder(id: string, deletedById: string | null) {
  const o = await db.labOrder.findUnique({ where: { id }, include: { customer: { select: { name: true } }, lab: { select: { name: true } } } });
  if (!o) throw new TrashError("This lab order has already been deleted");
  const { customer, lab, ...row } = o;
  await db.$transaction(async (tx) => {
    await store(tx, "labOrder", o.id, o.orderNo,
      [customer.name, lab.name, o.lensType, rs(o.price)].filter(Boolean).join(" · "),
      { labOrder: row }, deletedById);
    await tx.labOrder.delete({ where: { id } });
  });
}

export async function trashPurchaseOrder(id: string, deletedById: string | null) {
  const po = await db.purchaseOrder.findUnique({ where: { id }, include: { items: true, supplier: { select: { name: true } } } });
  if (!po) throw new TrashError("This purchase order has already been deleted");
  // Once stock has come in against it, the order is part of how the shelf
  // count was reached; deleting it would leave that stock unexplained.
  if (po.items.some((i) => i.received > 0)) {
    throw new TrashError(`${po.poNumber} has stock received against it, so it can't be deleted. Correct the stock with a Stock Adjustment instead.`);
  }
  const { items, supplier, ...row } = po;
  await db.$transaction(async (tx) => {
    await store(tx, "purchaseOrder", po.id, po.poNumber,
      [supplier.name, rs(po.total), `${items.length} item${items.length === 1 ? "" : "s"}`].join(" · "),
      { purchaseOrder: row, items }, deletedById);
    await tx.purchaseOrder.delete({ where: { id } });
  });
}

/**
 * Removing a stock change puts the count back where it was before it — the
 * adjustment is undone, not just hidden.
 */
export async function trashStockAdjustment(id: string, deletedById: string | null) {
  const adjustment = await db.stockAdjustment.findUnique({ where: { id } });
  if (!adjustment) throw new TrashError("This stock change has already been removed");

  await db.$transaction(async (tx) => {
    await store(tx, "stockAdjustment", adjustment.id, adjustment.productName,
      [`${adjustment.previousStock} → ${adjustment.newStock}`, adjustment.reason, adjustment.notes].filter(Boolean).join(" · "),
      { adjustment }, deletedById);

    const product = await tx.product.findUnique({ where: { id: adjustment.productId }, select: { stock: true } });
    if (product && product.stock - adjustment.delta < 0) {
      throw new TrashError(`Undoing this would put ${adjustment.productName} below zero in stock`);
    }
    await tx.product.update({ where: { id: adjustment.productId }, data: { stock: { decrement: adjustment.delta } } });
    await tx.stockAdjustment.delete({ where: { id } });
  });
}

// ─── Restore ────────────────────────────────────────────────

export async function restoreSnapshot(entryId: string) {
  const entry = await db.trashEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new TrashError("That item is no longer in the trash");
  const data = entry.data as Row;

  await db.$transaction(async (tx) => {
    switch (entry.kind as SnapshotTrashKind) {
      case "invoice":
        await restoreInvoice(tx, data);
        break;
      case "return":
        await restoreReturn(tx, data);
        break;
      case "expense":
        await tx.expense.create({ data: revive(data.expense as Row, ["date", "createdAt"]) as Prisma.ExpenseUncheckedCreateInput });
        break;
      case "prescription": {
        const p = revive(data.prescription as Row, ["date", "createdAt"]);
        if (!(await tx.customer.findUnique({ where: { id: p.customerId as string }, select: { id: true } }))) {
          throw new TrashError("Can't restore this prescription: the customer is no longer on the system");
        }
        const saleExists = p.saleId ? !!(await tx.sale.findUnique({ where: { id: p.saleId as string }, select: { id: true } })) : false;
        await tx.prescription.create({ data: { ...(p as Prisma.PrescriptionUncheckedCreateInput), saleId: saleExists ? (p.saleId as string) : null } });
        break;
      }
      case "stockAdjustment": {
        const adjustment = revive(data.adjustment as Row, ["createdAt"]);
        const product = await tx.product.findUnique({ where: { id: adjustment.productId as string }, select: { stock: true } });
        if (!product) throw new TrashError("Can't restore this stock change: the product is no longer on the system");
        await tx.product.update({ where: { id: adjustment.productId as string }, data: { stock: { increment: adjustment.delta as number } } });
        await tx.stockAdjustment.create({ data: adjustment as Prisma.StockAdjustmentUncheckedCreateInput });
        break;
      }
      case "labOrder":
        await tx.labOrder.create({
          data: revive(data.labOrder as Row, ["orderedDate", "expectedDate", "createdAt", "updatedAt"]) as Prisma.LabOrderUncheckedCreateInput,
        });
        break;
      case "purchaseOrder": {
        const po = revive(data.purchaseOrder as Row, ["date", "expectedDate", "paymentDate", "createdAt"]);
        await tx.purchaseOrder.create({
          data: {
            ...(po as Prisma.PurchaseOrderUncheckedCreateInput),
            items: { create: (data.items as Row[]).map((i) => omit(i, ["orderId"]) as Prisma.PurchaseOrderItemUncheckedCreateWithoutOrderInput) },
          },
        });
        break;
      }
      default:
        throw new TrashError("That kind of item can't be restored here");
    }
    await tx.trashEntry.delete({ where: { id: entry.id } });
  }, { timeout: 20_000 });

  return { kind: entry.kind as SnapshotTrashKind, title: entry.title };
}
