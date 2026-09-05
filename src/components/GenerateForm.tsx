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
import { CategoryPicker } from "@/components/CategoryPicker";
import { DifficultyField } from "@/components/DifficultyField";
import { PaperOptionsFields } from "@/components/PaperOptionsFields";
import { generateErrorMessage } from "@/lib/generate-error";
import { orpc } from "@/lib/orpc/client";
import { getMessages, type Locale } from "@/lib/i18n";
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
  // The content language always follows the site's UI locale — there is no
  // separate picker, so a visitor browsing in Lithuanian gets Lithuanian clues.
  const language = initialLocale;
  const [available, setAvailable] = useState<boolean | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paperSize, setPaperSize] = useState<(typeof PAPER_SIZES)[number]>("a4");
  const [orientation, setOrientation] =
    useState<(typeof ORIENTATIONS)[number]>("portrait");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTY_LEVELS)[number]>("any");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = getMessages(initialLocale).generateForm;

  useEffect(() => {
    // Only to tell "this locale has no clue library yet" apart from "this
    // library has no categories" — the result never changes what's selected.
    orpc.languages
      .list()
      .then((d) => setAvailable(d.languages.some((l) => l.code === language)))
      .catch(() => {
        setAvailable(false);
        setError(t.loadError);
      });
    // Runs once on mount — the locale is fixed for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCatLoading(true);
    orpc.categories
      .list({ languageCode: language })
      .then((d) => setCategories(d.categories))
      .catch(() => setCategories([]))
      .finally(() => setCatLoading(false));
  }, [language]);

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

  if (available === false) {
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
          disabled={busy}
          className="w-full bg-gradient-to-r from-primary to-chart-5 text-primary-foreground shadow-md transition-shadow hover:shadow-lg hover:brightness-105 sm:w-auto"
        >
          {busy ? <LoaderCircleIcon className="animate-spin" /> : <SparklesIcon />}
          {busy ? t.generating : t.generate}
        </Button>
      </CardFooter>
    </Card>
  );
}
