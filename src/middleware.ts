import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STOREFRONT_HOSTS = (process.env.STOREFRONT_HOSTNAMES ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const isStorefrontHost = STOREFRONT_HOSTS.some((h) => hostname.includes(h));

  if (isStorefrontHost) {
    return NextResponse.rewrite(new URL("/shop", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
