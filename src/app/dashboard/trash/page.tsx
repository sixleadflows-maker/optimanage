import { redirect } from "next/navigation";
import { getTrashItems } from "@/lib/data";
import { auth } from "@/lib/auth";
import { TrashClient } from "./TrashClient";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const [items, session] = await Promise.all([getTrashItems(), auth()]);
  // Cashiers shouldn't be able to bring back deleted stock or staff accounts.
  if (session?.user?.role === "CASHIER") redirect("/dashboard");
  return <TrashClient items={items} isOwner={session?.user?.role === "OWNER"} />;
}
