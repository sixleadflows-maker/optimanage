"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Product } from "@/lib/mock/types";
import { formatCurrency } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { DISCOUNT_PERCENTAGES, PAYMENT_TYPE_LABEL } from "@/lib/constants";
import { createSale, type CreateSaleInput } from "@/lib/actions/sales";
import { createCustomer } from "@/lib/actions/customers";
import { getDrafts, addDraft, removeDraft, type OfflineDraft } from "@/lib/offlineDrafts";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Minus, Trash2, X, User, CreditCard,
  Banknote, Building2, Smartphone, Printer, MessageCircle, Receipt,
  Glasses, ChevronDown, ChevronUp, Lock, Edit3,
  WifiOff, UploadCloud, ScanLine, UserPlus, PenLine,
} from "lucide-react";
import { firstImage } from "@/lib/utils/images";
import { LensLoader } from "@/components/ui/LensLoader";
import { ThermalReceipt, A4Invoice, type InvoiceData, type ShopDetails } from "@/components/invoice/InvoiceDocuments";

interface CartItem {
  // productId for an inventory item; a generated key for a typed-in one.
  key: string;
  productId: string | null;
  name: string;
  brand: string;
  description: string;
  price: number;
  quantity: number;
  discount: number;
}

interface POSCustomer {
  id: string;
  name: string;
  phone: string;
  serialNumber: string;
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
  paid: number;
  balance: number;
}

const EMPTY_RX = {
  rightSph: "", rightCyl: "", rightAxis: "", rightPd: "", rightAdd: "",
  leftSph: "", leftCyl: "", leftAxis: "", leftPd: "", leftAdd: "",
  notes: "",
};

const EMPTY_MANUAL_ITEM = { name: "", description: "", price: "", quantity: "1" };
const EMPTY_NEW_CUSTOMER = { name: "", phone: "", serialNumber: "" };

const PAYMENT_TYPE_HINT = {
  Full: "Customer pays the whole amount now.",
  Advance: "Customer pays part now — the rest is due on collection.",
  Balance: "Nothing is paid now — the whole amount is due later.",
} as const;

export function POSClient({
  products, customers, staff, currentUserId, shop,
}: {
  products: Product[];
  customers: POSCustomer[];
  staff: StaffMember[];
  currentUserId: string;
  shop: ShopDetails;
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
  // Which percentage is selected, if any. Kept alongside the rupee amount so
  // the discount can follow the subtotal as items are added or removed.
  const [discountPct, setDiscountPct] = useState<number | null>(null);
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

  // Typing in an item that isn't in the inventory.
  const [showManualItem, setShowManualItem] = useState(false);
  const [manualItem, setManualItem] = useState({ ...EMPTY_MANUAL_ITEM });
  const manualCounter = useRef(0);

  // Which cart line's details (description) is being edited.
  const [editingDetailsKey, setEditingDetailsKey] = useState<string | null>(null);

  // Adding a new customer without leaving the sale.
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ ...EMPTY_NEW_CUSTOMER });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [addedCustomers, setAddedCustomers] = useState<POSCustomer[]>([]);

  const pop = (key: string) => {
    setPoppedId(key);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPoppedId((cur) => (cur === key ? null : cur)), 420);
  };

  // Printing only the thermal receipt or only the A4 invoice (not the whole
  // dashboard page around it) is done with a class toggled directly on
  // document.body right before print, rather than React state, so there's
  // no risk of the print firing before a state update has actually committed.
  // The class is removed on the afterprint event (with a timeout fallback) so
  // it stays applied through the browser's print render instead of being torn
  // off synchronously, which could otherwise print a blank or full page.
  const printOnly = (mode: "thermal" | "a4") => {
    const cls = `printing-${mode}`;
    const cleanup = () => {
      document.body.classList.remove(cls);
      window.removeEventListener("afterprint", cleanup);
    };
    document.body.classList.add(cls);
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  };

  // Offline sale drafts are stored in localStorage, not component state, so
  // they survive a page reload — load whatever's already queued on mount.
  useEffect(() => {
    setDrafts(getDrafts());
  }, []);

  // The product list (and the "N left" on each tile) is loaded once when this
  // page opens. A till screen is typically left open all day, so a frame whose
  // quantity was corrected in Inventory afterwards kept showing the old number
  // here — which is how a frame with 1 in stock still read as 0 at the counter.
  // Re-fetch whenever the till is brought back into focus, so picking the tab
  // back up is enough to get current stock. Throttled so tabbing in and out
  // repeatedly doesn't hammer the database.
  useEffect(() => {
    let lastRefresh = Date.now();
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefresh < 30_000) return;
      lastRefresh = Date.now();
      router.refresh();
    };
    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [router]);

  const syncDrafts = async () => {
    if (drafts.length === 0 || syncing) return;
    setSyncing(true);
    let succeeded = 0;
    let failed = 0;
    let lastError = "";
    for (const draft of drafts) {
      try {
        const res = await createSale(draft.input);
        if (res.ok) {
          removeDraft(draft.id);
          succeeded++;
        } else {
          failed++;
          lastError = res.error;
        }
      } catch {
        failed++;
      }
    }
    setDrafts(getDrafts());
    setSyncing(false);
    if (failed === 0) {
      showToast(`Synced ${succeeded} offline sale${succeeded === 1 ? "" : "s"}`, "success");
    } else {
      showToast(`Synced ${succeeded}, ${failed} still pending${lastError ? ` — ${lastError}` : " — will retry next time"}`, "error");
    }
    router.refresh();
  };

  // Customers added from this screen show up straight away, before the page's
  // own customer list has been refreshed.
  const allCustomers = useMemo(
    () => [...customers, ...addedCustomers.filter((a) => !customers.some((c) => c.id === a.id))],
    [customers, addedCustomers]
  );

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
        p.description.toLowerCase().includes(q) ||
        p.barcode.includes(q)
    );
  }, [products, search]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return allCustomers.slice(0, 5);
    const q = customerSearch.toLowerCase();
    return allCustomers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.serialNumber.toLowerCase().includes(q)
    );
  }, [allCustomers, customerSearch]);

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
      const existing = prev.find((i) => i.key === productId);
      if (existing) {
        return prev.map((i) =>
          i.key === productId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        key: productId, productId, name: product.name, brand: product.brand,
        description: product.description, price: product.salePrice, quantity: 1, discount: 0,
      }];
    });
  };

  const addManualItem = () => {
    const name = manualItem.name.trim();
    const price = Number(manualItem.price);
    const quantity = Math.max(1, Math.floor(Number(manualItem.quantity) || 1));
    if (!name) { showToast("Enter the item's name", "error"); return; }
    if (!(price > 0)) { showToast("Enter the item's price", "error"); return; }
    manualCounter.current += 1;
    const key = `manual-${Date.now()}-${manualCounter.current}`;
    setCart((prev) => [...prev, {
      key, productId: null, name, brand: "", description: manualItem.description.trim(), price, quantity, discount: 0,
    }]);
    pop(key);
    setManualItem({ ...EMPTY_MANUAL_ITEM });
    setShowManualItem(false);
    showToast(`Added ${name}`, "success");
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.key === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const updateItemDiscount = (key: string, discount: number) => {
    setCart((prev) =>
      prev.map((i) => (i.key === key ? { ...i, discount } : i))
    );
  };

  const updateItemDescription = (key: string, description: string) => {
    setCart((prev) => prev.map((i) => (i.key === key ? { ...i, description } : i)));
  };

  const openNewCustomer = () => {
    // Whatever was typed into the search box is usually the new customer's
    // name or number, so start the form with it.
    const typed = customerSearch.trim();
    const looksLikePhone = /^[+\d][\d\s-]{5,}$/.test(typed);
    setNewCustomer({ ...EMPTY_NEW_CUSTOMER, name: looksLikePhone ? "" : typed, phone: looksLikePhone ? typed : "" });
    setShowNewCustomer(true);
  };

  const saveNewCustomer = async () => {
    const name = newCustomer.name.trim();
    if (!name) { showToast("Enter the customer's name", "error"); return; }
    setSavingCustomer(true);
    try {
      const res = await createCustomer({
        name, phone: newCustomer.phone, serialNumber: newCustomer.serialNumber,
        email: "", address: "", lastVisit: "",
      });
      if (res.ok) {
        const id = res.id;
        setAddedCustomers((prev) => [...prev, { id, name, phone: newCustomer.phone.trim(), serialNumber: newCustomer.serialNumber.trim() }]);
        setSelectedCustomer(id);
        showToast(`${name} added and selected`, "success");
      } else if (res.existing) {
        // Already on file under that phone number — just use them.
        const existing = res.existing;
        setAddedCustomers((prev) => [...prev, { ...existing, serialNumber: "" }]);
        setSelectedCustomer(existing.id);
        showToast(`${existing.name} is already registered with that number — selected them`, "info");
      } else {
        showToast(res.error, "error");
        return;
      }
      setShowNewCustomer(false);
      setNewCustomer({ ...EMPTY_NEW_CUSTOMER });
      setCustomerSearch("");
    } catch {
      showToast("Could not add the customer — check the connection and try again", "error");
    } finally {
      setSavingCustomer(false);
    }
  };

  const cartSubtotal = cart.reduce((sum, i) => sum + i.price * i.quantity - i.discount, 0);
  const customLensAmount = useCustomLens ? customLensPrice : 0;
  const subtotal = cartSubtotal + customLensAmount;
  const total = subtotal - invoiceDiscount;
  const customer = allCustomers.find((c) => c.id === selectedCustomer);

  // Cost and profit are deliberately not computed or shown here — the till is
  // visible to customers. createSale still records them server-side, so they
  // stay available in Analytics.
  const hasSaleableItems = cart.length > 0 || (useCustomLens && customLensPrice > 0);

  // Picking a percentage works out the rupee amount off the current subtotal.
  const applyDiscountPct = (pct: number | null) => {
    setDiscountPct(pct);
    setInvoiceDiscount(pct === null ? 0 : Math.round((subtotal * pct) / 100));
  };

  // Keep a percentage discount honest as the cart changes: adding another frame
  // to a "10% off" sale should give 10% of the new subtotal, not the old amount.
  useEffect(() => {
    if (discountPct === null) return;
    setInvoiceDiscount(Math.round((subtotal * discountPct) / 100));
  }, [subtotal, discountPct]);

  const selectLens = (id: string) => {
    if (lensProductId && lensProductId !== id) {
      setCart((prev) => prev.filter((i) => i.key !== lensProductId));
    }
    setLensProductId(id);
    setLensSearch("");
    if (id) addToCart(id);
  };

  const clearLens = () => {
    if (lensProductId) {
      setCart((prev) => prev.filter((i) => i.key !== lensProductId));
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
    setDiscountPct(null);
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
    setShowManualItem(false);
    setManualItem({ ...EMPTY_MANUAL_ITEM });
    setEditingDetailsKey(null);
    setShowNewCustomer(false);
    setNewCustomer({ ...EMPTY_NEW_CUSTOMER });
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
      items: cart.map((i) => (i.productId
        ? { productId: i.productId, description: i.description, quantity: i.quantity, unitPrice: i.price, discount: i.discount }
        : { name: i.name, description: i.description, quantity: i.quantity, unitPrice: i.price, discount: i.discount })),
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
      if (!res.ok) {
        // Something about the sale itself (e.g. out of stock) — the server was
        // reached, so this is not an offline situation.
        showToast(res.error, "error");
        return;
      }
      setSaleResult({
        invoiceNo: res.invoiceNo,
        orderTakenByName: res.orderTakenByName,
        billGeneratedByName: res.billGeneratedByName,
        date: new Date().toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        paid: res.paid,
        balance: res.balance,
      });
      setShowSuccess(true);
      showToast(`Sale completed — ${res.invoiceNo}`, "success");
      setTimeout(() => {
        setShowSuccess(false);
        setShowReceipt(true);
      }, 750);
    } catch {
      // The request never got a proper answer — most likely no connection.
      // Keep the sale as a local draft instead of losing it; it can be pushed
      // through once back online.
      const draft = addDraft(saleInput, {
        customerName: customer?.name ?? "Walk-in",
        itemCount: cart.length,
        total,
      });
      setDrafts((prev) => [...prev, draft]);
      showToast("No connection — sale saved as an offline draft. Sync it once you're back online.", "info");
      resetSale();
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
    const invoice: InvoiceData = {
      invoiceNo: saleResult.invoiceNo,
      date: saleResult.date,
      orderTakenBy: saleResult.orderTakenByName,
      billGeneratedBy: saleResult.billGeneratedByName,
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? "",
      lines: [
        ...cart.map((item) => ({
          key: item.key,
          name: `${item.brand} ${item.name}`.trim(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.price,
          discount: item.discount,
          total: item.price * item.quantity - item.discount,
        })),
        ...(useCustomLens && customLensAmount > 0
          ? [{ key: "custom-lens", name: customLensName, quantity: 1, unitPrice: customLensAmount, discount: 0, total: customLensAmount }]
          : []),
      ],
      subtotal,
      discount: invoiceDiscount,
      total,
      paymentMethod,
      paymentStatus: PAYMENT_TYPE_LABEL[paymentType],
      paid: saleResult.paid,
      balance: saleResult.balance,
      prescription: recordRx
        ? {
            right: { sph: rx.rightSph, cyl: rx.rightCyl, axis: rx.rightAxis, pd: rx.rightPd, add: rx.rightAdd },
            left: { sph: rx.leftSph, cyl: rx.leftCyl, axis: rx.leftAxis, pd: rx.leftPd, add: rx.leftAdd },
            isOwn: rxIsOwn,
          }
        : null,
    };

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
            <ThermalReceipt invoice={invoice} shop={shop} />
            <button onClick={() => printOnly("thermal")}
              className="no-print w-full mt-4 flex items-center justify-center gap-2 py-2.5 glass-card text-sm font-medium cursor-pointer">
              <Printer className="w-4 h-4" /> Print Receipt
            </button>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4">A4 Invoice</h3>
            <A4Invoice invoice={invoice} shop={shop} />
            <div className="no-print flex gap-3 mt-4">
              <button onClick={() => printOnly("a4")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 glass-card text-sm font-medium cursor-pointer">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={() => {
                  const phone = customer?.phone.replace(/[^0-9]/g, "");
                  const msg = encodeURIComponent(`Thank you for shopping at ${shop.name}! Your invoice ${saleResult.invoiceNo} total is ${formatCurrency(total)}.`);
                  if (phone) window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
                  else showToast("Select a customer with a phone number to send WhatsApp", "info");
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
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
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
              <button onClick={() => setShowManualItem((v) => !v)}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  showManualItem ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/15"
                }`}>
                <PenLine className="w-3.5 h-3.5" /> Item not in list
              </button>
            </div>

            {showManualItem && (
              <div className="mb-4 p-3 rounded-xl border border-primary/30 bg-primary/5 animate-fade-in">
                <p className="text-xs font-semibold mb-0.5">Enter an item that isn&apos;t in the inventory</p>
                <p className="text-[10px] text-muted-foreground mb-2">It&apos;s billed by name and price only — no stock is deducted.</p>
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-2">
                  <input type="text" value={manualItem.name} autoFocus
                    onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") addManualItem(); }}
                    placeholder="Item name *" className="col-span-2 sm:col-span-4 px-3 py-2 glass-input text-xs" />
                  <input type="text" value={manualItem.description}
                    onChange={(e) => setManualItem({ ...manualItem, description: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") addManualItem(); }}
                    placeholder="Details, e.g. lens colour" className="col-span-2 sm:col-span-4 px-3 py-2 glass-input text-xs" />
                  <input type="number" min={0} value={manualItem.price}
                    onChange={(e) => setManualItem({ ...manualItem, price: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") addManualItem(); }}
                    placeholder="Price *" className="sm:col-span-2 px-3 py-2 glass-input text-xs" />
                  <input type="number" min={1} value={manualItem.quantity}
                    onChange={(e) => setManualItem({ ...manualItem, quantity: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") addManualItem(); }}
                    placeholder="Qty" title="Quantity" className="sm:col-span-2 px-3 py-2 glass-input text-xs" />
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={addManualItem}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover transition-colors cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> Add to cart
                  </button>
                  <button onClick={() => { setShowManualItem(false); setManualItem({ ...EMPTY_MANUAL_ITEM }); }}
                    className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {search && filteredProducts.length === 0 && !showManualItem && (
              <div className="mb-3 p-3 rounded-xl bg-surface text-xs flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Nothing in the inventory matches &ldquo;{search}&rdquo;.</span>
                <button onClick={() => { setManualItem({ ...EMPTY_MANUAL_ITEM, name: search }); setShowManualItem(true); }}
                  className="text-primary font-semibold whitespace-nowrap cursor-pointer">
                  Enter it manually →
                </button>
              </div>
            )}

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
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search customer by name, phone or serial..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 glass-input text-xs"
                />
              </div>
              <button onClick={openNewCustomer} title="Add a new customer"
                className={`flex items-center gap-1 px-2.5 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                  showNewCustomer ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/15"
                }`}>
                <UserPlus className="w-3.5 h-3.5" /> New
              </button>
            </div>
            {customerSearch && !showNewCustomer && (
              <div className="mt-1 glass rounded-lg p-1 max-h-32 overflow-y-auto">
                {filteredCustomers.length === 0 && (
                  <button onClick={openNewCustomer}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs text-primary font-medium flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" /> Not found — add &ldquo;{customerSearch}&rdquo; as a new customer
                  </button>
                )}
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomer(c.id); setCustomerSearch(""); }}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs"
                  >
                    {c.name}{c.phone ? ` · ${c.phone}` : ""}
                  </button>
                ))}
              </div>
            )}
            {showNewCustomer && (
              <div className="mt-2 p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5 text-primary" /> New customer</p>
                  <button onClick={() => setShowNewCustomer(false)} className="cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </div>
                <input type="text" value={newCustomer.name} autoFocus
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") saveNewCustomer(); }}
                  placeholder="Name *" className="w-full px-3 py-2 glass-input text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") saveNewCustomer(); }}
                    placeholder="Phone (optional)" className="w-full px-3 py-2 glass-input text-xs" />
                  <input type="text" value={newCustomer.serialNumber}
                    onChange={(e) => setNewCustomer({ ...newCustomer, serialNumber: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") saveNewCustomer(); }}
                    placeholder="Serial no. (optional)" className="w-full px-3 py-2 glass-input text-xs" />
                </div>
                <button onClick={saveNewCustomer} disabled={savingCustomer}
                  className="w-full py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer">
                  {savingCustomer && <LensLoader light />} Save &amp; select customer
                </button>
              </div>
            )}
            {customer && !showNewCustomer && (
              <div className="flex items-center justify-between mt-2 px-2 py-1.5 bg-primary/5 rounded-lg">
                <span className="text-xs font-medium">{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</span>
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
            <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.key} className={`py-2 px-1.5 -mx-1.5 border-b border-border ${poppedId === item.key ? "animate-cart-pop" : ""}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.productId ? item.brand : "Not in inventory"} · {formatCurrency(item.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(item.key, -1)} className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center hover:bg-surface-hover">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.key, 1)} className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center hover:bg-surface-hover">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="w-14 text-right">
                      <input
                        type="number"
                        value={item.discount || ""}
                        onChange={(e) => updateItemDiscount(item.key, Number(e.target.value))}
                        placeholder="Disc"
                        className="w-full text-right text-[10px] px-1 py-0.5 glass-input"
                      />
                    </div>
                    <p className="w-16 text-right text-xs font-semibold">{formatCurrency(item.price * item.quantity - item.discount)}</p>
                    <button onClick={() => setCart((prev) => prev.filter((i) => i.key !== item.key))}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                  {/* Details such as lens colour print under the item on the bill. */}
                  {editingDetailsKey === item.key ? (
                    <input type="text" autoFocus value={item.description}
                      onChange={(e) => updateItemDescription(item.key, e.target.value)}
                      onBlur={() => setEditingDetailsKey(null)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingDetailsKey(null); }}
                      placeholder="Details for the bill, e.g. lens colour"
                      className="mt-1.5 w-full px-2 py-1 glass-input text-[10px]" />
                  ) : item.description ? (
                    <button onClick={() => setEditingDetailsKey(item.key)} title="Edit details"
                      className="mt-1 w-full text-left text-[10px] text-muted-foreground hover:text-foreground flex items-start gap-1 cursor-pointer">
                      <PenLine className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">{item.description}</span>
                    </button>
                  ) : (
                    <button onClick={() => setEditingDetailsKey(item.key)}
                      className="mt-1 text-[10px] text-primary/80 hover:text-primary font-medium cursor-pointer">
                      + Add details
                    </button>
                  )}
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
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">Invoice Discount</span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={discountPct ?? ""}
                      onChange={(e) => applyDiscountPct(e.target.value === "" ? null : Number(e.target.value))}
                      className="px-2 py-1 glass-input text-xs cursor-pointer"
                      title="Pick a percentage and the amount is worked out for you"
                    >
                      <option value="">%</option>
                      {DISCOUNT_PERCENTAGES.map((p) => (
                        <option key={p} value={p}>{p}%</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={invoiceDiscount || ""}
                      onChange={(e) => {
                        // Typing an amount by hand overrides the percentage.
                        setDiscountPct(null);
                        setInvoiceDiscount(Number(e.target.value));
                      }}
                      className="w-20 text-right px-2 py-1 glass-input text-xs"
                      placeholder="0"
                    />
                  </div>
                </div>
                {discountPct !== null && invoiceDiscount > 0 && (
                  <p className="text-[10px] text-muted-foreground text-right -mt-1">
                    {discountPct}% off {formatCurrency(subtotal)} = −{formatCurrency(invoiceDiscount)}
                  </p>
                )}
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
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
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Payment Status</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["Full", "Advance", "Balance"] as const).map((pt) => (
                      <button
                        key={pt}
                        onClick={() => setPaymentType(pt)}
                        className={`py-2 rounded-xl text-xs font-medium transition-all ${
                          paymentType === pt ? "bg-primary text-white" : "bg-surface hover:bg-surface-hover"
                        }`}
                      >
                        {PAYMENT_TYPE_LABEL[pt]}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">{PAYMENT_TYPE_HINT[paymentType]}</p>
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
                    {advanceAmount > 0 && total - advanceAmount > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1 text-right">
                        Balance due on collection: <span className="font-semibold text-foreground">{formatCurrency(total - advanceAmount)}</span>
                      </p>
                    )}
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
