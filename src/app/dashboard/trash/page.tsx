import { redirect } from "next/navigation";
import { getTrashItems } from "@/lib/data";
import { auth } from "@/lib/auth";
import { TrashClient } from "./TrashClient";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const session = await auth();
  // Cashiers shouldn't be able to bring back deleted stock or staff accounts.
  if (session?.user?.role === "CASHIER") redirect("/dashboard");
  const items = await getTrashItems(session?.user?.role);
  return <TrashClient items={items} isOwner={session?.user?.role === "OWNER"} />;
}
