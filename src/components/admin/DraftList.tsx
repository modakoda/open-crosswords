"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export interface Draft {
  clue: string;
  answer: string;
  difficulty: number;
}

export function DraftList({
  drafts,
  keep,
  onKeepChange,
  busy,
  onSave,
}: {
  drafts: Draft[];
  keep: Set<number>;
  onKeepChange: (next: Set<number>) => void;
  busy: boolean;
  onSave: () => void;
}) {
  const allKept = drafts.length > 0 && keep.size === drafts.length;

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-3 px-3 py-2">
        <Checkbox
          checked={allKept}
          onCheckedChange={(c) => onKeepChange(c ? new Set(drafts.map((_, i) => i)) : new Set())}
          aria-label="Select all drafts"
        />
        <span className="text-sm font-medium">Drafts</span>
        <Badge variant="secondary" className="tabular-nums">
          {keep.size} / {drafts.length}
        </Badge>
      </div>
      <Separator />
      <ul className="divide-y divide-border">
        {drafts.map((d, i) => (
          <li key={i}>
            <Label className="flex items-start gap-3 px-3 py-2.5 font-normal hover:bg-muted/40">
              <Checkbox
                className="mt-0.5"
                checked={keep.has(i)}
                onCheckedChange={(checked) => {
                  const next = new Set(keep);
                  if (checked) next.add(i);
                  else next.delete(i);
                  onKeepChange(next);
                }}
              />
              <span className="text-sm">
                <strong className="font-mono">{d.answer}</strong>
                <span className="mx-1 text-muted-foreground">·</span>
                {d.clue}
                <Badge variant="outline" className="ml-2 font-normal">
                  d{d.difficulty}
                </Badge>
              </span>
            </Label>
          </li>
        ))}
      </ul>
      <Separator />
      <div className="px-3 py-2">
        <Button onClick={onSave} disabled={busy || keep.size === 0}>
          Save {keep.size} selected
        </Button>
      </div>
    </div>
  );
}
