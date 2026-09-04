import { FileTextIcon, Globe2Icon, ShareIcon } from "lucide-react";

import { GenerateForm } from "@/components/GenerateForm";
import { Badge } from "@/components/ui/badge";
import { getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/request";

export default async function HomePage() {
  const locale = await getRequestLocale();
  const messages = getMessages(locale);
  const t = messages.home;

  const features = [
    { icon: FileTextIcon, label: t.featurePrintable },
    { icon: ShareIcon, label: t.featureOnline },
    { icon: Globe2Icon, label: t.featureMultilingual },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          {t.eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t.title}
        </h1>
        <p className="max-w-2xl text-muted-foreground text-pretty">{t.subtitle}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {features.map(({ icon: Icon, label }) => (
            <Badge key={label} variant="outline" className="gap-1.5 py-1 font-normal">
              <Icon className="size-3.5 text-muted-foreground" />
              {label}
            </Badge>
          ))}
        </div>
      </header>

      <GenerateForm initialLocale={locale} />
    </div>
  );
}
