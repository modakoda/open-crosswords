import type { PuzzleClue } from "@/lib/puzzles";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  clues: PuzzleClue[];
  showAnswers?: boolean;
  activeNumber?: number | null;
  onSelect?: (clue: PuzzleClue) => void;
  hideHeading?: boolean;
  className?: string;
}

export function ClueList({
  title,
  clues,
  showAnswers = false,
  activeNumber = null,
  onSelect,
  hideHeading = false,
  className,
}: Props) {
  return (
    <div className={className}>
      {!hideHeading && (
        <h3 className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      )}
      <ol className="space-y-0.5 text-sm">
        {clues.map((c) => {
          const active = c.number === activeNumber;
          return (
            <li key={`${c.number}-${c.row}-${c.col}`}>
              <button
                type="button"
                onClick={onSelect ? () => onSelect(c) : undefined}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "block w-full rounded-md px-2 py-1 text-left transition-colors",
                  onSelect
                    ? "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    : "cursor-default",
                  active &&
                    "bg-primary/10 font-semibold text-primary hover:bg-primary/10",
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
