export const en = {
  header: {
    nav: { generate: "Generate", admin: "Admin" },
    menu: "Menu",
    source: "Source",
    sourceAria: "Source on GitHub",
  },
  footer: {
    tagline: "Open Crosswords — open-source multilingual crossword builder.",
    shareable: "Puzzles are public and shareable by link.",
  },
  home: {
    title: "Generate a crossword",
    subtitle:
      "Pick a language and (optionally) some topics. Every puzzle is built " +
      "from a fresh, topic-spread selection of clues, sized to print on your " +
      "chosen paper — or solve it online and share the link.",
  },
  generateForm: {
    language: "Language",
    categories: "Categories",
    all: "all",
    noCategories: "No categories",
    paperSize: "Paper size",
    orientation: "Orientation",
    portrait: "Portrait",
    landscape: "Landscape",
    title: "Title (optional)",
    titlePlaceholder: "Friday night crossword",
    generate: "Generate crossword",
    generating: "Generating…",
    noLanguages:
      "No languages yet. Seed the database (npm run seed) or add entries in Admin.",
    loadError: "Could not load languages",
    genericError: "Generation failed",
    paper: { a4: "A4", letter: "US Letter", a5: "A5", legal: "US Legal" },
  },
  clues: {
    across: "Across",
    down: "Down",
  },
  solve: {
    check: "Check",
    revealWord: "Reveal word",
    clear: "Clear",
    printVersion: "Print version",
    solved: "Solved! 🎉",
    hasErrors: "Some letters are wrong or missing.",
    meta: "{width}×{height} · {across} across · {down} down · share this page to let others solve it",
    notFoundTitle: "Puzzle not found",
  },
  print: {
    printSave: "Print / Save as PDF",
    backToSolver: "Back to online solver",
    includeAnswerKey: "Include solved answer key",
    withAnswersNote: "Page 1 is the puzzle, page 2 is the answer key.",
    withoutAnswersNote: "Puzzle only — no answers printed.",
    answerKeySuffix: "Answer key",
  },
};
