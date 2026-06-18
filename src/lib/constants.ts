export const APP_NAME = "OptiManage";
export const SHOP_NAME = "Noor Optics";
export const CURRENCY = "Rs.";
export const PRIMARY_COLOR = "#1f5d8c";
export const PRIMARY_LIGHT = "#e8f4fd";

export const BRANCHES = [
  { id: "branch-1", name: "Main Branch - Tariq Road" },
  { id: "branch-2", name: "Dolmen Mall Branch" },
] as const;

export const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "JazzCash"] as const;
export const PAYMENT_STATUS = ["Paid", "Advance", "Balance"] as const;

export const PRODUCT_TYPES = [
  "Acetate",
  "Plastic",
  "Metal",
  "Rimless",
  "Semi-rimless",
  "Titanium",
] as const;

export const PRODUCT_CATEGORIES = [
  "Frames",
  "Sunglasses",
  "Contact Lenses",
  "Lens Stock",
] as const;

export const LAB_ORDER_STATUSES = ["Ordered", "In Progress", "Received", "Fitted"] as const;
