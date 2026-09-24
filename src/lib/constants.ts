export const APP_NAME = "OptiManage";
export const SHOP_NAME = "EyeSpy";
export const CURRENCY = "Rs.";
export const PRIMARY_COLOR = "#6d5ef0";
export const PRIMARY_LIGHT = "#edeafd";

export const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "JazzCash"] as const;
export const PAYMENT_STATUS = ["Full Payment", "Advance", "Balance"] as const;
export type PaymentStatusLabel = (typeof PAYMENT_STATUS)[number];

// The till still sends "Full" | "Advance" | "Balance"; this is how each reads to staff.
export const PAYMENT_TYPE_LABEL = { Full: "Full Payment", Advance: "Advance", Balance: "Balance" } as const;

// Status chips are styled by class name; "Full Payment" has a space in it.
export function paymentStatusChipClass(status: string) {
  return `chip-${status.toLowerCase().replace(/\s+/g, "-")}`;
}

export const PRODUCT_TYPES = [
  "Acetate",
  "Plastic",
  "Metal",
  "TR",
  "Rimless",
  "Semi-rimless",
  "Titanium",
  "Metal Clip On",
  "TR Clip On",
  "Acetate Clip On",
] as const;

export const PRODUCT_CATEGORIES = [
  "Frames",
  "Sunglasses",
  "Sports Sunglasses",
  "Kids Frames",
  "Kids Sunglasses",
  "Contact Lenses",
  "Lens Solution",
  "Lens Kit",
  "Lens Stock",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

// Offered at the till when a prescription lens is sold; staff can also type
// anything that isn't on the list.
export const LENS_COLORS = [
  "Clear / White",
  "Blue Cut",
  "Photochromic Grey",
  "Photochromic Brown",
  "Tinted Grey",
  "Tinted Brown",
  "Tinted Green",
  "Gradient",
  "Mirror",
] as const;

export const CONTACT_LENS_TYPES = ["Transparent", "Colored"] as const;
export const LENS_KIT_TYPES = ["Daily Wear", "Monthly Wear", "Extended Wear"] as const;

// "Type" means something different per category: frame material for eyewear,
// clear vs coloured for contact lenses, wear schedule for lens kits. Lens
// solution has no preset types, so an empty list hides the field.
export function typesForCategory(category: string): readonly string[] {
  if (category === "Contact Lenses") return CONTACT_LENS_TYPES;
  if (category === "Lens Kit") return LENS_KIT_TYPES;
  if (category === "Lens Solution") return [];
  return PRODUCT_TYPES;
}

// Categories whose types are worth filtering by on the inventory screen.
export const CATEGORIES_WITH_TYPE_FILTER: readonly string[] = ["Contact Lenses", "Lens Kit"];

export const EXPENSE_PAYMENT_METHODS = ["Cash", "Card", "Cheque"] as const;

export const PURCHASE_TYPES = ["Cash", "Cheque", "Other"] as const;
export const PURCHASE_PAYMENT_METHODS = [
  "Cash", "Cheque", "Bank Transfer", "JazzCash", "EasyPaisa", "Card", "Pay Later (Credit)", "Other",
] as const;

/**
 * What's still owed to the supplier on a purchase order. A payment by cheque
 * is recorded but only comes off the balance once the cheque has cleared (the
 * owner's rule); cash and the other methods come off straight away.
 */
export function poBalanceDue(po: { total: number; amountPaid: number; paymentMethod: string; chequeCleared?: boolean }) {
  const pendingCheque = po.paymentMethod === "Cheque" && !po.chequeCleared;
  return Math.max(0, po.total - (pendingCheque ? 0 : po.amountPaid || 0));
}

/** How an order stands on payment, for the chip on its card. */
export function poPaymentState(po: { total: number; amountPaid: number; paymentMethod: string; chequeCleared?: boolean }) {
  if (po.paymentMethod === "Cheque" && po.amountPaid > 0 && !po.chequeCleared) {
    return { label: "Cheque pending", tone: "bg-warning/10 text-warning" };
  }
  if (!po.amountPaid) return { label: "Unpaid", tone: "bg-destructive/10 text-destructive" };
  if (poBalanceDue(po) > 0) return { label: "Part paid", tone: "bg-warning/10 text-warning" };
  return { label: "Paid", tone: "bg-success/10 text-success" };
}

export const BRAND_TAGS = ["Original", "Copy", "Branded", "Unbranded"] as const;

export const DAMAGE_TYPES = [
  "Scratched Lens",
  "Scratched Frame",
  "Bent Frame",
  "Broken Temple",
  "Loose Hinge",
  "Discoloured",
  "Missing Parts",
  "Other",
] as const;

export const LAB_ORDER_STATUSES = ["Ordered", "In Progress", "Received", "Fitted"] as const;

// Offered in the till's discount dropdown. Picking one works out the rupee
// amount off the bill so staff don't have to calculate it.
export const DISCOUNT_PERCENTAGES = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90] as const;

// Deleted items stay recoverable in the Trash for this long.
// Lives here rather than in actions/trash.ts because a "use server" module may
// only export async functions — exporting a const or type from one breaks the
// Server Actions bundle at build time.
export const TRASH_RETENTION_DAYS = 30;
// A hidden row that has been deleted for good gets this as its deletedAt: it
// drops out of the trash and can't be restored, but the invoices and orders
// that mention it keep showing its name.
export const TRASH_PURGED_AT = new Date(0);

// Records that are hidden when deleted and simply un-hidden on restore.
export type SoftTrashKind = "product" | "customer" | "location" | "staff" | "supplier" | "lab";
// Records copied into TrashEntry and really removed; restore rebuilds them.
export type SnapshotTrashKind = "invoice" | "return" | "expense" | "prescription" | "labOrder" | "purchaseOrder" | "stockAdjustment";
export type TrashKind = SoftTrashKind | SnapshotTrashKind;
export const SNAPSHOT_TRASH_KINDS: readonly SnapshotTrashKind[] = [
  "invoice", "return", "expense", "prescription", "labOrder", "purchaseOrder", "stockAdjustment",
];
