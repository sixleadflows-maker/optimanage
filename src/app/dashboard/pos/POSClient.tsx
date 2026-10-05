"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { Product } from "@/lib/mock/types";
import { formatCurrency, toLocalInput } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { DISCOUNT_PERCENTAGES, FRAME_CATEGORIES, LENS_COLORS, PAYMENT_TYPE_LABEL } from "@/lib/constants";
import { createSale, updateTillSale, type CreateSaleInput } from "@/lib/actions/sales";
import { createCustomer } from "@/lib/actions/customers";
import { createPrescription, updatePrescription, getCustomerReadings, type SavedReading } from "@/lib/actions/prescriptions";
import { getDrafts, addDraft, replaceDraft, removeDraft, markDraftFailed, makeOfflineRef, type OfflineDraft } from "@/lib/offlineDrafts";
import { useRouter, unstable_isUnrecognizedActionError } from "next/navigation";
import { reportOutdatedPage } from "@/components/layout/UpdateNotice";
import { CREDIT_METHOD } from "@/lib/constants";
import Link from "next/link";
import {
  Search, Plus, Minus, Trash2, X, User, CreditCard,
  Banknote, Building2, Smartphone, Printer, MessageCircle, Receipt,
  Glasses, ChevronDown, ChevronUp, Lock, Edit3,
  WifiOff, UploadCloud, ScanLine, UserPlus, PenLine, CalendarClock, Save, Check, Split, AlertTriangle, History,
} from "lucide-react";
import { SPLIT_METHOD, paymentFromParts } from "@/lib/sales/paymentSplit";
import { SplitPaymentFields, splitAmountsTotal, type SplitAmounts } from "@/components/invoice/SplitPaymentFields";
import { firstImage } from "@/lib/utils/images";
import { LensLoader } from "@/components/ui/LensLoader";
import { RxPowerInput } from "@/components/ui/RxPowerInput";
import { isPowerField, parseRxText, rxFieldText, rxFormTexts, formatRxPower, type RxTextColumns } from "@/lib/utils/rx";
import { ThermalReceipt, A4Invoice, lensNote, type InvoiceData, type ShopDetails } from "@/components/invoice/InvoiceDocuments";
import { matchesSearch } from "@/lib/utils/search";
import { LensPicker, type PickedLens } from "./LensPicker";
import { shareNumber, allNumbers } from "@/lib/utils/phone";

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
  // A frame (from the stock, or typed in): lenses are offered for it.
  isFrame?: boolean;
  // Set on a lens bought for a frame: that frame's key. It sits under the frame
  // and goes when the frame does.
  forKey?: string;
}

export interface POSRx extends RxTextColumns {
  id: string;
  date: string;
  label: string;
  rightSph: number; rightCyl: number; rightAxis: number; rightPd: number; rightAdd: number;
  leftSph: number; leftCyl: number; leftAxis: number; leftPd: number; leftAdd: number;
  notes: string;
  isOwn: boolean;
}

interface POSCustomer {
  id: string;
  name: string;
  phone: string;
  // A second number, if they gave one.
  phone2?: string;
  serialNumber: string;
  // Their most recent prescription, to start the Rx form from.
  latestRx?: POSRx | null;
  // Added at this till while offline: not on the server yet, created when the bill syncs.
  local?: boolean;
  // Advance they've paid in that the shop is holding, usable on this bill.
  credit?: number;
}

interface StaffMember {
  id: string;
  name: string;
}

interface SaleResult {
  // The saved invoice, so a prescription can be added to it later.
  saleId?: string;
  invoiceNo: string;
  // Made offline: invoiceNo is the temporary OFF- number.
  provisional?: boolean;
  orderTakenByName: string;
  billGeneratedByName: string;
  date: string;
  paid: number;
  balance: number;
  // How much of it came out of the customer's advance.
  creditUsed?: number;
}

/** One prescription on the slip. An order can carry several. */
interface RxEntry {
  key: string;
  label: string;
  isOwn: boolean;
  rightSph: string; rightCyl: string; rightAxis: string; rightPd: string; rightAdd: string;
  leftSph: string; leftCyl: string; leftAxis: string; leftPd: string; leftAdd: string;
  notes: string;
  // The record it was filled in from (attached as it is if left unchanged), and
  // the one it was saved to from here -- which stays the one record for this
  // prescription however often it's changed and saved again.
  fromRecordId?: string;
  savedId?: string;
  // Changed since it was last saved to the record.
  savedChanged?: boolean;
  // The record holding it on the invoice once the bill is saved, so saving a
  // corrected bill changes that record instead of adding another.
  onBillId?: string;
  // The lens made up for this prescription. The first prescription's lens is
  // the one picked in the "Lens" box above; every further one carries its own
  // here -- from the catalog (lensProductId) or typed in (lensCustom).
  lensProductId?: string;
  lensCustom?: boolean;
  lensName: string;
  lensPrice: string;
  lensQty: number;
  lensColorChoice: string;
  lensColorOther: string;
  lensDescription: string;
  lensSearch: string;
}

const blankRx = (): RxEntry => ({
  key: crypto.randomUUID(),
  label: "",
  isOwn: false,
  ...EMPTY_RX,
});

const EMPTY_RX = {
  rightSph: "", rightCyl: "", rightAxis: "", rightPd: "", rightAdd: "",
  leftSph: "", leftCyl: "", leftAxis: "", leftPd: "", leftAdd: "",
  notes: "",
  lensName: "", lensPrice: "", lensQty: 1, lensColorChoice: "", lensColorOther: "", lensDescription: "", lensSearch: "",
};

const EMPTY_MANUAL_ITEM = { name: "", description: "", price: "", quantity: "1", frame: true };
const EMPTY_NEW_CUSTOMER = { name: "", phone: "", phone2: "", serialNumber: "" };

// A bill dated this far back is an old invoice being entered from the records.
const OLD_BILL_AFTER_MS = 10 * 60_000;

const PAYMENT_TYPE_HINT = {
  Full: "Customer pays the whole amount now.",
  Advance: "Customer pays part now — the rest is due on collection.",
  Balance: "Customer pays some now (or nothing) — whatever's left stays on as their balance.",
} as const;

/** Quantity for a lens: a pair is 2. */
function LensQty({ value, onChange, max }: { value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div className="flex items-center gap-1" title="Number of lenses — a pair is 2">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1}
        className="w-6 h-6 rounded-md bg-surface hover:bg-surface-hover flex items-center justify-center disabled:opacity-40 cursor-pointer">
        <Minus className="w-3 h-3" />
      </button>
      <span className="text-xs font-semibold w-5 text-center">{value}</span>
      <button type="button" onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        disabled={max !== undefined && value >= max}
        className="w-6 h-6 rounded-md bg-surface hover:bg-surface-hover flex items-center justify-center disabled:opacity-40 cursor-pointer">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

/**
 * The lens for one prescription on a slip that carries several: picked from the
 * lens stock or typed in, with how many, its colour and any notes. It's billed
 * as its own line and saved on that prescription's record.
 */
function RxLensPicker({
  entry, lenses, onChange,
}: {
  entry: RxEntry;
  lenses: Product[];
  onChange: (patch: Partial<RxEntry>) => void;
}) {
  const picked = entry.lensProductId ? lenses.find((p) => p.id === entry.lensProductId) : undefined;
  const matches = entry.lensSearch.trim()
    ? lenses.filter((p) => matchesSearch(entry.lensSearch, [p.brand, p.name, p.model, p.colour, p.type])).slice(0, 6)
    : [];
  const price = Number(entry.lensPrice) || 0;

  return (
    <div className="p-2 rounded-lg bg-primary/5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-medium text-muted-foreground">Lens for this prescription (adds to the bill)</label>
        {!picked && (
          <button type="button" onClick={() => onChange({ lensCustom: !entry.lensCustom, lensSearch: "" })}
            className="text-[10px] text-primary font-medium flex items-center gap-1 cursor-pointer flex-shrink-0">
            {entry.lensCustom ? <><Search className="w-3 h-3" /> Search catalog</> : <><Edit3 className="w-3 h-3" /> Enter manually</>}
          </button>
        )}
      </div>

      {entry.lensCustom ? (
        <div className="space-y-1">
          <input type="text" value={entry.lensName} onChange={(e) => onChange({ lensName: e.target.value })}
            placeholder="Lens name" className="w-full px-2.5 py-1.5 glass-input text-[11px]" />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input type="number" min={0} value={entry.lensPrice} onChange={(e) => onChange({ lensPrice: e.target.value })}
              placeholder="Price per lens" className="w-full px-2.5 py-1.5 glass-input text-[11px]" />
            <LensQty value={entry.lensQty} onChange={(q) => onChange({ lensQty: q })} />
          </div>
          {price > 0 && entry.lensQty > 1 && (
            <p className="text-[10px] text-muted-foreground text-right">
              {`${entry.lensQty} × ${formatCurrency(price)} = ${formatCurrency(price * entry.lensQty)}`}
            </p>
          )}
        </div>
      ) : picked ? (
        <div className="px-2.5 py-1.5 bg-surface rounded-lg space-y-1">
          {/* The name gets a line to itself: beside the quantity buttons there's no room for it in the cart column. */}
          <p className="text-[11px] font-medium">{`${picked.brand} ${picked.name}`.trim()}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">{`${formatCurrency(picked.salePrice)} each`}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <LensQty value={entry.lensQty} max={picked.stock} onChange={(q) => onChange({ lensQty: q })} />
              <button type="button" onClick={() => onChange({ lensProductId: undefined, lensQty: 1 })} title="Take this lens off" className="cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <input type="text" placeholder="Type to search lenses..." value={entry.lensSearch}
            onChange={(e) => onChange({ lensSearch: e.target.value })} className="w-full px-2.5 py-1.5 glass-input text-[11px]" />
          {entry.lensSearch.trim() && (
            <div className="mt-1 glass rounded-lg p-1 max-h-32 overflow-y-auto">
              {matches.length === 0 && <p className="px-3 py-1.5 text-xs text-muted-foreground">No matching lens — use Enter manually</p>}
              {matches.map((p) => (
                <button key={p.id} type="button" onClick={() => onChange({ lensProductId: p.id, lensSearch: "" })}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs flex items-center justify-between gap-2 cursor-pointer">
                  <span className="min-w-0">
                    <span className="block truncate">{p.brand} {p.name}</span>
                    {p.category === "Contact Lenses" && p.type && <span className="block text-[10px] text-muted-foreground">{p.type}</span>}
                  </span>
                  <span className="text-muted-foreground flex-shrink-0">{formatCurrency(p.salePrice)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <select value={entry.lensColorChoice} onChange={(e) => onChange({ lensColorChoice: e.target.value })}
          className="w-full px-2 py-1.5 glass-input text-[11px]">
          <option value="">Lens colour</option>
          {LENS_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="Other">Other — type it</option>
        </select>
        <input type="text" value={entry.lensDescription} onChange={(e) => onChange({ lensDescription: e.target.value })}
          placeholder="Coating, index, brand..." className="w-full px-2.5 py-1.5 glass-input text-[11px]" />
      </div>
      {entry.lensColorChoice === "Other" && (
        <input type="text" value={entry.lensColorOther} onChange={(e) => onChange({ lensColorOther: e.target.value })}
          placeholder="Type the colour" className="w-full px-2.5 py-1.5 glass-input text-[11px]" />
      )}
    </div>
  );
}

export function POSClient({
  products, customers, staff, currentUserId, defaultOrderTakenBy, defaultBillGeneratedBy, shop, canBackdate, canEditBill,
  initialCustomerId,
}: {
  products: Product[];
  customers: POSCustomer[];
  // Opened from a customer's record ("New Invoice"): the bill starts with them.
  initialCustomerId?: string;
  staff: StaffMember[];
  currentUserId: string;
  // Who was picked on the last bill -- the till starts with them.
  defaultOrderTakenBy: string;
  defaultBillGeneratedBy: string;
  shop: ShopDetails;
  // Owners and managers can enter an old invoice with its original date.
  canBackdate: boolean;
  // ...and correct a bill after it's been rung up.
  canEditBill: boolean;
}) {
  const { showToast } = useApp();
  const router = useRouter();
  const num = parseRxText;
  const [entryMode, setEntryMode] = useState<"choose" | "manual" | "scan">("choose");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>(
    () => (initialCustomerId && customers.some((c) => c.id === initialCustomerId) ? initialCustomerId : "")
  );
  // Staff pick up where the last bill left off rather than going back to the
  // signed-in account after every sale.
  const [lastStaff, setLastStaff] = useState({
    orderTakenBy: defaultOrderTakenBy || currentUserId,
    billGeneratedBy: defaultBillGeneratedBy || currentUserId,
  });
  const [orderTakenBy, setOrderTakenBy] = useState(lastStaff.orderTakenBy);
  const [billGeneratedBy, setBillGeneratedBy] = useState(lastStaff.billGeneratedBy);
  // Correcting the bill just rung up: saving goes over that same invoice.
  const [editingBill, setEditingBill] = useState(false);
  // One of PAYMENT_METHODS, or SPLIT_METHOD when the customer pays part by
  // one method and part by another (the amounts are in splitAmounts).
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [splitAmounts, setSplitAmounts] = useState<SplitAmounts>({});
  const [paymentType, setPaymentType] = useState<"Full" | "Advance" | "Balance">("Full");
  // The customer whose advance is being used on this bill (ticked per bill).
  const [useCreditFor, setUseCreditFor] = useState("");
  // Advance used on bills rung up since this screen loaded, per customer, so
  // what's shown as held stays right without reloading the page.
  const [creditSpent, setCreditSpent] = useState<Record<string, number>>({});
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
  const [customLensQty, setCustomLensQty] = useState(1);
  // An old invoice: the date it really happened ("" = now), and whether it
  // should take items out of stock (off -- see createSale).
  const [billDate, setBillDate] = useState("");
  const [deductOldStock, setDeductOldStock] = useState(false);
  // Every attempt at this sale carries the same key, so however many times it's
  // retried -- or synced after being made offline -- it's recorded once.
  const clientRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  // Lens colour: pick from the usual ones, or "Other" and type it.
  const [lensColorChoice, setLensColorChoice] = useState("");
  const [lensColorOther, setLensColorOther] = useState("");
  const [lensDescription, setLensDescription] = useState("");
  const [labCharges, setLabCharges] = useState(0);
  const [fittingCharges, setFittingCharges] = useState(0);

  const [recordRx, setRecordRx] = useState(false);
  // One order can carry several prescriptions under the same customer — a
  // family sharing a serial number, or distance and reading on one slip.
  const [rxList, setRxList] = useState<RxEntry[]>([]);
  // Whether staff have typed into the Rx form (so switching customer doesn't wipe it).
  const [rxTouched, setRxTouched] = useState(false);
  const [rxPrefilledFrom, setRxPrefilledFrom] = useState<string | null>(null);
  const [savingRx, setSavingRx] = useState<string | null>(null);
  // "Use an earlier reading": the customer's saved readings, fetched when the
  // list is opened (they aren't sent with every customer on the till).
  const [readingsOpen, setReadingsOpen] = useState(false);
  const [readings, setReadings] = useState<{ customerId: string; list: SavedReading[] } | null>(null);
  const [loadingReadings, setLoadingReadings] = useState(false);
  const [poppedId, setPoppedId] = useState<string | null>(null);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The frame (its cart key) a lens is being chosen for, and whether adding a
  // frame brings that up by itself. The choice is remembered on this computer.
  const [lensFor, setLensFor] = useState<string | null>(null);
  const [offerLens, setOfferLens] = useState(() => {
    try { return localStorage.getItem("optimanage:offerLens") !== "0"; } catch { return true; }
  });
  const changeOfferLens = (offer: boolean) => {
    setOfferLens(offer);
    try { localStorage.setItem("optimanage:offerLens", offer ? "1" : "0"); } catch { /* not remembered */ }
  };

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

  // Bills made offline go through by themselves: when the page opens, when the
  // browser says the connection is back, and every 30 seconds while any wait.
  // A bill the server refuses (not a connection problem) is set aside with its
  // reason rather than retried forever; "Sync now" tries those again.
  const syncDrafts = async (includeFailed = false) => {
    if (syncingRef.current) return;
    const pending = getDrafts().filter((d) => includeFailed || !d.lastError);
    if (pending.length === 0) return;
    syncingRef.current = true;
    setSyncing(true);
    const synced: string[] = [];
    const oversold = new Set<string>();
    let failed = 0;
    let lastError = "";
    let unreachable = false;
    for (const draft of pending) {
      try {
        const res = await createSale(draft.input);
        if (res.ok) {
          // Corrected at the till while an earlier sync was already under way:
          // the invoice was made from the older version, so apply the correction.
          if (res.duplicate && (draft.revision ?? 0) > 0) {
            const fixed = await updateTillSale(draft.input);
            if (!fixed.ok) {
              markDraftFailed(draft.id, fixed.error);
              failed++;
              lastError = fixed.error;
              continue;
            }
          }
          removeDraft(draft.id, draft.revision ?? 0);
          synced.push(draft.offlineRef ? `${draft.offlineRef} is ${res.invoiceNo}` : res.invoiceNo);
          for (const name of res.oversold ?? []) oversold.add(name);
        } else {
          markDraftFailed(draft.id, res.error);
          failed++;
          lastError = res.error;
        }
      } catch {
        unreachable = true;
        break;
      }
    }
    setDrafts(getDrafts());
    setSyncing(false);
    syncingRef.current = false;
    if (synced.length) {
      showToast(`Offline bill${synced.length === 1 ? "" : "s"} recorded: ${synced.join(", ")}`, "success");
      router.refresh();
    }
    if (oversold.size) {
      showToast(`Recount ${[...oversold].join(", ")} — offline bills took the count below zero`, "info");
    }
    if (failed) showToast(`${failed} offline bill${failed === 1 ? "" : "s"} couldn't be recorded — ${lastError}`, "error");
    if (includeFailed && unreachable) showToast("Still no connection — offline bills will go through by themselves", "info");
  };

  useEffect(() => {
    syncDrafts();
    const onOnline = () => syncDrafts();
    window.addEventListener("online", onOnline);
    const timer = setInterval(() => {
      if (getDrafts().some((d) => !d.lastError)) syncDrafts();
    }, 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "New Invoice" on a customer's record opens the till with ?customer=...;
  // once applied it comes off the address, so a reload starts a blank sale.
  useEffect(() => {
    if (initialCustomerId) window.history.replaceState(null, "", "/dashboard/pos");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!search.trim()) return products.slice(0, 12);
    return products.filter((p) => matchesSearch(search, [p.brand, p.name, p.model, p.description, p.colour, p.size, p.type, p.barcode]));
  }, [products, search]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return allCustomers.slice(0, 5);
    return allCustomers.filter((c) => matchesSearch(customerSearch, [c.name, c.phone, c.phone2, c.serialNumber]));
  }, [allCustomers, customerSearch]);

  const filteredLensProducts = useMemo(() => {
    if (!lensSearch.trim()) return lensProducts.slice(0, 6);
    return lensProducts.filter((p) => matchesSearch(lensSearch, [p.brand, p.name, p.model, p.colour, p.type])).slice(0, 6);
  }, [lensProducts, lensSearch]);

  const lensProduct = products.find((p) => p.id === lensProductId);

  const addToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    pop(productId);
    const isNew = !cart.some((i) => i.key === productId);
    const isFrame = FRAME_CATEGORIES.includes(product.category);
    setCart((prev) => {
      const existing = prev.find((i) => i.key === productId);
      if (existing) {
        return prev.map((i) =>
          i.key === productId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        key: productId, productId, name: product.name, brand: product.brand,
        description: product.description, price: product.salePrice, quantity: 1, discount: 0, isFrame,
      }];
    });
    // A frame just added (scanned or picked): offer the lenses for it.
    if (isNew && isFrame && offerLens) setLensFor(productId);
  };

  // A lens bought for a frame goes in the cart under it, described as that
  // frame's lens, and is billed and taken out of stock like any other item.
  const addLensToFrame = (frameKey: string, lens: PickedLens) => {
    const frame = cart.find((i) => i.key === frameKey);
    if (!frame) { setLensFor(null); return; }
    const frameLabel = [frame.brand, frame.name].filter(Boolean).join(" ");
    manualCounter.current += 1;
    const key = lens.productId ? `lens-${frameKey}-${lens.productId}` : `lens-${frameKey}-typed-${manualCounter.current}`;
    setCart((prev) => {
      if (prev.some((i) => i.key === key)) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + lens.quantity } : i));
      }
      return [...prev, {
        key, productId: lens.productId, name: lens.name, brand: lens.brand,
        description: `Lens for ${frameLabel}`, price: lens.price, quantity: lens.quantity, discount: 0, forKey: frameKey,
      }];
    });
    pop(key);
    setLensFor(null);
    showToast(`${[lens.brand, lens.name].filter(Boolean).join(" ")} added for ${frameLabel}`, "success");
  };

  // A frame leaving the cart takes its lenses with it.
  const withoutOrphanLenses = (items: CartItem[]) => items.filter((i) => !i.forKey || items.some((f) => f.key === i.forKey));

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
      isFrame: manualItem.frame,
    }]);
    pop(key);
    const offerFor = manualItem.frame && offerLens;
    setManualItem({ ...EMPTY_MANUAL_ITEM });
    setShowManualItem(false);
    showToast(`Added ${name}`, "success");
    if (offerFor) setLensFor(key);
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      withoutOrphanLenses(
        prev
          .map((i) =>
            i.key === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
          )
          .filter((i) => i.quantity > 0)
      )
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

  // Who's already on the number being typed. It never blocks adding: several
  // customers can share one number (a family, or a record per order).
  const onNewCustomerNumber = showNewCustomer ? allCustomers.filter((c) => shareNumber(c, newCustomer)) : [];

  const pickCustomerOnNumber = (id: string) => {
    setSelectedCustomer(id);
    setShowNewCustomer(false);
    setNewCustomer({ ...EMPTY_NEW_CUSTOMER });
    setCustomerSearch("");
  };

  const saveNewCustomer = async () => {
    if (savingCustomer) return;
    const name = newCustomer.name.trim();
    // Only one number typed, and it went in the second box: it's their number.
    const typed = [newCustomer.phone.trim(), newCustomer.phone2.trim()].filter(Boolean);
    const phone = typed[0] ?? "";
    const phone2 = typed[1] ?? "";
    // A number on its own is enough -- the name can be added later.
    if (!name && !phone) { showToast("Enter a name or a phone number", "error"); return; }
    const label = name || phone;
    setSavingCustomer(true);
    try {
      const res = await createCustomer({
        name, phone, phone2, serialNumber: newCustomer.serialNumber,
        email: "", address: "", lastVisit: "",
      });
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      const id = res.id;
      setAddedCustomers((prev) => prev.some((c) => c.id === id)
        ? prev
        : [...prev, { id, name, phone, phone2, serialNumber: newCustomer.serialNumber.trim() }]);
      setSelectedCustomer(id);
      showToast(
        onNewCustomerNumber.length
          ? `${label} added and selected — ${onNewCustomerNumber.length + 1} customers now share this number`
          : `${label} added and selected`,
        "success",
      );
      setShowNewCustomer(false);
      setNewCustomer({ ...EMPTY_NEW_CUSTOMER });
      setCustomerSearch("");
    } catch {
      // No connection: keep them on this till and add them to the system when
      // the bill syncs (matched on number and name, so no duplicate if they're
      // on file already).
      const id = `local-${crypto.randomUUID()}`;
      setAddedCustomers((prev) => [...prev, {
        id, name, phone, phone2, serialNumber: newCustomer.serialNumber.trim(), local: true,
      }]);
      setSelectedCustomer(id);
      setShowNewCustomer(false);
      setNewCustomer({ ...EMPTY_NEW_CUSTOMER });
      setCustomerSearch("");
      showToast(`No connection — ${label} will be added when this bill syncs`, "info");
    } finally {
      setSavingCustomer(false);
    }
  };

  const cartSubtotal = cart.reduce((sum, i) => sum + i.price * i.quantity - i.discount, 0);
  // The cart as shown: each frame followed by the lenses bought for it.
  const cartRows = [
    ...cart.filter((i) => !i.forKey).flatMap((i) => [i, ...cart.filter((l) => l.forKey === i.key)]),
    ...cart.filter((l) => l.forKey && !cart.some((f) => f.key === l.forKey)),
  ];
  const lensColor = lensColorChoice === "Other" ? lensColorOther.trim() : lensColorChoice;
  const customLensAmount = useCustomLens ? customLensPrice * customLensQty : 0;
  const rxLensColor = (e: RxEntry) => (e.lensColorChoice === "Other" ? e.lensColorOther.trim() : e.lensColorChoice);
  // The lens of each prescription after the first, as a line on the bill. (The
  // first prescription's lens is the one chosen in the Lens box, already a
  // line of its own.)
  const extraLensLines = recordRx
    ? rxList.slice(1).flatMap((e, i) => {
        const description = [`Lens for ${e.label.trim() || `prescription ${i + 2}`}`, lensNote(rxLensColor(e), e.lensDescription)].filter(Boolean).join(" · ");
        if (e.lensCustom) {
          const price = Number(e.lensPrice) || 0;
          if (!e.lensName.trim() || price <= 0) return [];
          return [{ key: `rx-lens-${e.key}`, productId: undefined as string | undefined, name: e.lensName.trim(), description, quantity: e.lensQty, price }];
        }
        const p = e.lensProductId ? products.find((x) => x.id === e.lensProductId) : undefined;
        if (!p) return [];
        return [{ key: `rx-lens-${e.key}`, productId: p.id as string | undefined, name: `${p.brand} ${p.name}`.trim(), description, quantity: e.lensQty, price: p.salePrice }];
      })
    : [];
  const extraLensAmount = extraLensLines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const subtotal = cartSubtotal + customLensAmount + extraLensAmount;
  const total = subtotal - invoiceDiscount;
  const customer = allCustomers.find((c) => c.id === selectedCustomer);
  // What to call them on screen: a customer saved with only a number goes by it.
  const customerLabel = customer ? customer.name || customer.phone || "this customer" : "";
  const lensLine = lensProductId ? cart.find((i) => i.key === lensProductId) : undefined;
  const billDateValue = billDate ? new Date(billDate) : null;
  const isOldBill = !!billDateValue && Date.now() - billDateValue.getTime() > OLD_BILL_AFTER_MS;

  // Split: what's paid now is the parts added up (all of it for Full Payment,
  // the amount put down otherwise), and the bill reads "Cash + Card".
  const isSplit = paymentMethod === SPLIT_METHOD;
  const splitPaid = splitAmountsTotal(splitAmounts);
  // Advance and Balance both take whatever the customer puts down now; on
  // Balance that can be nothing. The rest is what they still owe.
  const advancePaid = isSplit ? splitPaid : advanceAmount;
  // Advance the customer already paid in: ticked, it comes off the bill first
  // and the payment type below applies to what's left. While a bill is being
  // corrected it stays as it was (it's changed from the invoice's payments).
  const creditAvailable = customer && !customer.local
    ? Math.max(0, Math.round(((customer.credit ?? 0) - (creditSpent[customer.id] ?? 0)) * 100) / 100)
    : 0;
  const creditUsed = editingBill
    ? Math.min(saleResult?.creditUsed ?? 0, Math.max(0, total))
    : customer && useCreditFor === customer.id ? Math.min(creditAvailable, Math.max(0, total)) : 0;
  const due = Math.max(0, total - creditUsed);
  // Fully covered by the advance: there's nothing left to choose a type for.
  const payType = creditUsed > 0 && due <= 0 ? "Full" : paymentType;
  const paidNow = payType === "Full" ? due : advancePaid;
  const balanceLeft = Math.max(0, due - paidNow);
  const billPayment = isSplit
    ? paymentFromParts(Object.entries(splitAmounts).map(([method, amount]) => ({ method, amount })), "Cash")
    : { paymentMethod, paymentSplit: [] };

  const choosePaymentType = (pt: "Full" | "Advance" | "Balance") => setPaymentType(pt);

  // What's stopping Complete Sale, if anything. It's shown above the button as
  // well as in the pop-up, so a bill that "isn't saving" says why and stays said.
  const saleBlocker: string | null = (() => {
    if (payType === "Advance" && advancePaid <= 0) {
      return isSplit ? "Enter how much was paid by each method" : "Enter the advance amount received";
    }
    if (isSplit && payType === "Full" && Math.abs(splitPaid - due) > 0.01) {
      return splitPaid < due
        ? `The split payment is ${formatCurrency(due - splitPaid)} short of the ${formatCurrency(due)} to pay`
        : `The split payment is ${formatCurrency(splitPaid - due)} more than the ${formatCurrency(due)} to pay`;
    }
    if (payType !== "Full" && advancePaid > due + 0.01) {
      return `${formatCurrency(advancePaid)} is more than the ${formatCurrency(due)} to pay — choose Full Payment instead`;
    }
    if (recordRx && !selectedCustomer) {
      return "Pick a customer above to save the prescription, or untick Record prescription (Rx)";
    }
    if (useCustomLens && (!customLensName.trim() || customLensPrice <= 0)) {
      return "Enter a name and price for the custom lens, or take it off";
    }
    // A typed-in lens on a further prescription, half filled in.
    const halfLens = recordRx
      ? rxList.findIndex((e, i) => i > 0 && e.lensCustom && (e.lensName.trim() !== "" || e.lensPrice !== "") && (!e.lensName.trim() || !(Number(e.lensPrice) > 0)))
      : -1;
    if (halfLens > 0) {
      return `Enter a name and price for the lens on prescription ${halfLens + 1} (${rxList[halfLens].label.trim() || "no name yet"})`;
    }
    return null;
  })();

  // Which lens went with which prescription, for the record: the first one's
  // is the lens chosen in the Lens box, the others carry their own.
  const rxLens = (entry: RxEntry) => {
    if (rxList[0]?.key === entry.key) {
      const name = useCustomLens ? customLensName.trim() : lensProduct ? `${lensProduct.brand} ${lensProduct.name}`.trim() : "";
      return { lensName: name, lensColor, lensDescription: lensDescription.trim() };
    }
    const p = entry.lensProductId ? products.find((x) => x.id === entry.lensProductId) : undefined;
    return {
      lensName: entry.lensCustom ? entry.lensName.trim() : p ? `${p.brand} ${p.name}`.trim() : "",
      lensColor: rxLensColor(entry),
      lensDescription: entry.lensDescription.trim(),
    };
  };

  const rxValues = (entry: RxEntry) => ({
    ...rxLens(entry),
    rightSph: num(entry.rightSph), rightCyl: num(entry.rightCyl), rightAxis: num(entry.rightAxis), rightPd: num(entry.rightPd), rightAdd: num(entry.rightAdd),
    leftSph: num(entry.leftSph), leftCyl: num(entry.leftCyl), leftAxis: num(entry.leftAxis), leftPd: num(entry.leftPd), leftAdd: num(entry.leftAdd),
    ...rxFormTexts(entry),
    notes: entry.notes,
    label: entry.label.trim(),
    isOwnPrescription: entry.isOwn,
  });
  const rxKey = (entry: RxEntry) => JSON.stringify(rxValues(entry));

  // The first prescription starts from the customer's last one -- most visits
  // are a small change to it, not a new one -- unless staff already typed.
  const rxFromRecord = (last: POSRx | SavedReading): RxEntry => ({
    ...blankRx(),
    rightSph: rxFieldText("Sph", last.rightSph, last.rightSphText), rightCyl: rxFieldText("Cyl", last.rightCyl, last.rightCylText),
    rightAxis: rxFieldText("Axis", last.rightAxis), rightPd: rxFieldText("Pd", last.rightPd),
    rightAdd: rxFieldText("Add", last.rightAdd, last.rightAddText),
    leftSph: rxFieldText("Sph", last.leftSph, last.leftSphText), leftCyl: rxFieldText("Cyl", last.leftCyl, last.leftCylText),
    leftAxis: rxFieldText("Axis", last.leftAxis), leftPd: rxFieldText("Pd", last.leftPd),
    leftAdd: rxFieldText("Add", last.leftAdd, last.leftAddText),
    label: last.label,
    notes: last.notes,
    isOwn: last.isOwn,
    fromRecordId: last.id,
  });
  const rxFromCustomer = (c?: POSCustomer): RxEntry => (c?.latestRx ? rxFromRecord(c.latestRx) : blankRx());

  // One line for a saved reading in the list: "R -1.50 / -0.50 × 90 · L -1.25".
  const readingSummary = (r: SavedReading) => {
    const eye = (sph: number, sphText: string, cyl: number, cylText: string, axis: number) =>
      [formatRxPower(sph, sphText), cyl || cylText ? `/ ${formatRxPower(cyl, cylText)}` : "", axis ? `× ${axis}` : ""].filter(Boolean).join(" ");
    return `R ${eye(r.rightSph, r.rightSphText, r.rightCyl, r.rightCylText, r.rightAxis)}  ·  L ${eye(r.leftSph, r.leftSphText, r.leftCyl, r.leftCylText, r.leftAxis)}`;
  };

  const showReadings = async () => {
    if (!customer || customer.local) return;
    setReadingsOpen(true);
    if (readings?.customerId === customer.id) return;
    setLoadingReadings(true);
    try {
      const list = await getCustomerReadings(customer.id);
      setReadings({ customerId: customer.id, list });
    } catch (e) {
      if (unstable_isUnrecognizedActionError(e)) reportOutdatedPage();
      showToast("Couldn't load their readings — check the connection and try again", "error");
      setReadingsOpen(false);
    } finally {
      setLoadingReadings(false);
    }
  };

  // One click from the bill: opens the prescription box with the list showing.
  const startReadingPick = () => {
    setShowJob(true);
    setRecordRx(true);
    void showReadings();
  };

  // Loads the picked reading into the bill. If nothing has been typed yet it
  // takes the place of the starting one (and is attached as it is); otherwise it
  // comes in as another prescription on the slip.
  const pickReading = (r: SavedReading) => {
    const entry = rxFromRecord(r);
    if (rxList.length === 0 || (rxList.length === 1 && !rxTouched)) {
      setRxList([entry]);
      setRxPrefilledFrom(r.date);
      setRxTouched(false);
    } else {
      setRxList((prev) => [...prev, entry]);
      setRxTouched(true);
    }
    setReadingsOpen(false);
    showToast(`${customerLabel}'s reading from ${new Date(r.date).toLocaleDateString("en-GB")} is on this bill`, "success");
  };

  useEffect(() => {
    if (!recordRx) return;
    if (rxTouched && rxList.length) return;
    setRxList([rxFromCustomer(customer)]);
    setRxPrefilledFrom(customer?.latestRx?.date ?? null);
    setRxTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer, recordRx]);

  const editRx = (key: string, patch: Partial<RxEntry>) => {
    setRxList((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch, savedChanged: !!e.savedId } : e)));
    setRxTouched(true);
  };

  const addRx = () => {
    setRxList((prev) => [...prev, blankRx()]);
    setRxTouched(true);
  };

  const removeRx = (key: string) => {
    setRxList((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.key !== key)));
    setRxTouched(true);
  };

  const saveRxNow = async (entry: RxEntry) => {
    if (!customer) { showToast("Select the customer first", "error"); return; }
    if (customer.local) { showToast(`${customerLabel} isn't on the system yet — the prescription is saved with the bill`, "info"); return; }
    setSavingRx(entry.key);
    try {
      // Saved once already: that record is updated, not joined by a second one.
      if (entry.savedId) {
        const res = await updatePrescription(entry.savedId, rxValues(entry));
        if (!res.ok) { showToast(res.error, "error"); return; }
        setRxList((prev) => prev.map((e) => (e.key === entry.key ? { ...e, savedChanged: false } : e)));
        showToast(`${customerLabel}'s prescription record updated`, "success");
        return;
      }
      const res = await createPrescription({ customerId: customer.id, ...rxValues(entry) });
      if (!res.ok) { showToast(res.error, "error"); return; }
      setRxList((prev) => prev.map((e) => (e.key === entry.key ? { ...e, savedId: res.id, savedChanged: false } : e)));
      showToast(`Saved to ${customerLabel}'s prescription record`, "success");
    } catch {
      showToast("Couldn't save it right now — it will be saved with the sale", "error");
    } finally {
      setSavingRx(null);
    }
  };

  // Cost and profit are deliberately not computed or shown here — the till is
  // visible to customers. createSale still records them server-side, so they
  // stay available in Analytics.
  const hasSaleableItems = cart.length > 0 || (useCustomLens && customLensPrice > 0) || extraLensLines.length > 0;

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
    setUseCreditFor("");
    setPaymentType("Full");
    setPaymentMethod("Cash");
    setSplitAmounts({});
    setSaleResult(null);
    setShowJob(false);
    setLensFor(null);
    setLensProductId("");
    setLensSearch("");
    setUseCustomLens(false);
    setCustomLensName("");
    setCustomLensPrice(0);
    setCustomLensQty(1);
    setBillDate("");
    setDeductOldStock(false);
    clientRef.current = null;
    setRxTouched(false);
    setRxPrefilledFrom(null);
    setLensColorChoice("");
    setLensColorOther("");
    setLensDescription("");
    setLabCharges(0);
    setFittingCharges(0);
    setRecordRx(false);
    setRxList([]);
    setReadingsOpen(false);
    setOrderTakenBy(lastStaff.orderTakenBy);
    setBillGeneratedBy(lastStaff.billGeneratedBy);
    setEditingBill(false);
    setShowManualItem(false);
    setManualItem({ ...EMPTY_MANUAL_ITEM });
    setEditingDetailsKey(null);
    setShowNewCustomer(false);
    setNewCustomer({ ...EMPTY_NEW_CUSTOMER });
    router.refresh();
  };

  /**
   * "Edit bill": the bill just rung up, saved again over the same invoice --
   * however many times it's corrected, it stays one invoice with one number.
   * A bill made offline that hasn't synced yet is corrected in the queue.
   */
  const saveBillChanges = async (
    saleInput: CreateSaleInput,
    shown: {
      staffNames: { orderTakenByName: string; billGeneratedByName: string };
      pickedStaff: { orderTakenBy: string; billGeneratedBy: string };
      date: string;
    },
  ) => {
    if (!saleResult) return;
    const finish = (result: SaleResult, message: string) => {
      setSaleResult(result);
      setLastStaff(shown.pickedStaff);
      setEditingBill(false);
      setShowReceipt(true);
      showToast(message, "success");
    };

    const summary = { customerName: customer ? customerLabel : "Walk-in", itemCount: cart.length, total };
    if (saleResult.provisional && clientRef.current && replaceDraft(clientRef.current, saleInput, summary)) {
      setDrafts(getDrafts());
      finish(
        { ...saleResult, ...shown.staffNames, date: shown.date, paid: paidNow + creditUsed, balance: balanceLeft },
        `${saleResult.invoiceNo} updated — it'll be recorded once the connection is back`,
      );
      return;
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      showToast("No connection — the changes weren't saved. Try again once the connection is back.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await updateTillSale(saleInput);
      if (!res.ok) {
        showToast(res.error, "error");
        return;
      }
      const rxIds = res.prescriptionIds ?? [];
      if (recordRx) setRxList((prev) => prev.map((e, i) => ({ ...e, onBillId: rxIds[i] })));
      finish(
        {
          saleId: saleResult.saleId,
          invoiceNo: res.invoiceNo,
          orderTakenByName: res.orderTakenByName,
          billGeneratedByName: res.billGeneratedByName,
          date: shown.date,
          paid: res.paid,
          balance: res.balance,
          creditUsed: saleResult.creditUsed,
        },
        `${res.invoiceNo} updated — still one invoice`,
      );
    } catch {
      showToast("Couldn't reach the server — the changes weren't saved. Try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const completeSale = async () => {
    if (!hasSaleableItems) return;
    if (saleBlocker) {
      showToast(saleBlocker, "error");
      return;
    }
    if (!Number.isFinite(total) || !Number.isFinite(paidNow)) {
      showToast("One of the amounts isn't a number — check the prices, discount and amount paid", "error");
      return;
    }
    if (billDateValue && (Number.isNaN(billDateValue.getTime()) || billDateValue.getTime() > Date.now() + 60_000)) {
      showToast("Check the bill date — it can't be in the future", "error");
      return;
    }
    clientRef.current ??= crypto.randomUUID();
    const saleInput: CreateSaleInput = {
      items: [
        ...cart.map((i) => (i.productId
          ? { productId: i.productId, description: i.description, quantity: i.quantity, unitPrice: i.price, discount: i.discount }
          : { name: i.name, description: i.description, quantity: i.quantity, unitPrice: i.price, discount: i.discount })),
        // One line for the lens of each prescription after the first.
        ...extraLensLines.map((l) => (l.productId
          ? { productId: l.productId, description: l.description, quantity: l.quantity, unitPrice: l.price, discount: 0 }
          : { name: l.name, description: l.description, quantity: l.quantity, unitPrice: l.price, discount: 0 })),
      ],
      customerId: customer && !customer.local ? customer.id : undefined,
      newCustomer: customer?.local ? { name: customer.name, phone: customer.phone, phone2: customer.phone2 } : undefined,
      paymentMethod: billPayment.paymentMethod,
      paymentSplit: billPayment.paymentSplit.length ? billPayment.paymentSplit : undefined,
      paymentType: payType,
      advanceAmount: payType === "Advance" ? advancePaid : 0,
      balancePaid: payType === "Balance" ? advancePaid : undefined,
      creditUsed: creditUsed > 0 ? creditUsed : undefined,
      invoiceDiscount,
      lensProductId: lensProductId || undefined,
      customLensName: useCustomLens ? customLensName.trim() : undefined,
      customLensPrice: useCustomLens ? customLensPrice : undefined,
      customLensQty: useCustomLens ? customLensQty : undefined,
      lensColor: lensColor || undefined,
      lensDescription: lensDescription.trim() || undefined,
      labCharges,
      fittingCharges,
      createdById: orderTakenBy || currentUserId,
      receivedById: billGeneratedBy || currentUserId,
      // Each carries the record it already is (saved from here, or on the bill
      // being corrected), so the sale finishes that record instead of copying it.
      prescriptions: recordRx
        ? rxList.map((e) => ({ ...rxValues(e), id: (editingBill ? e.onBillId : undefined) ?? e.savedId }))
        : undefined,
      // The customer's last prescription, left exactly as it was: attached, not copied.
      existingPrescriptionId: recordRx && rxList[0] && !rxTouched && rxPrefilledFrom ? rxList[0].fromRecordId : undefined,
      date: billDateValue ? billDateValue.toISOString() : undefined,
      deductStock: isOldBill ? deductOldStock : undefined,
      clientRef: clientRef.current,
    };
    const billTime = billDateValue ?? new Date();
    const staffName = (id: string) => staff.find((m) => m.id === id)?.name ?? "";
    const pickedStaff = { orderTakenBy: orderTakenBy || currentUserId, billGeneratedBy: billGeneratedBy || currentUserId };
    const formatBillTime = (d: Date) =>
      d.toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

    if (editingBill && saleResult) {
      await saveBillChanges(saleInput, {
        staffNames: { orderTakenByName: staffName(pickedStaff.orderTakenBy), billGeneratedByName: staffName(pickedStaff.billGeneratedBy) },
        pickedStaff,
        date: billDateValue ? formatBillTime(billDateValue) : saleResult.date,
      });
      return;
    }

    // No connection: print the bill now with a temporary number and record it
    // when the connection is back (see syncDrafts).
    const printOffline = () => {
      if (isOldBill) {
        showToast("Old invoices need a connection — enter it once you're back online", "error");
        return;
      }
      const offlineRef = makeOfflineRef(billTime);
      const draft = addDraft(
        { ...saleInput, offlineRef, date: billTime.toISOString() },
        { customerName: customer ? customerLabel : "Walk-in", itemCount: cart.length, total }
      );
      setDrafts(getDrafts().length ? getDrafts() : [draft]);
      setLastStaff(pickedStaff);
      setSaleResult({
        invoiceNo: offlineRef,
        provisional: true,
        orderTakenByName: staffName(orderTakenBy || currentUserId),
        billGeneratedByName: staffName(billGeneratedBy || currentUserId),
        date: formatBillTime(billTime),
        paid: paidNow + creditUsed,
        balance: balanceLeft,
        creditUsed,
      });
      if (customer && creditUsed > 0) setCreditSpent((prev) => ({ ...prev, [customer.id]: (prev[customer.id] ?? 0) + creditUsed }));
      setShowReceipt(true);
      showToast(`No connection — bill ${offlineRef} saved on this computer. It'll be recorded by itself when the connection is back.`, "info");
    };

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      printOffline();
      return;
    }

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
        saleId: res.saleId,
        invoiceNo: res.invoiceNo,
        orderTakenByName: res.orderTakenByName,
        billGeneratedByName: res.billGeneratedByName,
        date: formatBillTime(billTime),
        paid: res.paid,
        balance: res.balance,
        creditUsed: res.creditUsed ?? 0,
      });
      const fromCredit = res.creditUsed ?? 0;
      if (customer && fromCredit > 0) setCreditSpent((prev) => ({ ...prev, [customer.id]: (prev[customer.id] ?? 0) + fromCredit }));
      setLastStaff(pickedStaff);
      // Remember which records hold the prescriptions, for "Edit bill".
      const rxIds = res.prescriptionIds ?? [];
      if (recordRx) setRxList((prev) => prev.map((e, i) => ({ ...e, onBillId: rxIds[i] })));
      setShowSuccess(true);
      showToast(`Sale completed — ${res.invoiceNo}`, "success");
      setTimeout(() => {
        setShowSuccess(false);
        setShowReceipt(true);
      }, 750);
    } catch (e) {
      // The request never got a proper answer — most likely no connection. If
      // it did reach the server after all, the sync finds that invoice by
      // clientRef instead of recording it twice.
      // A till left open across an update gets no answer either: the bill is
      // kept the same way and goes through once the page is refreshed.
      if (unstable_isUnrecognizedActionError(e)) reportOutdatedPage();
      printOffline();
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
    const billCredit = saleResult.creditUsed ?? 0;
    const invoice: InvoiceData = {
      invoiceNo: saleResult.invoiceNo,
      provisional: saleResult.provisional,
      date: saleResult.date,
      orderTakenBy: saleResult.orderTakenByName,
      billGeneratedBy: saleResult.billGeneratedByName,
      customerName: customer ? customer.name || customer.phone || "Customer" : null,
      customerPhone: customer ? allNumbers(customer) : "",
      lines: [
        ...cart.map((item) => ({
          key: item.key,
          name: `${item.brand} ${item.name}`.trim(),
          // Colour and description print under the lens they belong to.
          description: item.productId && item.productId === lensProductId
            ? [item.description, lensNote(lensColor, lensDescription)].filter(Boolean).join(" · ")
            : item.description,
          quantity: item.quantity,
          unitPrice: item.price,
          discount: item.discount,
          total: item.price * item.quantity - item.discount,
        })),
        ...(useCustomLens && customLensAmount > 0
          ? [{
              key: "custom-lens", name: customLensName, description: lensNote(lensColor, lensDescription),
              quantity: customLensQty, unitPrice: customLensPrice, discount: 0, total: customLensAmount,
            }]
          : []),
        ...extraLensLines.map((l) => ({
          key: l.key, name: l.name, description: l.description,
          quantity: l.quantity, unitPrice: l.price, discount: 0, total: l.price * l.quantity,
        })),
      ],
      subtotal,
      discount: invoiceDiscount,
      total,
      // Covered entirely by the customer's advance: nothing was taken at the till.
      paymentMethod: billCredit > 0 && saleResult.paid - billCredit <= 0 ? CREDIT_METHOD : billPayment.paymentMethod,
      paymentSplit: billPayment.paymentSplit,
      paymentStatus: saleResult.balance <= 0 ? PAYMENT_TYPE_LABEL.Full : PAYMENT_TYPE_LABEL[paymentType],
      paid: saleResult.paid,
      balance: saleResult.balance,
      payments: billCredit > 0 ? [{ date: new Date().toISOString(), amount: billCredit, method: CREDIT_METHOD }] : undefined,
    };

    return (
      <div className="animate-slide-right solid-sheet rounded-3xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6 no-print">
          <h1 className="text-2xl font-bold">Invoice Preview</h1>
          <div className="flex items-center gap-2">
            {saleResult.saleId && (
              <Link
                href={`/dashboard/prescriptions?addTo=${saleResult.saleId}`}
                title="Add the eye test to this invoice now or later — it keeps its number and totals"
                className="px-4 py-2 glass-card text-sm font-medium cursor-pointer flex items-center gap-2">
                <Glasses className="w-4 h-4" /> Add prescription
              </Link>
            )}
            {canEditBill && (
              <button
                onClick={() => { setEditingBill(true); setEntryMode("manual"); setShowReceipt(false); }}
                title="Change this bill — saving updates the same invoice"
                className="px-4 py-2 glass-card text-sm font-medium cursor-pointer flex items-center gap-2">
                <PenLine className="w-4 h-4" /> Edit bill
              </button>
            )}
            <button onClick={resetSale} className="px-4 py-2 glass-card text-sm font-medium cursor-pointer">
              ← New Sale
            </button>
          </div>
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
        <button onClick={() => { setEntryMode("manual"); setShowManualItem(true); }}
          className="text-xs text-primary font-semibold cursor-pointer">
          Frame not in the system? Type it in with its price
        </button>
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
        {customer && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-sm">
            <User className="w-4 h-4 text-primary" />
            <span>
              New invoice for <span className="font-semibold">{customerLabel}</span>
              {customer.phone ? <span className="text-muted-foreground"> · {allNumbers(customer, " · ")}</span> : null}
            </span>
            <button onClick={() => setSelectedCustomer("")} title="Bill someone else" className="cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
      {editingBill && saleResult && (
        <div className="glass-card p-3 mb-4 flex items-center justify-between gap-3 border border-primary/30">
          <div className="flex items-start gap-2 min-w-0">
            <PenLine className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium">Editing {saleResult.invoiceNo}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Saving updates this invoice — it won&apos;t make a new one.
              </p>
            </div>
          </div>
          <button onClick={resetSale}
            title="Keep the invoice as it was last saved and start the next sale"
            className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-surface-hover cursor-pointer flex-shrink-0">
            Leave it — new sale
          </button>
        </div>
      )}
      {drafts.length > 0 && (
        <div className="glass-card p-3 mb-4 flex items-start justify-between gap-3 border border-warning/30">
          <div className="flex items-start gap-2 min-w-0">
            <WifiOff className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium">
                {drafts.length} bill{drafts.length === 1 ? "" : "s"} made offline, waiting to be recorded — {drafts.length === 1 ? "it goes" : "they go"} through by {drafts.length === 1 ? "itself" : "themselves"} when the connection is back.
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {drafts.map((d) => d.offlineRef ?? d.summary.customerName).join(" · ")}
              </p>
              {drafts.filter((d) => d.lastError).map((d) => (
                <p key={d.id} className="text-[10px] text-destructive mt-0.5">
                  {d.offlineRef ?? d.summary.customerName}: {d.lastError}
                </p>
              ))}
            </div>
          </div>
          <button
            onClick={() => syncDrafts(true)}
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
                <PenLine className="w-3.5 h-3.5" /> Frame / item not in list
              </button>
            </div>

            {showManualItem && (
              <div className="mb-4 p-3 rounded-xl border border-primary/30 bg-primary/5 animate-fade-in">
                <p className="text-xs font-semibold mb-0.5">Type a frame or item that isn&apos;t in the inventory</p>
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
                <label className="flex items-center gap-2 text-[11px] mt-2 cursor-pointer">
                  <input type="checkbox" className="rounded" checked={manualItem.frame}
                    onChange={(e) => setManualItem({ ...manualItem, frame: e.target.checked })} />
                  It&apos;s a frame — offer a lens for it
                </label>
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

            {search && filteredProducts.length > 0 && !showManualItem && (
              <button onClick={() => { setManualItem({ ...EMPTY_MANUAL_ITEM, name: search }); setShowManualItem(true); }}
                className="mb-3 text-[11px] text-primary font-semibold cursor-pointer">
                Not the one? Type this frame in by hand →
              </button>
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
                    {[c.name, c.phone, c.phone2].filter(Boolean).join(" · ") || "No name yet"}
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
                  placeholder="Name (can add later)" className="w-full px-3 py-2 glass-input text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") saveNewCustomer(); }}
                    placeholder="Main number" className="w-full px-3 py-2 glass-input text-xs" />
                  <input type="text" value={newCustomer.phone2}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone2: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") saveNewCustomer(); }}
                    placeholder="Second number (optional)" className="w-full px-3 py-2 glass-input text-xs" />
                </div>
                <input type="text" value={newCustomer.serialNumber}
                  onChange={(e) => setNewCustomer({ ...newCustomer, serialNumber: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") saveNewCustomer(); }}
                  placeholder="Serial no. (optional)" className="w-full px-3 py-2 glass-input text-xs" />
                {onNewCustomerNumber.length > 0 && (
                  <div className="rounded-lg bg-surface p-2 text-[11px] space-y-1">
                    <p className="font-semibold">{`Already on this number — ${onNewCustomerNumber.length} customer${onNewCustomerNumber.length === 1 ? "" : "s"}`}</p>
                    {onNewCustomerNumber.slice(0, 4).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {c.name || "No name yet"}
                          {c.serialNumber && <span className="text-muted-foreground">{` · ${c.serialNumber}`}</span>}
                        </span>
                        <button onClick={() => pickCustomerOnNumber(c.id)}
                          className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium flex-shrink-0 cursor-pointer">
                          Use
                        </button>
                      </div>
                    ))}
                    {onNewCustomerNumber.length > 4 && (
                      <p className="text-muted-foreground">{`…and ${onNewCustomerNumber.length - 4} more — search the number to see them all.`}</p>
                    )}
                    <p className="text-muted-foreground">Or save below to add a separate customer on the same number.</p>
                  </div>
                )}
                <button onClick={saveNewCustomer} disabled={savingCustomer}
                  className="w-full py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer">
                  {savingCustomer && <LensLoader light />}
                  {onNewCustomerNumber.length ? "Save as a new customer on this number" : "Save & select customer"}
                </button>
              </div>
            )}
            {customer && !showNewCustomer && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between px-2 py-1.5 bg-primary/5 rounded-lg">
                  <span className="text-xs font-medium">{[customer.name, customer.phone, customer.phone2].filter(Boolean).join(" · ") || "No name yet"}</span>
                  <button onClick={() => setSelectedCustomer("")}><X className="w-3.5 h-3.5" /></button>
                </div>
                {customer.latestRx && !customer.local && (
                  <button onClick={startReadingPick}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/15 transition-colors cursor-pointer">
                    <History className="w-3.5 h-3.5" /> Use an earlier reading
                  </button>
                )}
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
                      <button onClick={() => { setUseCustomLens(false); setCustomLensName(""); setCustomLensPrice(0); setCustomLensQty(1); }} className="text-[10px] text-primary font-medium flex items-center gap-1">
                        <Search className="w-3 h-3" /> Search catalog
                      </button>
                    )}
                  </div>
                  {useCustomLens ? (
                    <div className="space-y-1">
                      <input type="text" value={customLensName} onChange={(e) => setCustomLensName(e.target.value)}
                        placeholder="Lens name" className="w-full px-3 py-2 glass-input text-xs" />
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input type="number" value={customLensPrice || ""} onChange={(e) => setCustomLensPrice(Number(e.target.value))}
                          placeholder="Price per lens" className="w-full px-3 py-2 glass-input text-xs" />
                        <LensQty value={customLensQty} onChange={setCustomLensQty} />
                      </div>
                      {customLensPrice > 0 && customLensQty > 1 && (
                        <p className="text-[10px] text-muted-foreground text-right">
                          {customLensQty} × {formatCurrency(customLensPrice)} = <span className="font-semibold text-foreground">{formatCurrency(customLensAmount)}</span>
                        </p>
                      )}
                    </div>
                  ) : lensProduct ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-primary/5 rounded-lg">
                      <span className="text-xs font-medium truncate">{lensProduct.brand} {lensProduct.name} — {formatCurrency(lensProduct.salePrice)}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {lensLine && (
                          <LensQty
                            value={lensLine.quantity}
                            max={lensProduct.stock}
                            onChange={(q) => updateQuantity(lensLine.key, q - lensLine.quantity)}
                          />
                        )}
                        <button onClick={clearLens} className="flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                      </div>
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
                              <span className="min-w-0">
                                <span className="block truncate">{p.brand} {p.name}</span>
                                {/* Clear / coloured / daily / extended wear — only contact lenses carry a lens type. */}
                                {p.category === "Contact Lenses" && p.type && (
                                  <span className="block text-[10px] text-muted-foreground">{p.type}</span>
                                )}
                              </span>
                              <span className="text-muted-foreground flex-shrink-0">{formatCurrency(p.salePrice)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Lens colour</label>
                    <select
                      value={lensColorChoice}
                      onChange={(e) => setLensColorChoice(e.target.value)}
                      className="w-full px-3 py-2 glass-input text-xs"
                    >
                      <option value="">Not specified</option>
                      {LENS_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value="Other">Other — type it</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                      {lensColorChoice === "Other" ? "Colour" : "Lens description"}
                    </label>
                    {lensColorChoice === "Other" ? (
                      <input type="text" value={lensColorOther} onChange={(e) => setLensColorOther(e.target.value)}
                        placeholder="Type the colour" className="w-full px-3 py-2 glass-input text-xs" autoFocus />
                    ) : (
                      <input type="text" value={lensDescription} onChange={(e) => setLensDescription(e.target.value)}
                        placeholder="Coating, index, brand..." className="w-full px-3 py-2 glass-input text-xs" />
                    )}
                  </div>
                </div>
                {lensColorChoice === "Other" && (
                  <input type="text" value={lensDescription} onChange={(e) => setLensDescription(e.target.value)}
                    placeholder="Lens description — coating, index, brand..." className="w-full px-3 py-2 glass-input text-xs" />
                )}

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
                    {customer ? (
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {rxPrefilledFrom && !rxTouched
                          ? `Filled in from ${customerLabel}'s reading of ${new Date(rxPrefilledFrom).toLocaleDateString("en-GB")} — change anything that's different, or pick another with "Use an earlier reading". `
                          : ""}
                        {`Saved to ${customerLabel}'s prescription record when you complete the sale.`}
                      </p>
                    ) : (
                      <p className="text-[10px] text-warning">Select a customer above to save the prescription.</p>
                    )}

                    {customer && !customer.local && (
                      <div>
                        <button onClick={() => (readingsOpen ? setReadingsOpen(false) : void showReadings())}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-[11px] font-medium cursor-pointer">
                          <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-primary" /> Use an earlier reading</span>
                          {readingsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {readingsOpen && (
                          <div className="mt-1 rounded-lg border border-border max-h-56 overflow-y-auto divide-y divide-border">
                            {loadingReadings && <p className="px-3 py-2 text-[11px] text-muted-foreground">Loading their readings…</p>}
                            {!loadingReadings && readings?.customerId === customer.id && readings.list.length === 0 && (
                              <p className="px-3 py-2 text-[11px] text-muted-foreground">{`No saved readings for ${customerLabel} yet.`}</p>
                            )}
                            {!loadingReadings && readings?.customerId === customer.id && readings.list.map((r) => (
                              <div key={r.id} className="px-3 py-2 flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold">
                                    {new Date(r.date).toLocaleDateString("en-GB")}
                                    {r.label && <span className="font-normal text-muted-foreground">{` · ${r.label}`}</span>}
                                    {r.isOwn && <span className="font-normal text-muted-foreground">{" · own prescription"}</span>}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground tabular-nums">{readingSummary(r)}</p>
                                  {r.invoiceNo && <p className="text-[10px] text-muted-foreground">{`On ${r.invoiceNo}`}</p>}
                                </div>
                                <button onClick={() => pickReading(r)}
                                  className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-semibold flex-shrink-0 cursor-pointer">
                                  Use this
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {rxList.map((entry, index) => (
                      <div key={entry.key} className="p-2 rounded-lg border border-border space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text" value={entry.label}
                            onChange={(e) => editRx(entry.key, { label: e.target.value })}
                            placeholder={rxList.length > 1 ? `Whose eyes? e.g. ${index === 0 ? "Ahmed" : "Sara"}, or "reading"` : "Whose eyes / what for (optional)"}
                            className="flex-1 px-2.5 py-1.5 glass-input text-[11px]"
                          />
                          {rxList.length > 1 && (
                            <button onClick={() => removeRx(entry.key)} title="Remove this prescription"
                              className="p-1 rounded-md hover:bg-surface-hover cursor-pointer flex-shrink-0">
                              <X className="w-3.5 h-3.5 text-destructive" />
                            </button>
                          )}
                        </div>

                        <label className="flex items-center gap-2 text-[10px] font-medium cursor-pointer">
                          <input type="checkbox" checked={entry.isOwn}
                            onChange={(e) => editRx(entry.key, { isOwn: e.target.checked })} className="rounded" />
                          Own Prescription — customer brought this from outside
                        </label>

                        {(["Right Eye (OD)", "Left Eye (OS)"] as const).map((eye) => {
                          const prefix = eye.includes("Right") ? "right" : "left";
                          return (
                            <div key={eye}>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">{eye}</p>
                              <div className="grid grid-cols-5 gap-1">
                                {(["Sph", "Cyl", "Axis", "Pd", "Add"] as const).map((f) => {
                                  const key = `${prefix}${f}` as keyof RxEntry;
                                  return (
                                    <div key={f}>
                                      <label className="text-[9px] text-muted-foreground block text-center mb-0.5">{f.toUpperCase()}</label>
                                      {isPowerField(f) ? (
                                        <RxPowerInput compact placeholder="0" value={entry[key] as string}
                                          onChange={(v) => editRx(entry.key, { [key]: v })} />
                                      ) : (
                                        <input type="number" step={f === "Axis" ? 1 : 0.5} min={0} placeholder="0"
                                          value={entry[key] as string}
                                          onChange={(e) => editRx(entry.key, { [key]: e.target.value })}
                                          className="w-full px-1 py-1 glass-input text-[10px] text-center" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        <p className="text-[9px] text-muted-foreground leading-snug">
                          SPH, CYL and ADD take letters too — type them after the number (2.50 DS), or tap ± and pick ABC.
                        </p>

                        {index === 0 ? (
                          rxList.length > 1 && (
                            <p className="text-[10px] text-muted-foreground">
                              {`Lens for this one: ${rxLens(entry).lensName || "none chosen"} — it's the Lens box at the top. Each prescription below has its own.`}
                            </p>
                          )
                        ) : (
                          <RxLensPicker entry={entry} lenses={lensProducts} onChange={(patch) => editRx(entry.key, patch)} />
                        )}

                        <input type="text" value={entry.notes} onChange={(e) => editRx(entry.key, { notes: e.target.value })}
                          className="w-full px-3 py-1.5 glass-input text-[10px]" placeholder="Rx notes (optional)..." />

                        {customer && !customer.local && (
                          entry.savedId && !entry.savedChanged ? (
                            <p className="flex items-center justify-center gap-1 text-[10px] text-success font-medium">
                              <Check className="w-3 h-3" /> On {customerLabel}&apos;s record — the sale will use this one
                            </p>
                          ) : (
                            <button onClick={() => saveRxNow(entry)} disabled={savingRx !== null}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-[10px] font-medium disabled:opacity-60 cursor-pointer">
                              {savingRx === entry.key ? <LensLoader /> : <Save className="w-3 h-3" />}
                              {entry.savedId ? `Update ${customerLabel}'s record now` : `Save to ${customerLabel}'s record now`}
                            </button>
                          )
                        )}
                      </div>
                    ))}

                    <button onClick={addRx}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/15 transition-colors cursor-pointer">
                      <Plus className="w-3 h-3" /> Add another prescription to this slip
                    </button>
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
              {cartRows.map((item) => (
                <div key={item.key}
                  className={`py-2 border-b border-border ${item.forKey ? "pl-3 pr-1.5 ml-3 border-l-2 border-l-primary/40" : "px-1.5 -mx-1.5"} ${poppedId === item.key ? "animate-cart-pop" : ""}`}>
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
                    <button onClick={() => setCart((prev) => withoutOrphanLenses(prev.filter((i) => i.key !== item.key)))}
                      aria-label={`Remove ${item.name}`}>
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
                  {item.isFrame && (
                    <button onClick={() => setLensFor(item.key)}
                      className="mt-1 text-[10px] text-primary font-semibold flex items-center gap-1 cursor-pointer">
                      <Glasses className="w-3 h-3" />
                      {cart.some((l) => l.forKey === item.key) ? "Add another lens" : "Add a lens for this frame"}
                    </button>
                  )}
                </div>
              ))}
              {extraLensLines.map((l) => (
                <div key={l.key} className="py-2 px-1.5 -mx-1.5 border-b border-border">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{l.name}</p>
                      <p className="text-[10px] text-muted-foreground">{`${l.description} · ${l.quantity} × ${formatCurrency(l.price)}`}</p>
                    </div>
                    <span className="text-xs font-semibold flex-shrink-0">{formatCurrency(l.price * l.quantity)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Change it in that prescription&apos;s lens box above.</p>
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
                {creditAvailable > 0 && !editingBill && customer && (
                  <label className="flex items-start gap-2 p-2.5 rounded-xl border border-success/30 bg-success/5 text-xs cursor-pointer">
                    <input type="checkbox" className="rounded mt-0.5" checked={useCreditFor === customer.id}
                      onChange={(e) => setUseCreditFor(e.target.checked ? customer.id : "")} />
                    <span className="min-w-0">
                      <span className="font-semibold">{`Use advance held — ${formatCurrency(creditAvailable)}`}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {creditUsed > 0
                          ? `${formatCurrency(creditUsed)} comes off this bill · ${formatCurrency(creditAvailable - creditUsed)} stays as their advance`
                          : "Tick to pay this bill from the money they've already paid in."}
                      </span>
                    </span>
                  </label>
                )}
                {editingBill && creditUsed > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {`${formatCurrency(creditUsed)} of this bill came from their advance — change that from the invoice's payments in Sales & Invoices.`}
                  </p>
                )}
                {creditUsed > 0 && (
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{due > 0 ? "Left to pay after the advance" : "The advance covers this bill"}</span>
                    <span className={due > 0 ? "" : "text-success"}>{formatCurrency(due)}</span>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Payment Method</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { id: "Cash", icon: Banknote },
                      { id: "Card", icon: CreditCard },
                      { id: "Bank Transfer", icon: Building2 },
                      { id: "JazzCash", icon: Smartphone },
                      { id: SPLIT_METHOD, icon: Split },
                    ].map((pm) => (
                      <button
                        key={pm.id}
                        onClick={() => setPaymentMethod(pm.id)}
                        title={pm.id === SPLIT_METHOD ? "Customer pays part by one method and part by another — e.g. some cash, the rest on card" : undefined}
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
                        onClick={() => choosePaymentType(pt)}
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

                {isSplit && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">
                      {paymentType === "Full" ? "How the total is being paid" : paymentType === "Advance" ? "Advance paid now, by method" : "Paid now, by method"}
                    </p>
                    <SplitPaymentFields
                      amounts={splitAmounts}
                      onChange={setSplitAmounts}
                      target={payType === "Full" ? due : null}
                      total={due}
                    />
                  </div>
                )}

                {paymentType !== "Full" && !isSplit && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">
                      {paymentType === "Advance" ? "Advance Amount" : "Amount paid now"}
                    </p>
                    <input
                      type="number"
                      min={0}
                      value={advanceAmount || ""}
                      onChange={(e) => setAdvanceAmount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 glass-input text-sm"
                      placeholder={paymentType === "Advance" ? "Enter advance amount" : "e.g. 1500 — leave empty if nothing is paid"}
                    />
                  </div>
                )}

                {payType !== "Full" && due > 0 && (
                  advancePaid > due + 0.01 ? (
                    <p className="text-[11px] text-destructive">
                      {`${formatCurrency(advancePaid)} is more than the ${formatCurrency(due)} to pay — choose Full Payment instead.`}
                    </p>
                  ) : (
                    <div className="rounded-xl bg-surface p-2.5 text-xs space-y-1">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Paid now</span><span>{formatCurrency(paidNow)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>{balanceLeft > 0 ? "Balance remaining" : "Nothing left to pay"}</span>
                        <span className={balanceLeft > 0 ? "text-destructive" : "text-success"}>{formatCurrency(balanceLeft)}</span>
                      </div>
                      {balanceLeft > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          Collect it later from Sales &amp; Invoices or the customer&apos;s profile — part payments are fine, whatever&apos;s left stays owed.
                        </p>
                      )}
                    </div>
                  )
                )}

                {canBackdate && (
                  <div>
                    {!billDate ? (
                      <button onClick={() => setBillDate(toLocalInput(new Date()))}
                        className="text-[10px] text-primary font-medium flex items-center gap-1 cursor-pointer">
                        <CalendarClock className="w-3 h-3" /> Bill date: now — change for an old invoice
                      </button>
                    ) : (
                      <div className="p-2.5 rounded-lg border border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" /> Bill date &amp; time
                          </p>
                          <button onClick={() => { setBillDate(""); setDeductOldStock(false); }} className="text-[10px] text-primary font-medium cursor-pointer">
                            Use now
                          </button>
                        </div>
                        <input type="datetime-local" value={billDate} max={toLocalInput(new Date())}
                          onChange={(e) => setBillDate(e.target.value)} className="w-full px-3 py-2 glass-input text-xs" />
                        {isOldBill && (
                          <>
                            <p className="text-[10px] text-warning">
                              {`Old invoice — it counts on ${billDateValue!.toLocaleDateString("en-GB")} in sales, cash collection and the customer's history.`}
                            </p>
                            <label className="flex items-start gap-2 text-[10px] cursor-pointer">
                              <input type="checkbox" checked={deductOldStock} onChange={(e) => setDeductOldStock(e.target.checked)} className="rounded mt-0.5" />
                              <span>
                                Take these items out of stock
                                <span className="block text-muted-foreground">Leave unticked for old paper records — today&apos;s stock count already reflects them.</span>
                              </span>
                            </label>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {saleBlocker && (
                  <p className="flex items-start gap-1.5 text-[11px] font-medium text-destructive" role="alert">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                    <span>{saleBlocker}</span>
                  </p>
                )}
                <button
                  onClick={completeSale}
                  disabled={saving}
                  className="w-full py-3 bg-primary text-white rounded-2xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <LensLoader light />}
                  {saving
                    ? "Processing…"
                    : editingBill && saleResult
                      ? `Save changes to ${saleResult.invoiceNo} — ${formatCurrency(total)}`
                      : `Complete Sale — ${formatCurrency(total)}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {lensFor && (() => {
        const frame = cart.find((i) => i.key === lensFor);
        if (!frame) return null;
        return (
          <LensPicker
            frameName={[frame.brand, frame.name].filter(Boolean).join(" ")}
            lenses={lensProducts}
            offerEveryTime={offerLens}
            onOfferChange={changeOfferLens}
            onPick={(lens) => addLensToFrame(lensFor, lens)}
            onClose={() => setLensFor(null)}
          />
        );
      })()}
    </div>
  );
}
