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

export const PURCHASE_TYPES = ["Cash", "Cheque", "Other"] as const;
export const PURCHASE_PAYMENT_METHODS = [
  "Cash", "Cheque", "Bank Transfer", "JazzCash", "EasyPaisa", "Card", "Pay Later (Credit)", "Other",
] as const;

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

export type TrashKind = "product" | "customer" | "location" | "staff";
