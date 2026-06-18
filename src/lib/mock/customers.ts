import { Customer } from "./types";

export const customers: Customer[] = [
  {
    id: "c1", name: "Ahmed Khan", phone: "+92 300 1234567", email: "ahmed.khan@email.com",
    address: "45 Tariq Road, Karachi 75400", lastVisit: "2026-06-15", totalSpend: 18500,
    prescriptions: [
      { id: "rx1", date: "2026-06-15", rightEye: { sph: -2.25, cyl: -0.75, axis: 180, pd: 32, add: 0 }, leftEye: { sph: -2.50, cyl: -0.50, axis: 175, pd: 32, add: 0 }, notes: "Updated prescription, complaint of blurred distance vision" },
      { id: "rx2", date: "2025-12-10", rightEye: { sph: -2.00, cyl: -0.75, axis: 180, pd: 32, add: 0 }, leftEye: { sph: -2.25, cyl: -0.50, axis: 175, pd: 32, add: 0 }, notes: "Annual checkup" },
    ],
  },
  {
    id: "c2", name: "Ayesha Malik", phone: "+92 321 2345678", email: "ayesha.malik@email.com",
    address: "12 Zamzama Boulevard, Karachi 75600", lastVisit: "2026-06-12", totalSpend: 24800,
    prescriptions: [
      { id: "rx3", date: "2026-06-12", rightEye: { sph: -4.50, cyl: -1.25, axis: 90, pd: 30, add: 0 }, leftEye: { sph: -4.00, cyl: -1.00, axis: 85, pd: 30, add: 0 }, notes: "High myopia, recommended 1.67 index lenses" },
    ],
  },
  {
    id: "c3", name: "Usman Ali", phone: "+92 333 3456789", email: "usman.ali@email.com",
    address: "78 Shahrah-e-Faisal, Karachi 75350", lastVisit: "2026-06-10", totalSpend: 42300,
    prescriptions: [
      { id: "rx4", date: "2026-06-10", rightEye: { sph: 1.50, cyl: -0.50, axis: 90, pd: 33, add: 2.00 }, leftEye: { sph: 1.75, cyl: -0.25, axis: 85, pd: 33, add: 2.00 }, notes: "Progressive lenses recommended, age-related presbyopia" },
    ],
  },
  {
    id: "c4", name: "Sana Sheikh", phone: "+92 312 4567890", email: "sana.sheikh@email.com",
    address: "34 DHA Phase 5, Karachi 75500", lastVisit: "2026-06-08", totalSpend: 15200,
    prescriptions: [
      { id: "rx5", date: "2026-06-08", rightEye: { sph: -1.00, cyl: 0, axis: 0, pd: 31, add: 0 }, leftEye: { sph: -1.25, cyl: -0.25, axis: 180, pd: 31, add: 0 }, notes: "Mild myopia, interested in contact lenses" },
    ],
  },
  {
    id: "c5", name: "Bilal Hussain", phone: "+92 345 5678901", email: "bilal.h@email.com",
    address: "56 Bahadurabad, Karachi 75400", lastVisit: "2026-06-05", totalSpend: 31500,
    prescriptions: [
      { id: "rx6", date: "2026-06-05", rightEye: { sph: -3.00, cyl: -1.50, axis: 170, pd: 34, add: 0 }, leftEye: { sph: -3.25, cyl: -1.75, axis: 10, pd: 34, add: 0 }, notes: "Astigmatism correction, blue-cut coating requested" },
    ],
  },
  {
    id: "c6", name: "Hira Qureshi", phone: "+92 301 6789012", email: "hira.q@email.com",
    address: "89 Gulshan-e-Iqbal Block 13, Karachi 75300", lastVisit: "2026-05-28", totalSpend: 9800,
    prescriptions: [
      { id: "rx7", date: "2026-05-28", rightEye: { sph: -0.50, cyl: -0.25, axis: 90, pd: 30, add: 0 }, leftEye: { sph: -0.75, cyl: 0, axis: 0, pd: 30, add: 0 }, notes: "Computer use strain, anti-fatigue lenses" },
    ],
  },
  {
    id: "c7", name: "Tariq Shah", phone: "+92 322 7890123", email: "tariq.shah@email.com",
    address: "23 Clifton Block 9, Karachi 75600", lastVisit: "2026-05-20", totalSpend: 56700,
    prescriptions: [
      { id: "rx8", date: "2026-05-20", rightEye: { sph: 2.00, cyl: -0.75, axis: 180, pd: 33, add: 2.50 }, leftEye: { sph: 2.25, cyl: -0.50, axis: 175, pd: 33, add: 2.50 }, notes: "Varilux progressive, premium coating" },
    ],
  },
  {
    id: "c8", name: "Nadia Raza", phone: "+92 311 8901234", email: "nadia.r@email.com",
    address: "67 North Nazimabad Block H, Karachi 74700", lastVisit: "2026-05-15", totalSpend: 13400,
    prescriptions: [
      { id: "rx9", date: "2026-05-15", rightEye: { sph: -1.75, cyl: -0.50, axis: 165, pd: 30, add: 0 }, leftEye: { sph: -2.00, cyl: -0.75, axis: 15, pd: 30, add: 0 }, notes: "Photochromic lenses for outdoor use" },
    ],
  },
  {
    id: "c9", name: "Faisal Iqbal", phone: "+92 334 9012345", email: "faisal.i@email.com",
    address: "101 PECHS Block 2, Karachi 75400", lastVisit: "2026-05-10", totalSpend: 8200,
    prescriptions: [
      { id: "rx10", date: "2026-05-10", rightEye: { sph: -5.00, cyl: -2.00, axis: 175, pd: 33, add: 0 }, leftEye: { sph: -5.50, cyl: -2.25, axis: 5, pd: 33, add: 0 }, notes: "High myopia+astigmatism, 1.74 index recommended" },
    ],
  },
  {
    id: "c10", name: "Maryam Siddiqui", phone: "+92 302 0123456", email: "maryam.s@email.com",
    address: "45 Gulistan-e-Jauhar Block 15, Karachi 75290", lastVisit: "2026-05-05", totalSpend: 21600,
    prescriptions: [
      { id: "rx11", date: "2026-05-05", rightEye: { sph: 0.75, cyl: -0.25, axis: 90, pd: 31, add: 1.50 }, leftEye: { sph: 1.00, cyl: -0.50, axis: 85, pd: 31, add: 1.50 }, notes: "Early presbyopia, bifocal or progressive" },
    ],
  },
  {
    id: "c11", name: "Kamran Butt", phone: "+92 313 1234567", email: "kamran.b@email.com",
    address: "33 Saddar, Karachi 74400", lastVisit: "2026-04-28", totalSpend: 7500,
    prescriptions: [
      { id: "rx12", date: "2026-04-28", rightEye: { sph: -1.50, cyl: 0, axis: 0, pd: 34, add: 0 }, leftEye: { sph: -1.50, cyl: -0.25, axis: 180, pd: 34, add: 0 }, notes: "Simple myopia, standard lenses" },
    ],
  },
  {
    id: "c12", name: "Zainab Ahmed", phone: "+92 335 2345678", email: "zainab.a@email.com",
    address: "78 Nazimabad Block 3, Karachi 74600", lastVisit: "2026-04-20", totalSpend: 19200,
    prescriptions: [
      { id: "rx13", date: "2026-04-20", rightEye: { sph: -3.50, cyl: -1.00, axis: 170, pd: 30, add: 0 }, leftEye: { sph: -3.75, cyl: -0.75, axis: 10, pd: 30, add: 0 }, notes: "Fashion frames preference, wants thin lenses" },
    ],
  },
  {
    id: "c13", name: "Naveed Chaudhry", phone: "+92 303 3456789", email: "naveed.c@email.com",
    address: "12 Korangi Industrial Area, Karachi 74900", lastVisit: "2026-04-15", totalSpend: 5400,
    prescriptions: [
      { id: "rx14", date: "2026-04-15", rightEye: { sph: -0.75, cyl: -0.50, axis: 90, pd: 33, add: 0 }, leftEye: { sph: -1.00, cyl: -0.25, axis: 85, pd: 33, add: 0 }, notes: "IT professional, blue-cut coating for screen use" },
    ],
  },
  {
    id: "c14", name: "Bushra Waheed", phone: "+92 346 4567890", email: "bushra.w@email.com",
    address: "56 FB Area Block 10, Karachi 75950", lastVisit: "2026-04-10", totalSpend: 35800,
    prescriptions: [
      { id: "rx15", date: "2026-04-10", rightEye: { sph: 2.50, cyl: -1.00, axis: 180, pd: 31, add: 2.75 }, leftEye: { sph: 2.75, cyl: -0.75, axis: 175, pd: 31, add: 2.75 }, notes: "Advanced presbyopia, premium progressive" },
    ],
  },
  {
    id: "c15", name: "Imran Shahzad", phone: "+92 314 5678901", email: "imran.s@email.com",
    address: "90 Shaheed-e-Millat Road, Karachi 75350", lastVisit: "2026-04-05", totalSpend: 11300,
    prescriptions: [
      { id: "rx16", date: "2026-04-05", rightEye: { sph: -2.75, cyl: -0.50, axis: 180, pd: 34, add: 0 }, leftEye: { sph: -2.50, cyl: -0.75, axis: 175, pd: 34, add: 0 }, notes: "Sports eyewear interest, impact-resistant polycarbonate" },
    ],
  },
];
