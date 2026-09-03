import { GenerateForm } from "@/components/GenerateForm";
import { getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/request";

export default async function HomePage() {
  const locale = await getRequestLocale();
  const messages = getMessages(locale);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{messages.home.title}</h1>
        <p className="mt-1 text-muted-foreground">{messages.home.subtitle}</p>
      </div>
      <GenerateForm initialLocale={locale} />
    </div>
  );
}
