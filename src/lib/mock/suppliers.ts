import { Supplier, PurchaseOrder } from "./types";

export const suppliers: Supplier[] = [
  { id: "sup1", name: "Luxottica Pakistan Pvt. Ltd.", contact: "Hassan Mehmood", phone: "+92 21 3456 7890", email: "orders@luxottica.pk", address: "Plot 45, SITE Area, Karachi 75700", gst: "1234567-8" },
  { id: "sup2", name: "Essilor Pakistan Pvt. Ltd.", contact: "Nadia Kapoor", phone: "+92 42 3567 8901", email: "supply@essilor.pk", address: "Gulberg III, Main Boulevard, Lahore 54660", gst: "2345678-9" },
  { id: "sup3", name: "Bausch & Lomb Pakistan", contact: "Asif Raza", phone: "+92 21 3678 9012", email: "distribution@bausch.pk", address: "Clifton Block 8, Karachi 75600", gst: "3456789-0" },
  { id: "sup4", name: "Titan Eye Distribution", contact: "Shahid Afridi", phone: "+92 21 3789 0123", email: "eyeplus@titan.pk", address: "Korangi Industrial Area, Karachi 74900", gst: "4567890-1" },
  { id: "sup5", name: "Al-Noor Wholesale Optics", contact: "Junaid Sheikh", phone: "+92 51 2890 1234", email: "wholesale@alnooroptics.pk", address: "Blue Area, Islamabad 44000", gst: "5678901-2" },
];

export const purchaseOrders: PurchaseOrder[] = [
  {
    id: "po1", poNumber: "PO-2026-001", supplierId: "sup1", supplierName: "Luxottica Pakistan Pvt. Ltd.",
    date: "2026-06-10",
    items: [
      { productId: "p1", productName: "Ray-Ban Aviator Classic", quantity: 10, unitCost: 4200, total: 42000, received: 10 },
      { productId: "p2", productName: "Ray-Ban Wayfarer Original", quantity: 8, unitCost: 3800, total: 30400, received: 8 },
      { productId: "p4", productName: "Ray-Ban Clubmaster", quantity: 6, unitCost: 5200, total: 31200, received: 0 },
    ],
    total: 103600, status: "Partial",
  },
  {
    id: "po2", poNumber: "PO-2026-002", supplierId: "sup2", supplierName: "Essilor Pakistan Pvt. Ltd.",
    date: "2026-06-05",
    items: [
      { productId: "p22", productName: "CR-39 Single Vision", quantity: 50, unitCost: 280, total: 14000, received: 50 },
      { productId: "p23", productName: "Crizal Prevencia", quantity: 30, unitCost: 1200, total: 36000, received: 30 },
      { productId: "p24", productName: "Progressive Varilux", quantity: 10, unitCost: 3500, total: 35000, received: 10 },
    ],
    total: 85000, status: "Received",
  },
  {
    id: "po3", poNumber: "PO-2026-003", supplierId: "sup3", supplierName: "Bausch & Lomb Pakistan",
    date: "2026-06-15",
    items: [
      { productId: "p18", productName: "SofLens Daily", quantity: 40, unitCost: 550, total: 22000, received: 0 },
      { productId: "p20", productName: "PureVision 2", quantity: 20, unitCost: 750, total: 15000, received: 0 },
    ],
    total: 37000, status: "Ordered",
  },
];
