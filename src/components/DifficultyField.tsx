"use client";

import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Messages } from "@/lib/i18n";
import { DIFFICULTY_LEVELS } from "@/lib/validation/schemas";

export function DifficultyField({
  difficulty,
  onDifficultyChange,
  t,
}: {
  difficulty: (typeof DIFFICULTY_LEVELS)[number];
  onDifficultyChange: (value: (typeof DIFFICULTY_LEVELS)[number]) => void;
  t: Messages["generateForm"];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{t.difficulty}</Label>
      <ToggleGroup
        type="single"
        variant="outline"
        value={difficulty}
        onValueChange={(v) =>
          v && onDifficultyChange(v as (typeof DIFFICULTY_LEVELS)[number])
        }
        className="w-full"
      >
        {DIFFICULTY_LEVELS.map((v) => (
          <ToggleGroupItem key={v} value={v} className="flex-1">
            {t.difficulties[v]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">{t.difficultyHint}</p>
    </div>
  );
}
