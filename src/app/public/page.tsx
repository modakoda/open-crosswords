import { FileTextIcon, Globe2Icon, ShareIcon, SparklesIcon } from "lucide-react";

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
    <div className="space-y-10">
      <header className="relative isolate overflow-hidden rounded-3xl border border-border/60 bg-card/50 px-6 py-12 text-center shadow-sm backdrop-blur-sm sm:px-10 sm:py-16">
        {/* Cosmetic glow behind the headline, matching the site chrome. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-56 w-[38rem] max-w-[120%] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        />

        <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground backdrop-blur">
          <SparklesIcon className="size-3.5 text-primary" aria-hidden />
          {t.eyebrow}
        </p>

        <h1 className="mt-5 bg-gradient-to-br from-foreground via-foreground to-primary bg-clip-text text-4xl font-semibold tracking-tight text-balance text-transparent sm:text-5xl">
          {t.title}
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-muted-foreground text-pretty">
          {t.subtitle}
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {features.map(({ icon: Icon, label }) => (
            <Badge
              key={label}
              variant="outline"
              className="gap-1.5 rounded-full border-border/70 bg-background/60 py-1.5 pl-2.5 pr-3 font-normal backdrop-blur"
            >
              <Icon className="size-3.5 text-primary" />
              {label}
            </Badge>
          ))}
        </div>
      </header>

      <GenerateForm initialLocale={locale} />
    </div>
  );
}
