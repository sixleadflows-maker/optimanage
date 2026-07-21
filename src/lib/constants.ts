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
