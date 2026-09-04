"use client";

import { RectangleHorizontalIcon, RectangleVerticalIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Messages } from "@/lib/i18n";
import { ORIENTATIONS, PAPER_SIZES } from "@/lib/validation/schemas";

const PAPER_ORDER = ["a4", "letter", "a5", "legal"] as const;

export function PaperOptionsFields({
  paperSize,
  orientation,
  onPaperSizeChange,
  onOrientationChange,
  t,
}: {
  paperSize: (typeof PAPER_SIZES)[number];
  orientation: (typeof ORIENTATIONS)[number];
  onPaperSizeChange: (value: (typeof PAPER_SIZES)[number]) => void;
  onOrientationChange: (value: (typeof ORIENTATIONS)[number]) => void;
  t: Messages["generateForm"];
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>{t.paperSize}</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={paperSize}
          onValueChange={(v) => v && onPaperSizeChange(v as (typeof PAPER_SIZES)[number])}
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
          onValueChange={(v) => v && onOrientationChange(v as (typeof ORIENTATIONS)[number])}
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
  );
}
