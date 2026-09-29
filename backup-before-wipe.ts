import "dotenv/config";
import { db } from "./src/lib/db";
import * as fs from "fs";
async function main() {
  const data = {
    products: await db.product.findMany(),
    customers: await db.customer.findMany(),
    sales: await db.sale.findMany({ include: { items: true } }),
    returns: await db.return.findMany({ include: { items: true } }),
    labOrders: await db.labOrder.findMany(),
    prescriptions: await db.prescription.findMany(),
    users: await db.user.findMany(),
  };
  const path = "./backup-before-mock-data-wipe.json";
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
  console.log("Backup written to", path);
  console.log("Products:", data.products.length, "Customers:", data.customers.length, "Sales:", data.sales.length, "Returns:", data.returns.length, "LabOrders:", data.labOrders.length, "Prescriptions:", data.prescriptions.length);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
