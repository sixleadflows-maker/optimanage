import { getSettings, getUsers } from "@/lib/data";
import { auth } from "@/lib/auth";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, users, session] = await Promise.all([getSettings(), getUsers(), auth()]);
  const canManage = session?.user?.role !== "CASHIER";
  return <SettingsClient settings={settings} users={users} canManage={canManage} />;
}
