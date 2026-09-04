"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LoaderCircleIcon,
  RectangleHorizontalIcon,
  RectangleVerticalIcon,
  SparklesIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { getMessages, resolveLocale, type Locale } from "@/lib/i18n";

interface Language {
  code: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
}

const PAPER_ORDER = ["a4", "letter", "a5", "legal"] as const;

export function GenerateForm({ initialLocale }: { initialLocale: Locale }) {
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [language, setLanguage] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paperSize, setPaperSize] = useState("a4");
  const [orientation, setOrientation] = useState("portrait");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = getMessages(resolveLocale(language, initialLocale)).generateForm;

  useEffect(() => {
    fetch("/api/languages")
      .then((r) => r.json())
      .then((d: { languages: Language[] }) => {
        setLanguages(d.languages);
        if (d.languages[0]) setLanguage(d.languages[0].code);
      })
      .catch(() => setError(getMessages(initialLocale).generateForm.loadError));
    // Runs once on mount — `initialLocale` is fixed for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!language) return;
    setCatLoading(true);
    fetch(`/api/categories?languageCode=${encodeURIComponent(language)}`)
      .then((r) => r.json())
      .then((d: { categories: Category[] }) => setCategories(d.categories))
      .catch(() => setCategories([]))
      .finally(() => setCatLoading(false));
  }, [language]);

  function changeLanguage(code: string) {
    setLanguage(code);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/puzzles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          languageCode: language,
          categoryIds: selected.size ? [...selected] : undefined,
          paperSize,
          orientation,
          title: title.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.genericError);
      toast.success(t.generatedToast);
      router.push(`/puzzles/${data.puzzle.slug}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : t.genericError;
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (languages.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          {error ?? t.noLanguages}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t.formTitle}</CardTitle>
        <CardDescription>{t.formDescription}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="language">{t.language}</Label>
          <Select value={language} onValueChange={changeLanguage}>
            <SelectTrigger id="language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="mb-0">{t.categories}</Label>
            <Badge variant="secondary" className="tabular-nums">
              {selected.size ? selected.size : t.all}
            </Badge>
            {selected.size > 0 && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="ml-auto text-muted-foreground"
                onClick={() => setSelected(new Set())}
              >
                <XIcon />
                {t.clear}
              </Button>
            )}
          </div>

          {catLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-20 rounded-lg" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noCategories}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const on = selected.has(c.id);
                return (
                  <Button
                    key={c.id}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    onClick={() => toggle(c.id)}
                    className={cn(!on && "text-muted-foreground")}
                  >
                    {c.name}
                  </Button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">{t.categoriesHint}</p>
        </div>

        <Separator />

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t.paperSize}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={paperSize}
              onValueChange={(v) => v && setPaperSize(v)}
              className="w-full"
            >
              {PAPER_ORDER.map((v) => (
                <ToggleGroupItem key={v} value={v} className="flex-1">
                  {t.paper[v]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-1.5">
            <Label>{t.orientation}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={orientation}
              onValueChange={(v) => v && setOrientation(v)}
              className="w-full"
            >
              <ToggleGroupItem value="portrait" className="flex-1">
                <RectangleVerticalIcon />
                {t.portrait}
              </ToggleGroupItem>
              <ToggleGroupItem value="landscape" className="flex-1">
                <RectangleHorizontalIcon />
                {t.landscape}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title">{t.title}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.titlePlaceholder}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>{t.genericError}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter>
        <Button size="lg" onClick={generate} disabled={busy || !language}>
          {busy ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <SparklesIcon />
          )}
          {busy ? t.generating : t.generate}
        </Button>
      </CardFooter>
    </Card>
  );
}
