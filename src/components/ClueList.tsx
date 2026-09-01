import type { PuzzleClue } from "@/lib/puzzles";

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
      <h3 className="mb-1 font-semibold uppercase tracking-wide text-slate-700">
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
                className={`text-left ${onSelect ? "hover:underline" : "cursor-default"} ${
                  active ? "font-semibold text-amber-700" : ""
                }`}
              >
                <span className="mr-1 tabular-nums">{c.number}.</span>
                {c.clue}
                <span className="ml-1 text-slate-400">({c.length})</span>
                {showAnswers && (
                  <span className="ml-2 font-mono text-emerald-700">
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
