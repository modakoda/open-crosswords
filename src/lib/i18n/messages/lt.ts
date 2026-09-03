import type { en } from "./en";

export const lt: typeof en = {
  header: {
    nav: { generate: "Generuoti", admin: "Administravimas" },
    menu: "Meniu",
    source: "Šaltinis",
    sourceAria: "Šaltinis GitHub",
  },
  footer: {
    tagline: "Open Crosswords — atviro kodo daugiakalbis kryžiažodžių kūrėjas.",
    shareable: "Dėlionės yra viešos ir jomis galima dalintis nuoroda.",
  },
  home: {
    title: "Generuoti kryžiažodį",
    subtitle:
      "Pasirinkite kalbą ir (nebūtinai) temas. Kiekviena dėlionė sudaroma iš " +
      "šviežiai parinktų, temomis paskirstytų užuominų, pritaikyta spausdinti " +
      "ant pasirinkto popieriaus dydžio — arba spręskite internetu ir " +
      "dalinkitės nuoroda.",
  },
  generateForm: {
    language: "Kalba",
    categories: "Kategorijos",
    all: "visos",
    noCategories: "Kategorijų nėra",
    paperSize: "Popieriaus dydis",
    orientation: "Orientacija",
    portrait: "Stačias",
    landscape: "Gulsčias",
    title: "Pavadinimas (nebūtina)",
    titlePlaceholder: "Penktadienio vakaro kryžiažodis",
    generate: "Generuoti kryžiažodį",
    generating: "Generuojama…",
    noLanguages:
      "Kalbų dar nėra. Užpildykite duomenų bazę (npm run seed) arba pridėkite įrašų Administravimo skydelyje.",
    loadError: "Nepavyko įkelti kalbų",
    genericError: "Generavimas nepavyko",
    paper: { a4: "A4", letter: "JAV Letter", a5: "A5", legal: "JAV Legal" },
  },
  clues: {
    across: "Horizontaliai",
    down: "Vertikaliai",
  },
  solve: {
    check: "Tikrinti",
    revealWord: "Atskleisti žodį",
    clear: "Išvalyti",
    printVersion: "Spausdinimo versija",
    solved: "Išspręsta! 🎉",
    hasErrors: "Kai kurios raidės neteisingos arba trūksta.",
    meta: "{width}×{height} · {across} horizontaliai · {down} vertikaliai · pasidalinkite šiuo puslapiu, kad kiti galėtų spręsti",
    notFoundTitle: "Dėlionė nerasta",
  },
  print: {
    printSave: "Spausdinti / Išsaugoti kaip PDF",
    backToSolver: "Grįžti į sprendimą internetu",
    includeAnswerKey: "Įtraukti atsakymų raktą",
    withAnswersNote: "1 puslapis — dėlionė, 2 puslapis — atsakymų raktas.",
    withoutAnswersNote: "Tik dėlionė — atsakymai nespausdinami.",
    answerKeySuffix: "Atsakymų raktas",
  },
};
