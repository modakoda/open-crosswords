"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircleIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryPicker } from "@/components/CategoryPicker";
import { PaperOptionsFields } from "@/components/PaperOptionsFields";
import { orpc } from "@/lib/orpc/client";
import { getMessages, resolveLocale, type Locale } from "@/lib/i18n";
import { ORIENTATIONS, PAPER_SIZES } from "@/lib/validation/schemas";

interface Language {
  code: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
}

export function GenerateForm({ initialLocale }: { initialLocale: Locale }) {
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [language, setLanguage] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paperSize, setPaperSize] = useState<(typeof PAPER_SIZES)[number]>("a4");
  const [orientation, setOrientation] =
    useState<(typeof ORIENTATIONS)[number]>("portrait");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = getMessages(resolveLocale(language, initialLocale)).generateForm;

  useEffect(() => {
    orpc.languages
      .list()
      .then((d) => {
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
    orpc.categories
      .list({ languageCode: language })
      .then((d) => setCategories(d.categories))
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
      const { puzzle } = await orpc.puzzles.generate({
        languageCode: language,
        categoryIds: selected.size ? [...selected] : undefined,
        paperSize,
        orientation,
        title: title.trim() || undefined,
      });
      toast.success(t.generatedToast);
      router.push(`/public/puzzles/${puzzle.slug}`);
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

        <CategoryPicker
          categories={categories}
          loading={catLoading}
          selected={selected}
          onToggle={toggle}
          onClear={() => setSelected(new Set())}
          t={t}
        />

        <Separator />

        <PaperOptionsFields
          paperSize={paperSize}
          orientation={orientation}
          onPaperSizeChange={setPaperSize}
          onOrientationChange={setOrientation}
          t={t}
        />

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
          {busy ? <LoaderCircleIcon className="animate-spin" /> : <SparklesIcon />}
          {busy ? t.generating : t.generate}
        </Button>
      </CardFooter>
    </Card>
  );
}
