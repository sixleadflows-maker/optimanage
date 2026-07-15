import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { Role, BrandTag } from "../src/generated/prisma/enums.js";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hash } from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ─── Branches ─────────────────────────────────────────
  const branch1 = await prisma.branch.upsert({
    where: { id: "branch-1" },
    update: {},
    create: { id: "branch-1", name: "Main Branch - Tariq Road", address: "45 Tariq Road, Karachi 75400", phone: "+92 21 3456 7890" },
  });
  const branch2 = await prisma.branch.upsert({
    where: { id: "branch-2" },
    update: {},
    create: { id: "branch-2", name: "Dolmen Mall Branch", address: "Dolmen Mall, Tariq Road, Karachi", phone: "+92 21 3456 7891" },
  });

  // ─── Users ────────────────────────────────────────────
  const ownerPw = await hash("owner123", 12);
  const managerPw = await hash("manager123", 12);
  const cashierPw = await hash("cashier123", 12);

  await prisma.user.upsert({
    where: { email: "asif@nooroptics.pk" },
    update: {},
    create: { name: "Dr. Asif Mahmood", email: "asif@nooroptics.pk", hashedPassword: ownerPw, role: Role.OWNER, avatar: "AM", branchId: branch1.id },
  });
  await prisma.user.upsert({
    where: { email: "rabia@nooroptics.pk" },
    update: {},
    create: { name: "Rabia Hassan", email: "rabia@nooroptics.pk", hashedPassword: managerPw, role: Role.MANAGER, avatar: "RH", branchId: branch1.id },
  });
  await prisma.user.upsert({
    where: { email: "waqar@nooroptics.pk" },
    update: {},
    create: { name: "Waqar Younis", email: "waqar@nooroptics.pk", hashedPassword: cashierPw, role: Role.CASHIER, avatar: "WY", branchId: branch1.id },
  });
  await prisma.user.upsert({
    where: { email: "saima@nooroptics.pk" },
    update: {},
    create: { name: "Saima Noor", email: "saima@nooroptics.pk", hashedPassword: cashierPw, role: Role.CASHIER, avatar: "SN", branchId: branch2.id },
  });

  // ─── Shop Settings ────────────────────────────────────
  const settingsPin = await hash("1234", 12);
  await prisma.shopSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      name: "EyeSpy",
      address: "45 Tariq Road, Karachi 75400",
      phone: "+92 21 3456 7890",
      email: "info@eyespy.pk",
      ntn: "1234567-8",
      taxRate: 0,
      receiptFooter: "Thank you for choosing EyeSpy!",
      analyticsPin: settingsPin,
    },
  });

  // ─── Customers ────────────────────────────────────────
  const customerData = [
    { name: "Ahmed Khan", phone: "+92 300 1234567", email: "ahmed.khan@email.com", address: "12 Clifton Block 5, Karachi", visitCount: 5 },
    { name: "Ayesha Malik", phone: "+92 321 2345678", email: "ayesha.malik@email.com", address: "45 DHA Phase 6, Karachi", visitCount: 3 },
    { name: "Usman Ali", phone: "+92 333 3456789", email: "usman.ali@email.com", address: "78 Gulshan-e-Iqbal Block 13, Karachi", visitCount: 7 },
    { name: "Sana Sheikh", phone: "+92 345 4567890", email: "sana.sheikh@email.com", address: "23 North Nazimabad Block H, Karachi", visitCount: 2 },
    { name: "Bilal Hussain", phone: "+92 312 5678901", email: "bilal.hussain@email.com", address: "56 PECHS Block 2, Karachi", visitCount: 4 },
    { name: "Hira Qureshi", phone: "+92 301 6789012", email: "hira.qureshi@email.com", address: "89 Bahadurabad, Karachi", visitCount: 1 },
    { name: "Tariq Shah", phone: "+92 322 7890123", email: "tariq.shah@email.com", address: "34 Saddar, Karachi", visitCount: 6 },
    { name: "Nadia Raza", phone: "+92 334 8901234", email: "nadia.raza@email.com", address: "67 Malir Cantt, Karachi", visitCount: 2 },
    { name: "Faisal Iqbal", phone: "+92 346 9012345", email: "faisal.iqbal@email.com", address: "90 FB Area Block 10, Karachi", visitCount: 8 },
    { name: "Maryam Siddiqui", phone: "+92 313 0123456", email: "maryam.siddiqui@email.com", address: "12 Nazimabad No. 4, Karachi", visitCount: 3 },
  ];

  for (const c of customerData) {
    await prisma.customer.upsert({
      where: { phone: c.phone },
      update: {},
      create: { ...c, totalSpend: Math.floor(Math.random() * 50000) + 5000, lastVisit: new Date("2026-06-15") },
    });
  }

  // ─── Products (first 20 for seed) ─────────────────────
  const productData = [
    { name: "Aviator Classic", brand: "Ray-Ban", model: "RB3025", category: "Frames", type: "Metal", colour: "Gold", size: "58-14-135", costPrice: 4200, salePrice: 7500, stock: 12, barcode: "8056597139489", brandTag: BrandTag.ORIGINAL, priceThreshold: 6000, image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400&h=300&fit=crop" },
    { name: "Wayfarer Original", brand: "Ray-Ban", model: "RB2140", category: "Frames", type: "Acetate", colour: "Black", size: "54-18-150", costPrice: 3800, salePrice: 6900, stock: 8, barcode: "8053672770711", brandTag: BrandTag.ORIGINAL, priceThreshold: 5500, image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=300&fit=crop" },
    { name: "Clubmaster", brand: "Ray-Ban", model: "RB3016", category: "Sunglasses", type: "Acetate", colour: "Tortoise/Gold", size: "51-21-145", costPrice: 5200, salePrice: 9200, stock: 6, barcode: "8053672795646", brandTag: BrandTag.ORIGINAL, priceThreshold: 7500, image: "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=400&h=300&fit=crop" },
    { name: "Holbrook", brand: "Oakley", model: "OO9102", category: "Sunglasses", type: "Plastic", colour: "Matte Black", size: "55-18-137", costPrice: 5500, salePrice: 9800, stock: 4, barcode: "0888392326713", brandTag: BrandTag.ORIGINAL, priceThreshold: 8000, image: "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=400&h=300&fit=crop" },
    { name: "GG Square", brand: "Gucci", model: "GG0010S", category: "Sunglasses", type: "Acetate", colour: "Havana", size: "58-16-145", costPrice: 12000, salePrice: 21500, stock: 3, barcode: "0889652048833", brandTag: BrandTag.ORIGINAL, priceThreshold: 18000, image: "https://images.unsplash.com/photo-1625591342274-013866685ac6?w=400&h=300&fit=crop" },
    { name: "EyeX Titanium", brand: "Titan", model: "TX1045", category: "Frames", type: "Titanium", colour: "Gunmetal", size: "54-17-140", costPrice: 1800, salePrice: 3200, stock: 15, barcode: "8901234567890", brandTag: BrandTag.ORIGINAL, priceThreshold: 2500, image: "https://images.unsplash.com/photo-1614715838608-dd527c46231d?w=400&h=300&fit=crop" },
    { name: "Aqua Square", brand: "Vincent Chase", model: "VC5678", category: "Frames", type: "Acetate", colour: "Transparent Blue", size: "51-18-140", costPrice: 800, salePrice: 1499, stock: 25, barcode: "8904001234501", brandTag: BrandTag.COPY, priceThreshold: 1200, image: "https://images.unsplash.com/photo-1626784215021-2e39ccf971cd?w=400&h=300&fit=crop" },
    { name: "Urban Square", brand: "John Jacobs", model: "JJ1234", category: "Frames", type: "Acetate", colour: "Matte Black", size: "53-18-142", costPrice: 1100, salePrice: 2100, stock: 16, barcode: "8904001234601", brandTag: BrandTag.COPY, priceThreshold: 1700, image: "https://images.unsplash.com/photo-1609902726285-00668009f004?w=400&h=300&fit=crop" },
    { name: "SofLens Daily", brand: "Bausch & Lomb", model: "SL-D30", category: "Contact Lenses", type: "Soft", colour: "Clear", size: "-2.00", costPrice: 550, salePrice: 950, stock: 40, barcode: "3401234567801", brandTag: BrandTag.ORIGINAL, priceThreshold: 750, image: "https://images.unsplash.com/photo-1585399000684-d2f72660f092?w=400&h=300&fit=crop" },
    { name: "Crizal Prevencia", brand: "Essilor", model: "CP-167", category: "Lens Stock", type: "Blue Cut", colour: "Clear", size: "1.67 Index", costPrice: 1200, salePrice: 2800, stock: 25, barcode: "5501234567802", brandTag: BrandTag.ORIGINAL, priceThreshold: 2200 },
    { name: "Progressive Varilux", brand: "Essilor", model: "VX-X", category: "Lens Stock", type: "Progressive", colour: "Clear", size: "1.60 Index", costPrice: 3500, salePrice: 7500, stock: 8, barcode: "5501234567803", brandTag: BrandTag.ORIGINAL, priceThreshold: 6000 },
    { name: "Kids Flex Round", brand: "Titan", model: "TK101", category: "Frames", type: "Plastic", colour: "Red", size: "44-16-120", costPrice: 600, salePrice: 1100, stock: 22, barcode: "8901234567895", brandTag: BrandTag.UNBRANDED, priceThreshold: 800 },
    { name: "Night Drive Yellow", brand: "Vincent Chase", model: "VC-ND1", category: "Sunglasses", type: "Plastic", colour: "Yellow Tint", size: "56-17-140", costPrice: 500, salePrice: 999, stock: 20, barcode: "8904001234507", brandTag: BrandTag.UNBRANDED, priceThreshold: 700 },
    { name: "Computer Pro BLC", brand: "Vincent Chase", model: "VC-BLC", category: "Frames", type: "Plastic", colour: "Matte Grey", size: "52-18-140", costPrice: 650, salePrice: 1199, stock: 28, barcode: "8904001234506", brandTag: BrandTag.COPY, priceThreshold: 900, image: "https://images.unsplash.com/photo-1614715838608-dd527c46231d?w=400&h=300&fit=crop&q=80" },
    { name: "CR-39 Single Vision", brand: "Essilor", model: "SV-CR39", category: "Lens Stock", type: "Single Vision", colour: "Clear", size: "1.50 Index", costPrice: 280, salePrice: 600, stock: 50, barcode: "5501234567801", brandTag: BrandTag.ORIGINAL, priceThreshold: 450 },
  ];

  for (const p of productData) {
    await prisma.product.upsert({
      where: { id: p.barcode },
      update: {},
      create: { ...p, lowStockThreshold: p.stock <= 5 ? 2 : 5 },
    });
  }

  // ─── Suppliers ────────────────────────────────────────
  const supplierData = [
    { name: "Luxottica Pakistan", contact: "Hassan Merchant", phone: "+92 21 3587 4520", email: "orders@luxottica.pk", address: "Plot 15, SITE Area, Karachi", ntn: "4521896-3" },
    { name: "Essilor Pakistan", contact: "Fahad Rana", phone: "+92 42 3578 1234", email: "supply@essilor.pk", address: "22 Industrial Estate, Lahore", ntn: "3218974-1" },
    { name: "Al-Noor Wholesale Optics", contact: "Abdul Waheed", phone: "+92 21 3265 8741", email: "alnoor@wholesale.pk", address: "Jodia Bazaar, Shop 45, Karachi", ntn: "7854123-6" },
  ];

  for (const s of supplierData) {
    await prisma.supplier.upsert({
      where: { id: s.ntn },
      update: {},
      create: { id: s.ntn, ...s },
    });
  }

  console.log("Seed complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
