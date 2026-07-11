"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Product } from "@/lib/mock/types";
import { formatCurrency } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { SHOP_NAME } from "@/lib/constants";
import { createSale, type CreateSaleInput } from "@/lib/actions/sales";
import { getDrafts, addDraft, removeDraft, type OfflineDraft } from "@/lib/offlineDrafts";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Minus, Trash2, X, User, CreditCard,
  Banknote, Building2, Smartphone, Printer, MessageCircle, Receipt,
  Glasses, ChevronDown, ChevronUp, TrendingUp, Lock, Edit3,
  WifiOff, UploadCloud, ScanLine,
} from "lucide-react";
import { firstImage } from "@/lib/utils/images";
import { LensLoader } from "@/components/ui/LensLoader";

const KNOWN_SALE_ERRORS = ["Unauthorized", "Cart is empty", "Custom lens name is required", "Selected staff member not found"];
function isKnownValidationError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return KNOWN_SALE_ERRORS.includes(err.message) || err.message.startsWith("Product not found:");
}

interface CartItem {
  productId: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  discount: number;
}

interface POSCustomer {
  id: string;
  name: string;
  phone: string;
}

interface StaffMember {
  id: string;
  name: string;
}

interface SaleResult {
  invoiceNo: string;
  orderTakenByName: string;
  billGeneratedByName: string;
  date: string;
}

const EMPTY_RX = {
  rightSph: "", rightCyl: "", rightAxis: "", rightPd: "", rightAdd: "",
  leftSph: "", leftCyl: "", leftAxis: "", leftPd: "", leftAdd: "",
  notes: "",
};

export function POSClient({
  products, customers, staff, currentUserId, canSeeCosts,
}: {
  products: Product[];
  customers: POSCustomer[];
  staff: StaffMember[];
  currentUserId: string;
  canSeeCosts: boolean;
}) {
  const { showToast } = useApp();
  const router = useRouter();
  const [entryMode, setEntryMode] = useState<"choose" | "manual" | "scan">("choose");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [orderTakenBy, setOrderTakenBy] = useState(currentUserId);
  const [billGeneratedBy, setBillGeneratedBy] = useState(currentUserId);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentType, setPaymentType] = useState<"Full" | "Advance" | "Balance">("Full");
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<OfflineDraft[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showJob, setShowJob] = useState(false);
  const [lensProductId, setLensProductId] = useState("");
  const [lensSearch, setLensSearch] = useState("");
  const [useCustomLens, setUseCustomLens] = useState(false);
  const [customLensName, setCustomLensName] = useState("");
  const [customLensPrice, setCustomLensPrice] = useState(0);
  const [labCharges, setLabCharges] = useState(0);
  const [fittingCharges, setFittingCharges] = useState(0);

  const [recordRx, setRecordRx] = useState(false);
  const [rxIsOwn, setRxIsOwn] = useState(false);
  const [rx, setRx] = useState({ ...EMPTY_RX });
  const [poppedId, setPoppedId] = useState<string | null>(null);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pop = (productId: string) => {
    setPoppedId(productId);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPoppedId((cur) => (cur === productId ? null : cur)), 420);
  };

  // Printing only the thermal receipt or only the A4 invoice (not the whole
  // dashboard page around it) is done with a class toggled directly on
  // document.body right before print, rather than React state, so there's
  // no risk of the print firing before a state update has actually committed.
  const printOnly = (mode: "thermal" | "a4") => {
    document.body.classList.add(`printing-${mode}`);
    window.print();
    document.body.classList.remove(`printing-${mode}`);
  };

  // Offline sale drafts are stored in localStorage, not component state, so
  // they survive a page reload — load whatever's already queued on mount.
  useEffect(() => {
    setDrafts(getDrafts());
  }, []);

  const syncDrafts = async () => {
    if (drafts.length === 0 || syncing) return;
    setSyncing(true);
    let succeeded = 0;
    let failed = 0;
    for (const draft of drafts) {
      try {
        await createSale(draft.input);
        removeDraft(draft.id);
        succeeded++;
      } catch {
        failed++;
      }
    }
    setDrafts(getDrafts());
    setSyncing(false);
    if (failed === 0) {
      showToast(`Synced ${succeeded} offline sale${succeeded === 1 ? "" : "s"}`, "success");
    } else {
      showToast(`Synced ${succeeded}, ${failed} still pending — will retry next time`, "error");
    }
    router.refresh();
  };

  const lensProducts = useMemo(
    () => products.filter((p) => p.category === "Lens Stock" || p.category === "Contact Lenses"),
    [products]
  );

  const filteredProducts = useMemo(() => {
    if (!search) return products.slice(0, 12);
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        p.barcode.includes(q)
    );
  }, [products, search]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 5);
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [customers, customerSearch]);

  const filteredLensProducts = useMemo(() => {
    if (!lensSearch) return lensProducts.slice(0, 6);
    const q = lensSearch.toLowerCase();
    return lensProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [lensProducts, lensSearch]);

  const lensProduct = products.find((p) => p.id === lensProductId);

  const addToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    pop(productId);
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { productId, name: product.name, brand: product.brand, price: product.salePrice, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const updateItemDiscount = (productId: string, discount: number) => {
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, discount } : i))
    );
  };

  const cartSubtotal = cart.reduce((sum, i) => sum + i.price * i.quantity - i.discount, 0);
  const customLensAmount = useCustomLens ? customLensPrice : 0;
  const subtotal = cartSubtotal + customLensAmount;
  const total = subtotal - invoiceDiscount;
  const customer = customers.find((c) => c.id === selectedCustomer);

  // Profitability: real cost = product costs + lab + fitting charges. A
  // manually-entered lens has no known cost, so it's assumed zero-margin
  // (its price counts as its own cost) rather than overstating profit.
  const itemCost = cart.reduce((sum, i) => {
    const p = products.find((pr) => pr.id === i.productId);
    return sum + (p ? p.costPrice * i.quantity : 0);
  }, 0);
  const totalCost = itemCost + customLensAmount + labCharges + fittingCharges;
  const profit = total - totalCost;
  const margin = total > 0 ? (profit / total) * 100 : 0;
  const hasSaleableItems = cart.length > 0 || (useCustomLens && customLensPrice > 0);

  const selectLens = (id: string) => {
    if (lensProductId && lensProductId !== id) {
      setCart((prev) => prev.filter((i) => i.productId !== lensProductId));
    }
    setLensProductId(id);
    setLensSearch("");
    if (id) addToCart(id);
  };

  const clearLens = () => {
    if (lensProductId) {
      setCart((prev) => prev.filter((i) => i.productId !== lensProductId));
    }
    setLensProductId("");
  };

  // Barcode scanners type the code then send Enter — add exact matches straight to the cart.
  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const q = search.trim();
    if (!q) return;
    let match = products.find((p) => p.barcode && p.barcode === q);
    if (!match && filteredProducts.length === 1) match = filteredProducts[0];
    if (match) {
      addToCart(match.id);
      setSearch("");
      setEntryMode("manual");
      showToast(`Added ${match.name}`, "success");
    } else {
      showToast("No product matches that barcode", "error");
    }
  };

  const resetSale = () => {
    setEntryMode("choose");
    setShowReceipt(false);
    setShowSuccess(false);
    setCart([]);
    setInvoiceDiscount(0);
    setSelectedCustomer("");
    setAdvanceAmount(0);
    setPaymentType("Full");
    setPaymentMethod("Cash");
    setSaleResult(null);
    setShowJob(false);
    setLensProductId("");
    setLensSearch("");
    setUseCustomLens(false);
    setCustomLensName("");
    setCustomLensPrice(0);
    setLabCharges(0);
    setFittingCharges(0);
    setRecordRx(false);
    setRxIsOwn(false);
    setRx({ ...EMPTY_RX });
    setOrderTakenBy(currentUserId);
    setBillGeneratedBy(currentUserId);
    router.refresh();
  };

  const num = (v: string) => (v === "" ? 0 : Number(v));

  const completeSale = async () => {
    if (!hasSaleableItems) return;
    if (paymentType === "Advance" && advanceAmount <= 0) {
      showToast("Enter the advance amount received", "error");
      return;
    }
    if (recordRx && !selectedCustomer) {
      showToast("Select a customer to save the prescription", "error");
      return;
    }
    if (useCustomLens && (!customLensName.trim() || customLensPrice <= 0)) {
      showToast("Enter a name and price for the custom lens", "error");
      return;
    }
    const saleInput: CreateSaleInput = {
      items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price, discount: i.discount })),
      customerId: selectedCustomer || undefined,
      paymentMethod,
      paymentType,
      advanceAmount,
      invoiceDiscount,
      lensProductId: lensProductId || undefined,
      customLensName: useCustomLens ? customLensName.trim() : undefined,
      customLensPrice: useCustomLens ? customLensPrice : undefined,
      labCharges,
      fittingCharges,
      createdById: orderTakenBy || currentUserId,
      receivedById: billGeneratedBy || currentUserId,
      prescription: recordRx ? {
        rightSph: num(rx.rightSph), rightCyl: num(rx.rightCyl), rightAxis: num(rx.rightAxis), rightPd: num(rx.rightPd), rightAdd: num(rx.rightAdd),
        leftSph: num(rx.leftSph), leftCyl: num(rx.leftCyl), leftAxis: num(rx.leftAxis), leftPd: num(rx.leftPd), leftAdd: num(rx.leftAdd),
        notes: rx.notes,
        isOwnPrescription: rxIsOwn,
      } : undefined,
    };
    setSaving(true);
    try {
      const res = await createSale(saleInput);
      setSaleResult({
        invoiceNo: res.invoiceNo,
        orderTakenByName: res.orderTakenByName,
        billGeneratedByName: res.billGeneratedByName,
        date: new Date().toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      });
      setShowSuccess(true);
      showToast(`Sale completed — ${res.invoiceNo}`, "success");
      setTimeout(() => {
        setShowSuccess(false);
        setShowReceipt(true);
      }, 750);
    } catch (err) {
      if (isKnownValidationError(err)) {
        showToast(err instanceof Error ? err.message : "Could not complete the sale.", "error");
      } else {
        // Not a validation error the server would raise — most likely the
        // request never reached the server at all. Keep the sale as a local
        // draft instead of losing it; it can be pushed through once back online.
        const draft = addDraft(saleInput, {
          customerName: customer?.name ?? "Walk-in",
          itemCount: cart.length,
          total,
        });
        setDrafts((prev) => [...prev, draft]);
        showToast("No connection — sale saved as an offline draft. Sync it once you're back online.", "info");
        resetSale();
      }
    } finally {
      setSaving(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm">
        <div className="glass-card px-10 py-9 flex flex-col items-center gap-3 success-pop">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6d5ef0] to-[#14b8a6] flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path className="check-draw" d="M4 12.5l5 5L20 6" />
            </svg>
          </div>
          <p className="text-sm font-semibold font-display">Sale completed</p>
        </div>
      </div>
    );
  }

  if (showReceipt && saleResult) {
    return (
      <div className="animate-slide-right">
        <div className="flex items-center justify-between mb-6 no-print">
          <h1 className="text-2xl font-bold">Invoice Preview</h1>
          <button onClick={resetSale} className="px-4 py-2 glass-card text-sm font-medium cursor-pointer">
            ← New Sale
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Thermal Receipt (80mm)
            </h3>
            <div className="receipt-paper mx-auto rounded-lg shadow-lg">
              <div className="text-center border-b border-dashed border-gray-400 pb-2 mb-2">
                <p className="font-bold text-sm">{SHOP_NAME}</p>
                <p className="text-[10px]">45 Tariq Road, Karachi 75400</p>
                <p className="text-[10px]">Ph: +92 21 3456 7890</p>
                <p className="text-[10px]">NTN: 1234567-8</p>
              </div>
              <p className="text-[10px]">INV: {saleResult.invoiceNo}</p>
              <p className="text-[10px]">Date: {saleResult.date}</p>
              <p className="text-[10px]">Order taken by: {saleResult.orderTakenByName}</p>
              <p className="text-[10px]">Bill generated by: {saleResult.billGeneratedByName}</p>
              {customer && <p className="text-[10px]">Customer: {customer.name}</p>}
              {recordRx && (
                <div className="text-[10px] mt-1 pt-1 border-t border-dashed border-gray-400">
                  <p className="font-medium">Prescription{rxIsOwn ? " (Customer's Own)" : ""}</p>
                  <p>OD: SPH {rx.rightSph || 0} CYL {rx.rightCyl || 0} AXIS {rx.rightAxis || 0} PD {rx.rightPd || 0} ADD {rx.rightAdd || 0}</p>
                  <p>OS: SPH {rx.leftSph || 0} CYL {rx.leftCyl || 0} AXIS {rx.leftAxis || 0} PD {rx.leftPd || 0} ADD {rx.leftAdd || 0}</p>
                </div>
              )}
              <div className="border-t border-dashed border-gray-400 mt-2 pt-2">
                {cart.map((item) => (
                  <div key={item.productId} className="mb-1">
                    <p className="text-[10px] font-medium">{item.name}</p>
                    <div className="flex justify-between text-[10px]">
                      <span>{item.quantity} x {formatCurrency(item.price)}</span>
                      <span>{formatCurrency(item.price * item.quantity - item.discount)}</span>
                    </div>
                    {item.discount > 0 && (
                      <p className="text-[10px] text-right">Disc: -{formatCurrency(item.discount)}</p>
                    )}
                  </div>
                ))}
                {useCustomLens && customLensAmount > 0 && (
                  <div className="mb-1">
                    <p className="text-[10px] font-medium">{customLensName}</p>
                    <div className="flex justify-between text-[10px]">
                      <span>1 x {formatCurrency(customLensAmount)}</span>
                      <span>{formatCurrency(customLensAmount)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-dashed border-gray-400 mt-2 pt-2 space-y-0.5">
                <div className="flex justify-between text-[10px]"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                {invoiceDiscount > 0 && (
                  <div className="flex justify-between text-[10px]"><span>Discount</span><span>-{formatCurrency(invoiceDiscount)}</span></div>
                )}
                <div className="flex justify-between text-xs font-bold border-t border-dashed border-gray-400 pt-1 mt-1">
                  <span>TOTAL</span><span>{formatCurrency(total)}</span>
                </div>
                <p className="text-[10px]">Payment: {paymentMethod} ({paymentType})</p>
                {paymentType === "Advance" && (
                  <>
                    <p className="text-[10px]">Paid: {formatCurrency(advanceAmount)}</p>
                    <p className="text-[10px]">Balance: {formatCurrency(total - advanceAmount)}</p>
                  </>
                )}
              </div>
              <p className="text-center text-[9px] mt-3 pt-2 border-t border-dashed border-gray-400">
                Thank you for choosing {SHOP_NAME}!
              </p>
            </div>
            <button onClick={() => printOnly("thermal")}
              className="no-print w-full mt-4 flex items-center justify-center gap-2 py-2.5 glass-card text-sm font-medium cursor-pointer">
              <Printer className="w-4 h-4" /> Print Receipt
            </button>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4">A4 Invoice</h3>
            <div className="a4-invoice bg-white text-black rounded-lg p-6 shadow-lg text-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#6d5ef0]">{SHOP_NAME}</h2>
                  <p className="text-xs text-gray-500">45 Tariq Road, Karachi · NTN: 1234567-8</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">INVOICE</p>
                  <p className="text-xs text-gray-500">{saleResult.invoiceNo}</p>
                  <p className="text-xs text-gray-500">{saleResult.date}</p>
                </div>
              </div>
              {customer && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Bill To</p>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-xs text-gray-500">{customer.phone}</p>
                </div>
              )}
              <table className="w-full text-xs mb-4">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2">Item</th>
                    <th className="text-center py-2">Qty</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.productId} className="border-b border-gray-100">
                      <td className="py-2">{item.brand} {item.name}</td>
                      <td className="text-center py-2">{item.quantity}</td>
                      <td className="text-right py-2">{formatCurrency(item.price)}</td>
                      <td className="text-right py-2">{formatCurrency(item.price * item.quantity - item.discount)}</td>
                    </tr>
                  ))}
                  {useCustomLens && customLensAmount > 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2">{customLensName}</td>
                      <td className="text-center py-2">1</td>
                      <td className="text-right py-2">{formatCurrency(customLensAmount)}</td>
                      <td className="text-right py-2">{formatCurrency(customLensAmount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="border-t-2 border-gray-200 pt-3 space-y-1 text-right">
                <p>Subtotal: {formatCurrency(subtotal)}</p>
                {invoiceDiscount > 0 && <p>Discount: -{formatCurrency(invoiceDiscount)}</p>}
                <p className="text-lg font-bold text-[#6d5ef0]">Total: {formatCurrency(total)}</p>
                <p className="text-xs text-gray-500">Order taken by {saleResult.orderTakenByName} · Bill by {saleResult.billGeneratedByName}</p>
              </div>
            </div>
            <div className="no-print flex gap-3 mt-4">
              <button onClick={() => printOnly("a4")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 glass-card text-sm font-medium cursor-pointer">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={() => {
                  const phone = customer?.phone.replace(/[^0-9]/g, "");
                  const msg = encodeURIComponent(`Thank you for shopping at ${SHOP_NAME}! Your invoice ${saleResult.invoiceNo} total is ${formatCurrency(total)}.`);
                  if (phone) window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
                  else showToast("Select a customer to send WhatsApp", "info");
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-2xl text-sm font-medium hover:bg-[#20bd5a] transition-colors">
                <MessageCircle className="w-4 h-4" /> Send on WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0 && entryMode === "scan") {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6d5ef0]/15 to-[#14b8a6]/15 flex items-center justify-center">
          <ScanLine className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Scan a product to begin</h1>
          <p className="text-sm text-muted-foreground mt-1">Scan any product&apos;s barcode to start this order</p>
        </div>
        <input
          type="text"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKey}
          placeholder="Waiting for scan..."
          className="w-full max-w-sm px-4 py-3 glass-input text-sm text-center"
        />
        <button onClick={() => setEntryMode("choose")} className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer">
          ← Back
        </button>
      </div>
    );
  }

  if (cart.length === 0 && entryMode === "choose") {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div>
          <h1 className="text-2xl font-bold">Point of Sale</h1>
          <p className="text-sm text-muted-foreground mt-1">How would you like to start this order?</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => setEntryMode("manual")}
            className="flex flex-col items-center gap-3 px-10 py-8 glass-card hover:bg-surface-hover transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <span className="text-sm font-semibold">Create New Order</span>
            <span className="text-xs text-muted-foreground">Browse and search products</span>
          </button>
          <button onClick={() => setEntryMode("scan")}
            className="flex flex-col items-center gap-3 px-10 py-8 glass-card hover:bg-surface-hover transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ScanLine className="w-6 h-6 text-primary" />
            </div>
            <span className="text-sm font-semibold">Scan to Create New Order</span>
            <span className="text-xs text-muted-foreground">Scan a barcode to begin</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Point of Sale</h1>
      {drafts.length > 0 && (
        <div className="glass-card p-3 mb-4 flex items-center justify-between gap-3 border border-warning/30">
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-4 h-4 text-warning flex-shrink-0" />
            <p className="text-xs font-medium truncate">
              {drafts.length} offline sale{drafts.length === 1 ? "" : "s"} saved locally — not yet recorded on the server.
            </p>
          </div>
          <button
            onClick={syncDrafts}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-warning text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex-shrink-0"
          >
            {syncing ? <LensLoader light /> : <UploadCloud className="w-3.5 h-3.5" />}
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, brand, model or scan barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKey}
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 glass-input text-sm"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProducts.slice(0, 12).map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product.id)}
                  className="glass-card p-3 text-left hover:border-primary/30 transition-all cursor-pointer group"
                >
                  <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-surface to-muted flex items-center justify-center mb-2 group-hover:scale-[1.02] transition-transform overflow-hidden">
                    {firstImage(product.image) ? (
                      <img src={firstImage(product.image)} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-2xl opacity-40">👓</span>
                    )}
                  </div>
                  <p className="text-xs font-medium truncate">{product.name}</p>
                  <p className="text-[10px] text-muted-foreground">{product.brand}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-sm font-bold text-primary">{formatCurrency(product.salePrice)}</span>
                    <span className={`text-[10px] ${product.stock <= product.lowStockThreshold ? "text-destructive" : "text-muted-foreground"}`}>
                      {product.stock} left
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card p-4 flex flex-col h-fit lg:sticky lg:top-20">
          <h3 className="text-sm font-semibold mb-3">Cart</h3>
          <div className="mb-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search customer by name or phone..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 glass-input text-xs"
              />
            </div>
            {customerSearch && (
              <div className="mt-1 glass rounded-lg p-1 max-h-32 overflow-y-auto">
                {filteredCustomers.length === 0 && (
                  <p className="px-3 py-1.5 text-xs text-muted-foreground">No customers found</p>
                )}
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomer(c.id); setCustomerSearch(""); }}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs"
                  >
                    {c.name} · {c.phone}
                  </button>
                ))}
              </div>
            )}
            {customer && (
              <div className="flex items-center justify-between mt-2 px-2 py-1.5 bg-primary/5 rounded-lg">
                <span className="text-xs font-medium">{customer.name}</span>
                <button onClick={() => setSelectedCustomer("")}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Order taken by</label>
              <select value={orderTakenBy} onChange={(e) => setOrderTakenBy(e.target.value)} className="w-full px-2 py-2 glass-input text-xs">
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Bill generated by</label>
              <select value={billGeneratedBy} onChange={(e) => setBillGeneratedBy(e.target.value)} className="w-full px-2 py-2 glass-input text-xs">
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-3">
            <button
              onClick={() => setShowJob((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-surface hover:bg-surface-hover text-xs font-medium transition-colors"
            >
              <span className="flex items-center gap-2"><Glasses className="w-3.5 h-3.5 text-primary" /> Prescription lens / job</span>
              {showJob ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showJob && (
              <div className="mt-2 space-y-2 p-3 rounded-xl border border-border">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-medium text-muted-foreground block">Lens (adds to order)</label>
                    {!lensProduct && !useCustomLens && (
                      <button onClick={() => setUseCustomLens(true)} className="text-[10px] text-primary font-medium flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> Enter manually
                      </button>
                    )}
                    {useCustomLens && (
                      <button onClick={() => { setUseCustomLens(false); setCustomLensName(""); setCustomLensPrice(0); }} className="text-[10px] text-primary font-medium flex items-center gap-1">
                        <Search className="w-3 h-3" /> Search catalog
                      </button>
                    )}
                  </div>
                  {useCustomLens ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={customLensName} onChange={(e) => setCustomLensName(e.target.value)}
                        placeholder="Lens name" className="w-full px-3 py-2 glass-input text-xs" />
                      <input type="number" value={customLensPrice || ""} onChange={(e) => setCustomLensPrice(Number(e.target.value))}
                        placeholder="Price" className="w-full px-3 py-2 glass-input text-xs" />
                    </div>
                  ) : lensProduct ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-primary/5 rounded-lg">
                      <span className="text-xs font-medium truncate">{lensProduct.brand} {lensProduct.name} — {formatCurrency(lensProduct.salePrice)}</span>
                      <button onClick={clearLens} className="flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Type to search lenses..."
                        value={lensSearch}
                        onChange={(e) => setLensSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 glass-input text-xs"
                      />
                      {lensSearch && (
                        <div className="mt-1 glass rounded-lg p-1 max-h-32 overflow-y-auto">
                          {filteredLensProducts.length === 0 && (
                            <p className="px-3 py-1.5 text-xs text-muted-foreground">No matching lens</p>
                          )}
                          {filteredLensProducts.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => selectLens(p.id)}
                              className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs flex items-center justify-between gap-2"
                            >
                              <span className="truncate">{p.brand} {p.name}</span>
                              <span className="text-muted-foreground flex-shrink-0">{formatCurrency(p.salePrice)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-2">
                    <Lock className="w-2.5 h-2.5" /> Internal costs — not shown to customer
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Lab charges</label>
                      <input type="number" value={labCharges || ""} onChange={(e) => setLabCharges(Number(e.target.value))}
                        className="w-full px-3 py-2 glass-input text-xs" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Fitting charges</label>
                      <input type="number" value={fittingCharges || ""} onChange={(e) => setFittingCharges(Number(e.target.value))}
                        className="w-full px-3 py-2 glass-input text-xs" placeholder="0" />
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium pt-2 border-t border-border cursor-pointer">
                  <input type="checkbox" checked={recordRx} onChange={(e) => setRecordRx(e.target.checked)} className="rounded" />
                  Record prescription (Rx)
                </label>
                {recordRx && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-medium cursor-pointer">
                      <input type="checkbox" checked={rxIsOwn} onChange={(e) => setRxIsOwn(e.target.checked)} className="rounded" />
                      Own Prescription — customer brought this from outside
                    </label>
                    {(["Right Eye (OD)", "Left Eye (OS)"] as const).map((eye) => {
                      const prefix = eye.includes("Right") ? "right" : "left";
                      return (
                        <div key={eye}>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">{eye}</p>
                          <div className="grid grid-cols-5 gap-1">
                            {(["Sph", "Cyl", "Axis", "Pd", "Add"] as const).map((f) => (
                              <div key={f}>
                                <label className="text-[9px] text-muted-foreground block text-center mb-0.5">{f.toUpperCase()}</label>
                                <input type="number" step="0.25" placeholder="0"
                                  value={rx[`${prefix}${f}` as keyof typeof rx]}
                                  onChange={(e) => setRx((p) => ({ ...p, [`${prefix}${f}`]: e.target.value }))}
                                  className="w-full px-1 py-1 glass-input text-[10px] text-center" />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <input type="text" value={rx.notes} onChange={(e) => setRx((p) => ({ ...p, notes: e.target.value }))}
                      className="w-full px-3 py-1.5 glass-input text-[10px]" placeholder="Rx notes (optional)..." />
                    {!selectedCustomer && <p className="text-[10px] text-warning">Select a customer above to save the prescription.</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {!hasSaleableItems ? (
            <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-xs">Click products to add to cart</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.productId} className={`flex items-center gap-2 py-2 px-1.5 -mx-1.5 border-b border-border ${poppedId === item.productId ? "animate-cart-pop" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.brand} · {formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(item.productId, -1)} className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center hover:bg-surface-hover">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, 1)} className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center hover:bg-surface-hover">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="w-14 text-right">
                    <input
                      type="number"
                      value={item.discount || ""}
                      onChange={(e) => updateItemDiscount(item.productId, Number(e.target.value))}
                      placeholder="Disc"
                      className="w-full text-right text-[10px] px-1 py-0.5 glass-input"
                    />
                  </div>
                  <p className="w-16 text-right text-xs font-semibold">{formatCurrency(item.price * item.quantity - item.discount)}</p>
                  <button onClick={() => setCart((prev) => prev.filter((i) => i.productId !== item.productId))}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {hasSaleableItems && (
            <>
              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Invoice Discount</span>
                  <input
                    type="number"
                    value={invoiceDiscount || ""}
                    onChange={(e) => setInvoiceDiscount(Number(e.target.value))}
                    className="w-20 text-right px-2 py-1 glass-input text-xs"
                    placeholder="0"
                  />
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
                {canSeeCosts && (
                  <div className={`flex items-center justify-between text-[11px] mt-1 px-2 py-1.5 rounded-lg ${profit < 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Profit (cost {formatCurrency(totalCost)})</span>
                    <span className="font-semibold">{formatCurrency(profit)} · {margin.toFixed(0)}%</span>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Payment Method</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "Cash", icon: Banknote },
                      { id: "Card", icon: CreditCard },
                      { id: "Bank Transfer", icon: Building2 },
                      { id: "JazzCash", icon: Smartphone },
                    ].map((pm) => (
                      <button
                        key={pm.id}
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] transition-all ${
                          paymentMethod === pm.id ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"
                        }`}
                      >
                        <pm.icon className="w-3.5 h-3.5" />
                        {pm.id === "Bank Transfer" ? "Bank" : pm.id}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Payment Type</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["Full", "Advance", "Balance"] as const).map((pt) => (
                      <button
                        key={pt}
                        onClick={() => setPaymentType(pt)}
                        className={`py-2 rounded-xl text-xs font-medium transition-all ${
                          paymentType === pt ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"
                        }`}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentType === "Advance" && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Advance Amount</p>
                    <input
                      type="number"
                      value={advanceAmount || ""}
                      onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 glass-input text-sm"
                      placeholder="Enter advance amount"
                    />
                  </div>
                )}

                <button
                  onClick={completeSale}
                  disabled={saving}
                  className="w-full py-3 bg-primary text-white rounded-2xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <LensLoader light />}
                  {saving ? "Processing…" : `Complete Sale — ${formatCurrency(total)}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
