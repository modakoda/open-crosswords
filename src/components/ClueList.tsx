import type { PuzzleClue } from "@/lib/puzzles";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  clues: PuzzleClue[];
  showAnswers?: boolean;
  activeNumber?: number | null;
  onSelect?: (clue: PuzzleClue) => void;
}

export function ClueList({
  title,
  clues,
  showAnswers = false,
  activeNumber = null,
  onSelect,
}: Props) {
  return (
    <div>
      <h3 className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ol className="space-y-1 text-sm">
        {clues.map((c) => {
          const active = c.number === activeNumber;
          return (
            <li key={`${c.number}-${c.row}-${c.col}`}>
              <button
                type="button"
                onClick={onSelect ? () => onSelect(c) : undefined}
                className={cn(
                  "text-left",
                  onSelect ? "hover:underline" : "cursor-default",
                  active && "font-semibold text-primary",
                )}
              >
                <span className="mr-1 tabular-nums">{c.number}.</span>
                {c.clue}
                <span className="ml-1 text-muted-foreground">({c.length})</span>
                {showAnswers && (
                  <span className="ml-2 font-mono text-emerald-700 dark:text-emerald-400">
                    {c.answer}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
