"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Messages } from "@/lib/i18n";

interface Category {
  id: string;
  name: string;
}

export function CategoryPicker({
  categories,
  loading,
  selected,
  onToggle,
  onClear,
  t,
}: {
  categories: Category[];
  loading: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  t: Messages["generateForm"];
}) {
  return (
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
            onClick={onClear}
          >
            <XIcon />
            {t.clear}
          </Button>
        )}
      </div>

      {loading ? (
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
                onClick={() => onToggle(c.id)}
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
  );
}
