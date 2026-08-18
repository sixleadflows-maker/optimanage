export const APP_NAME = "OptiManage";
export const SHOP_NAME = "EyeSpy";
export const CURRENCY = "Rs.";
export const PRIMARY_COLOR = "#6d5ef0";
export const PRIMARY_LIGHT = "#edeafd";

export const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "JazzCash"] as const;
export const PAYMENT_STATUS = ["Paid", "Advance", "Balance"] as const;

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
  "Lens Stock",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

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
export const DISCOUNT_PERCENTAGES = [5, 10, 15, 20, 25, 30, 40, 50] as const;

// Deleted items stay recoverable in the Trash for this long.
// Lives here rather than in actions/trash.ts because a "use server" module may
// only export async functions — exporting a const or type from one breaks the
// Server Actions bundle at build time.
export const TRASH_RETENTION_DAYS = 30;

export type TrashKind = "product" | "location" | "staff";
