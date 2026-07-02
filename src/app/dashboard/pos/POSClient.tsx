"use client";

import { useState, useMemo } from "react";
import type { Product } from "@/lib/mock/types";
import { formatCurrency } from "@/lib/utils/format";
import { useApp } from "@/lib/context";
import { SHOP_NAME } from "@/lib/constants";
import { createSale } from "@/lib/actions/sales";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Minus, Trash2, X, User, CreditCard,
  Banknote, Building2, Smartphone, Printer, MessageCircle, Receipt, Loader2,
  Glasses, ChevronDown, ChevronUp, TrendingUp,
} from "lucide-react";

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

interface SaleResult {
  invoiceNo: string;
  servedBy: string;
  date: string;
}

export function POSClient({ products, customers }: { products: Product[]; customers: POSCustomer[] }) {
  const { showToast } = useApp();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentType, setPaymentType] = useState<"Full" | "Advance" | "Balance">("Full");
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [showReceipt, setShowReceipt] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [showJob, setShowJob] = useState(false);
  const [lensProductId, setLensProductId] = useState("");
  const [labCharges, setLabCharges] = useState(0);
  const [fittingCharges, setFittingCharges] = useState(0);

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

  const addToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
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

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity - i.discount, 0);
  const total = subtotal - invoiceDiscount;
  const customer = customers.find((c) => c.id === selectedCustomer);

  // Profitability: real cost = product costs + lab + fitting charges
  const itemCost = cart.reduce((sum, i) => {
    const p = products.find((pr) => pr.id === i.productId);
    return sum + (p ? p.costPrice * i.quantity : 0);
  }, 0);
  const totalCost = itemCost + labCharges + fittingCharges;
  const profit = total - totalCost;
  const margin = total > 0 ? (profit / total) * 100 : 0;

  const selectLens = (id: string) => {
    setLensProductId(id);
    if (id) addToCart(id);
  };

  const resetSale = () => {
    setShowReceipt(false);
    setCart([]);
    setInvoiceDiscount(0);
    setSelectedCustomer("");
    setAdvanceAmount(0);
    setPaymentType("Full");
    setPaymentMethod("Cash");
    setSaleResult(null);
    setShowJob(false);
    setLensProductId("");
    setLabCharges(0);
    setFittingCharges(0);
    router.refresh();
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    if (paymentType === "Advance" && advanceAmount <= 0) {
      showToast("Enter the advance amount received", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await createSale({
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.price, discount: i.discount })),
        customerId: selectedCustomer || undefined,
        paymentMethod,
        paymentType,
        advanceAmount,
        invoiceDiscount,
        lensProductId: lensProductId || undefined,
        labCharges,
        fittingCharges,
      });
      setSaleResult({
        invoiceNo: res.invoiceNo,
        servedBy: res.servedBy,
        date: new Date().toLocaleString("en-PK", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      });
      setShowReceipt(true);
      showToast(`Sale completed — ${res.invoiceNo}`, "success");
    } catch {
      showToast("Could not complete the sale. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (showReceipt && saleResult) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
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
              <p className="text-[10px]">Served by: {saleResult.servedBy}</p>
              {customer && <p className="text-[10px]">Customer: {customer.name}</p>}
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
          </div>
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold mb-4">A4 Invoice</h3>
            <div className="bg-white text-black rounded-lg p-6 shadow-lg text-sm">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#1f5d8c]">{SHOP_NAME}</h2>
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
                </tbody>
              </table>
              <div className="border-t-2 border-gray-200 pt-3 space-y-1 text-right">
                <p>Subtotal: {formatCurrency(subtotal)}</p>
                {invoiceDiscount > 0 && <p>Discount: -{formatCurrency(invoiceDiscount)}</p>}
                <p className="text-lg font-bold text-[#1f5d8c]">Total: {formatCurrency(total)}</p>
                <p className="text-xs text-gray-500">Served by {saleResult.servedBy}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => window.print()}
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

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Point of Sale</h1>
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
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
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
                  <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Lens (adds to order)</label>
                  <select value={lensProductId} onChange={(e) => selectLens(e.target.value)} className="w-full px-3 py-2 glass-input text-xs">
                    <option value="">No lens</option>
                    {lensProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.brand} {p.name} — {formatCurrency(p.salePrice)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Lab charges (cost)</label>
                    <input type="number" value={labCharges || ""} onChange={(e) => setLabCharges(Number(e.target.value))}
                      className="w-full px-3 py-2 glass-input text-xs" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Fitting charges (cost)</label>
                    <input type="number" value={fittingCharges || ""} onChange={(e) => setFittingCharges(Number(e.target.value))}
                      className="w-full px-3 py-2 glass-input text-xs" placeholder="0" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Lab &amp; fitting are shop costs — they reduce profit but aren&apos;t added to the customer&apos;s bill.</p>
              </div>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-muted-foreground">
              <p className="text-xs">Click products to add to cart</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.productId} className="flex items-center gap-2 py-2 border-b border-border">
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

          {cart.length > 0 && (
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
                <div className={`flex items-center justify-between text-[11px] mt-1 px-2 py-1.5 rounded-lg ${profit < 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Profit (cost {formatCurrency(totalCost)})</span>
                  <span className="font-semibold">{formatCurrency(profit)} · {margin.toFixed(0)}%</span>
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
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
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
