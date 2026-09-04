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
    eyebrow: "Kryžiažodžių kūrėjas",
    title: "Generuoti kryžiažodį",
    subtitle:
      "Pasirinkite kalbą ir (nebūtinai) temas. Kiekviena dėlionė sudaroma iš " +
      "šviežiai parinktų, temomis paskirstytų užuominų, pritaikyta spausdinti " +
      "ant pasirinkto popieriaus dydžio — arba spręskite internetu ir " +
      "dalinkitės nuoroda.",
    featurePrintable: "Spausdinimui paruošti PDF",
    featureOnline: "Spręskite ir dalinkitės internetu",
    featureMultilingual: "Daugiakalbė užuominų bazė",
  },
  generateForm: {
    formTitle: "Dėlionės nustatymai",
    formDescription: "Pasirinkite kalbą ir temas, tada generuokite.",
    language: "Kalba",
    categories: "Kategorijos",
    categoriesHint: "Palikite tuščią, kad būtų naudojamos visos temos.",
    clear: "Išvalyti",
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
    generatedToast: "Dėlionė paruošta — atidaroma.",
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
    solvedNote: "Visos raidės teisingos. Puikus darbas.",
    hasErrors: "Kai kurios raidės neteisingos arba trūksta.",
    meta: "{width}×{height} · {across} horizontaliai · {down} vertikaliai · pasidalinkite šiuo puslapiu, kad kiti galėtų spręsti",
    notFoundTitle: "Dėlionė nerasta",
    progressLabel: "Progresas",
    cellsFilled: "{filled} / {total} langelių",
    toolbar: "Įrankiai",
    share: "Dalintis",
    shareTitle: "Dalintis šia dėlione",
    shareDescription:
      "Bet kas su šia nuoroda gali spręsti tą patį tinklelį internetu.",
    copyLink: "Kopijuoti nuorodą",
    linkCopied: "Nuoroda nukopijuota",
    reset: "Iš naujo",
    resetTitle: "Išvalyti visus atsakymus?",
    resetDescription:
      "Bus pašalintos visos šiame įrenginyje įvestos raidės. To atšaukti negalima.",
    resetConfirm: "Išvalyti tinklelį",
    cancel: "Atšaukti",
    keyboardHint:
      "Rodyklės juda · Tarpas keičia kryptį · Naikinimo klavišas trina",
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
