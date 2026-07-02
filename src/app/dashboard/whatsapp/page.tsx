import { getWhatsAppMessages } from "@/lib/data";
import { WhatsAppClient } from "./WhatsAppClient";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const messages = await getWhatsAppMessages();
  return <WhatsAppClient messages={messages} />;
}
