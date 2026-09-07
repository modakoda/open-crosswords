"use client";

import { useEffect, useRef, useState } from "react";
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
import { CategoryPicker } from "@/components/CategoryPicker";
import { DifficultyField } from "@/components/DifficultyField";
import { LanguageField, type Language } from "@/components/LanguageField";
import { PaperOptionsFields } from "@/components/PaperOptionsFields";
import { generateErrorMessage } from "@/lib/generate-error";
import { orpc } from "@/lib/orpc/client";
import { getMessages, resolveLocale, type Locale } from "@/lib/i18n";
import {
  DIFFICULTY_LEVELS,
  ORIENTATIONS,
  PAPER_SIZES,
} from "@/lib/validation/schemas";

interface Category {
  id: string;
  name: string;
}

export function GenerateForm({ initialLocale }: { initialLocale: Locale }) {
  const router = useRouter();
  // The content language starts from the site's UI locale — a visitor browsing
  // in Lithuanian gets Lithuanian clues — but the picker lets them build a
  // puzzle in any language the library actually has. Empty until the library
  // answers, since only it can say which languages exist.
  const [languages, setLanguages] = useState<Language[] | null>(null);
  const [language, setLanguage] = useState("");
  // Set once the visitor picks a content language themselves; from then on the
  // site's UI language stops steering it, so switching the chrome to Lithuanian
  // never overrides a deliberate "build me an English puzzle".
  const pickedByVisitor = useRef(false);
  // The list and the language it belongs to are one piece of state, so
  // "still loading" is derived during render instead of being set from inside
  // the effect (which would cascade renders).
  const [loaded, setLoaded] = useState<{
    language: string;
    categories: Category[];
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paperSize, setPaperSize] = useState<(typeof PAPER_SIZES)[number]>("a4");
  const [orientation, setOrientation] =
    useState<(typeof ORIENTATIONS)[number]>("portrait");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTY_LEVELS)[number]>("any");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chrome inside the form follows the language the puzzle will be built in,
  // falling back to the site locale for a content language with no dictionary.
  const t = getMessages(resolveLocale(language, initialLocale)).generateForm;

  useEffect(() => {
    orpc.languages
      .list()
      .then((d) => setLanguages(d.languages))
      .catch(() => {
        setLanguages([]);
        setError(getMessages(initialLocale).generateForm.loadError);
      });
    // Runs once on mount — the library's language list doesn't depend on the
    // site locale, so a locale switch must not refetch it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follows the site's UI language. `initialLocale` is a server-rendered prop,
  // so switching languages in the header (`setLocale` + `router.refresh()`)
  // re-renders this component with a new value rather than remounting it —
  // without this the form would keep the language it resolved on first load
  // until a full page reload.
  useEffect(() => {
    if (!languages?.length || pickedByVisitor.current) return;
    // The site's language wins when the library has it; otherwise the visitor
    // still gets a working form in whatever it does have.
    const preferred =
      languages.find((l) => l.code === initialLocale) ?? languages[0];
    setLanguage((current) =>
      current === preferred.code ? current : preferred.code,
    );
    // Category ids belong to one language, so a list picked in the old one
    // would filter the new library down to nothing.
    setSelected((current) => (current.size ? new Set() : current));
  }, [languages, initialLocale]);

  useEffect(() => {
    if (!language) return;
    let cancelled = false;
    const settle = (categories: Category[]) => {
      if (!cancelled) setLoaded({ language, categories });
    };
    orpc.categories
      .list({ languageCode: language })
      .then((d) => settle(d.categories))
      .catch(() => settle([]));
    return () => {
      cancelled = true;
    };
  }, [language]);

  function changeLanguage(code: string) {
    pickedByVisitor.current = true;
    setLanguage(code);
    // Category ids belong to one language, so a stale selection would filter
    // the new library down to nothing.
    setSelected(new Set());
  }

  // A list fetched for a previous language still reads as "loading".
  const categories = loaded?.language === language ? loaded.categories : [];
  const catLoading = loaded?.language !== language;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
        difficulty,
        title: title.trim() || undefined,
      });
      toast.success(t.generatedToast);
      router.push(`/public/puzzles/${puzzle.slug}`);
    } catch (e) {
      const message = generateErrorMessage(e, t);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  if (languages?.length === 0) {
    return (
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardContent className="py-8 text-sm text-muted-foreground">
          {error ?? t.noLanguages}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/60 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle>{t.formTitle}</CardTitle>
        <CardDescription>{t.formDescription}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <LanguageField
          languages={languages ?? []}
          language={language}
          onLanguageChange={changeLanguage}
          t={t}
        />

        <Separator />

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

        <DifficultyField
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
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
        <Button
          size="lg"
          onClick={generate}
          disabled={busy || !language}
          className="w-full bg-gradient-to-r from-primary to-chart-5 text-primary-foreground shadow-md transition-shadow hover:shadow-lg hover:brightness-105 sm:w-auto"
        >
          {busy ? <LoaderCircleIcon className="animate-spin" /> : <SparklesIcon />}
          {busy ? t.generating : t.generate}
        </Button>
      </CardFooter>
    </Card>
  );
}
