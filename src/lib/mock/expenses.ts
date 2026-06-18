import { Expense, ShopSettings, User } from "./types";

export const expenses: Expense[] = [
  { id: "e1", date: "2026-06-18", category: "Rent", description: "Monthly shop rent - Tariq Road", amount: 45000, paidBy: "Bank Transfer" },
  { id: "e2", date: "2026-06-18", category: "Utilities", description: "Electricity bill - June (K-Electric)", amount: 8500, paidBy: "Bank Transfer" },
  { id: "e3", date: "2026-06-17", category: "Salary", description: "Staff salaries - June first half", amount: 65000, paidBy: "Bank Transfer" },
  { id: "e4", date: "2026-06-16", category: "Maintenance", description: "AC servicing for showroom", amount: 3500, paidBy: "Cash" },
  { id: "e5", date: "2026-06-15", category: "Marketing", description: "Google Ads - local campaign", amount: 5000, paidBy: "Card" },
  { id: "e6", date: "2026-06-14", category: "Supplies", description: "Cleaning supplies & tissue rolls", amount: 1200, paidBy: "Cash" },
  { id: "e7", date: "2026-06-13", category: "Transport", description: "TCS courier for lab order delivery", amount: 800, paidBy: "Cash" },
  { id: "e8", date: "2026-06-12", category: "Marketing", description: "Printed flyers for summer sale", amount: 2500, paidBy: "Cash" },
  { id: "e9", date: "2026-06-10", category: "Maintenance", description: "Display stand repair", amount: 1800, paidBy: "Cash" },
  { id: "e10", date: "2026-06-08", category: "Utilities", description: "PTCL internet & phone bill", amount: 3200, paidBy: "Bank Transfer" },
  { id: "e11", date: "2026-06-05", category: "Supplies", description: "Lens cleaning solution stock", amount: 4500, paidBy: "Card" },
  { id: "e12", date: "2026-06-03", category: "Transport", description: "Staff travel reimbursement", amount: 2200, paidBy: "Cash" },
  { id: "e13", date: "2026-06-01", category: "Insurance", description: "Shop insurance premium - quarterly", amount: 12000, paidBy: "Bank Transfer" },
  { id: "e14", date: "2026-05-28", category: "Rent", description: "Monthly shop rent - Dolmen Mall", amount: 35000, paidBy: "Bank Transfer" },
  { id: "e15", date: "2026-05-25", category: "Maintenance", description: "CCTV camera replacement", amount: 6500, paidBy: "Card" },
];

export const shopSettings: ShopSettings = {
  name: "Noor Optics",
  address: "45 Tariq Road, Karachi, Sindh 75400",
  phone: "+92 21 3456 7890",
  email: "info@nooroptics.pk",
  gst: "1234567-8",
  taxRate: 0,
  receiptFooter: "Thank you for choosing Noor Optics! Your vision is our mission.",
};

export const users: User[] = [
  { id: "u1", name: "Dr. Asif Mahmood", email: "asif@nooroptics.pk", role: "Owner", avatar: "AM", active: true },
  { id: "u2", name: "Rabia Hassan", email: "rabia@nooroptics.pk", role: "Manager", avatar: "RH", active: true },
  { id: "u3", name: "Waqar Younis", email: "waqar@nooroptics.pk", role: "Cashier", avatar: "WY", active: true },
  { id: "u4", name: "Saima Noor", email: "saima@nooroptics.pk", role: "Cashier", avatar: "SN", active: false },
];
