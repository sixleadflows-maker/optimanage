import { getSettings, getUsers, getBranches } from "@/lib/data";
import { auth } from "@/lib/auth";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, users, branches, session] = await Promise.all([getSettings(), getUsers(), getBranches(), auth()]);
  const canManage = session?.user?.role !== "CASHIER";
  const isOwner = session?.user?.role === "OWNER";
  return <SettingsClient settings={settings} users={users} branches={branches} canManage={canManage} isOwner={isOwner} currentUserId={session?.user?.id ?? ""} />;
}
