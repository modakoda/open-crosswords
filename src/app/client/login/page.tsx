import { ClientAuthForm } from "@/components/client/ClientAuthForm";
import { getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/request";

export default async function ClientLoginPage() {
  const messages = getMessages(await getRequestLocale());
  return <ClientAuthForm mode="login" messages={messages.client} />;
}
