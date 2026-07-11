export interface Product {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: "Frames" | "Sunglasses" | "Contact Lenses" | "Lens Stock";
  type: string;
  colour: string;
  size: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  barcode: string;
  lowStockThreshold: number;
  image?: string;
  brandTag: "Original" | "Copy" | "Unbranded";
  priceThreshold?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  lastVisit: string;
  totalSpend: number;
  prescriptions: Prescription[];
}

export interface Prescription {
  id: string;
  date: string;
  rightEye: EyeRx;
  leftEye: EyeRx;
  notes: string;
  isOwnPrescription: boolean;
}

export interface EyeRx {
  sph: number;
  cyl: number;
  axis: number;
  pd: number;
  add: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface Sale {
  id: string;
  invoiceNo: string;
  date: string;
  customerId: string;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  paymentMethod: string;
  paymentStatus: "Paid" | "Advance" | "Balance";
  branchId: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  gst: string;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
  received: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: PurchaseOrderItem[];
  total: number;
  status: "Draft" | "Ordered" | "Partial" | "Received";
}

export interface LabOrder {
  id: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  lab: string;
  lensType: string;
  prescription: string;
  price: number;
  status: "Ordered" | "In Progress" | "Received" | "Fitted";
  orderedDate: string;
  expectedDate: string;
  notes: string;
}

export interface WhatsAppMessage {
  id: string;
  to: string;
  customerName: string;
  template: string;
  message: string;
  sentAt: string;
  status: "Sent" | "Delivered" | "Read" | "Failed";
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
}

export interface ShopSettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  gst: string;
  taxRate: number;
  receiptFooter: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Manager" | "Cashier";
  avatar: string;
  active: boolean;
}
