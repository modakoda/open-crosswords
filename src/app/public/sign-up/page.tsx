import { ClientAuthForm } from "@/components/client/ClientAuthForm";
import { getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/request";

export default async function SignUpPage() {
  const messages = getMessages(await getRequestLocale());
  return <ClientAuthForm mode="signup" messages={messages.client} />;
}
