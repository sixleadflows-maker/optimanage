import { WhatsAppMessage } from "./types";

export const whatsappTemplates = [
  { id: "t1", name: "Order Ready", message: "Hi {name}! Your order at Noor Optics is ready for pickup. Please visit our store at your convenience. Thank you! 🕶️" },
  { id: "t2", name: "Eye Test Reminder", message: "Dear {name}, it's been a while since your last eye checkup at Noor Optics. Book your appointment today for a comprehensive eye test! 👁️" },
  { id: "t3", name: "Lens Change Reminder", message: "Hi {name}! Based on your last visit, it might be time to update your lenses. Drop by Noor Optics for a quick check! 🔍" },
  { id: "t4", name: "Payment Reminder", message: "Dear {name}, this is a gentle reminder about your pending balance of {amount} at Noor Optics. Please clear it at your earliest convenience." },
  { id: "t5", name: "Promotion", message: "🎉 Special Offer at Noor Optics! Get {discount}% off on all {category}. Valid till {date}. Visit us today!" },
  { id: "t6", name: "Thank You", message: "Thank you for shopping at Noor Optics, {name}! We hope you love your new {product}. See you again! ✨" },
];

export const whatsappMessages: WhatsAppMessage[] = [
  { id: "wm1", to: "+92 300 1234567", customerName: "Ahmed Khan", template: "Order Ready", message: "Hi Ahmed! Your order at Noor Optics is ready for pickup. Please visit our store at your convenience. Thank you! 🕶️", sentAt: "2026-06-18T09:30:00", status: "Read" },
  { id: "wm2", to: "+92 321 2345678", customerName: "Ayesha Malik", template: "Payment Reminder", message: "Dear Ayesha, this is a gentle reminder about your pending balance of Rs.17,800 at Noor Optics. Please clear it at your earliest convenience.", sentAt: "2026-06-17T15:00:00", status: "Delivered" },
  { id: "wm3", to: "+92 345 5678901", customerName: "Bilal Hussain", template: "Order Ready", message: "Hi Bilal! Your Oakley Holbrook sunglasses with blue-cut lenses are ready for pickup. Please visit our store. Thank you! 🕶️", sentAt: "2026-06-16T11:00:00", status: "Read" },
  { id: "wm4", to: "+92 312 4567890", customerName: "Sana Sheikh", template: "Thank You", message: "Thank you for shopping at Noor Optics, Sana! We hope you love your new SofLens Daily lenses. See you again! ✨", sentAt: "2026-06-16T17:00:00", status: "Delivered" },
  { id: "wm5", to: "+92 322 7890123", customerName: "Tariq Shah", template: "Eye Test Reminder", message: "Dear Tariq, it's been a while since your last eye checkup at Noor Optics. Book your appointment today for a comprehensive eye test! 👁️", sentAt: "2026-06-15T10:00:00", status: "Sent" },
  { id: "wm6", to: "+92 335 2345678", customerName: "Zainab Ahmed", template: "Promotion", message: "🎉 Special Offer at Noor Optics! Get 20% off on all Sunglasses. Valid till 30 June. Visit us today!", sentAt: "2026-06-14T12:00:00", status: "Read" },
  { id: "wm7", to: "+92 346 4567890", customerName: "Bushra Waheed", template: "Lens Change Reminder", message: "Hi Bushra! Based on your last visit, it might be time to update your progressive lenses. Drop by Noor Optics for a quick check! 🔍", sentAt: "2026-06-13T14:30:00", status: "Delivered" },
  { id: "wm8", to: "+92 303 3456789", customerName: "Naveed Chaudhry", template: "Payment Reminder", message: "Dear Naveed, this is a gentle reminder about your pending balance of Rs.3,500 at Noor Optics. Please clear it at your earliest convenience.", sentAt: "2026-06-12T09:00:00", status: "Failed" },
  { id: "wm9", to: "+92 301 6789012", customerName: "Hira Qureshi", template: "Thank You", message: "Thank you for shopping at Noor Optics, Hira! We hope you love your new anti-fatigue glasses. See you again! ✨", sentAt: "2026-06-15T18:00:00", status: "Read" },
  { id: "wm10", to: "+92 334 9012345", customerName: "Faisal Iqbal", template: "Promotion", message: "🎉 Special Offer at Noor Optics! Get 15% off on all Frames. Valid till 30 June. Visit us today!", sentAt: "2026-06-10T11:00:00", status: "Delivered" },
];
