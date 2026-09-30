// The release the server is running now. A page opened before a newer release
// went live sees a different value from the one built into it (UpdateNotice).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { version: process.env.NEXT_PUBLIC_BUILD_VERSION ?? "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
