import { getSettings } from "@/lib/data";
import { CartProvider } from "@/lib/cart-context";
import { ShopHeader } from "./ShopHeader";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        <ShopHeader shopName={settings.name} />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
        <footer className="text-center text-xs text-muted-foreground py-6 border-t border-border">
          {settings.name}
          {settings.address ? ` · ${settings.address}` : ""}
          {settings.phone ? ` · ${settings.phone}` : ""}
        </footer>
      </div>
    </CartProvider>
  );
}
