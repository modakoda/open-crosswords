import type { en } from "./en";

export const lt: typeof en = {
  header: {
    nav: {
      generate: "Generuoti",
      admin: "Administravimas",
      client: "Mano dėlionės",
      signIn: "Prisijungti",
    },
    menu: "Meniu",
    source: "Šaltinis",
    sourceAria: "Šaltinis GitHub",
    language: "Kalba",
  },
  footer: {
    tagline: "Open Crosswords — atviro kodo daugiakalbis kryžiažodžių kūrėjas.",
    shareable: "Dėlionės yra viešos ir jomis galima dalintis nuoroda.",
    createdBy: "Sukūrė",
  },
  home: {
    eyebrow: "Kryžiažodžių kūrėjas",
    title: "Generuoti kryžiažodį",
    subtitle:
      "Pasirinkite (nebūtinai) temas. Kiekviena dėlionė sudaroma iš šviežiai " +
      "parinktų, temomis paskirstytų svetainės kalbos užuominų, pritaikyta " +
      "spausdinti ant pasirinkto popieriaus dydžio — arba spręskite internetu " +
      "ir dalinkitės nuoroda.",
    featurePrintable: "Spausdinimui paruošti PDF",
    featureOnline: "Spręskite ir dalinkitės internetu",
    featureMultilingual: "Daugiakalbė užuominų bazė",
  },
  generateForm: {
    formTitle: "Dėlionės nustatymai",
    formDescription: "Pasirinkite temas ir generuokite.",
    categories: "Kategorijos",
    categoriesHint: "Palikite tuščią, kad būtų naudojamos visos temos.",
    clear: "Išvalyti",
    all: "visos",
    noCategories: "Kategorijų nėra",
    paperSize: "Popieriaus dydis",
    orientation: "Orientacija",
    portrait: "Stačias",
    landscape: "Gulsčias",
    difficulty: "Sudėtingumas",
    difficultyHint: "Filtruoja tik parenkamas užuominas, o ne tinklelio formą.",
    difficulties: {
      any: "Bet koks",
      easy: "Lengvas",
      medium: "Vidutinis",
      hard: "Sunkus",
    },
    title: "Pavadinimas (nebūtina)",
    titlePlaceholder: "Penktadienio vakaro kryžiažodis",
    generate: "Generuoti kryžiažodį",
    generating: "Generuojama…",
    generatedToast: "Dėlionė paruošta — atidaroma.",
    noLanguages:
      "Šia kalba užuominų dar nėra. Užpildykite duomenų bazę (npm run seed) " +
      "arba pridėkite įrašų Administravimo skydelyje.",
    loadError: "Nepavyko įkelti užuominų bazės",
    genericError: "Generavimas nepavyko",
    errorNoEntries:
      "Šiam pasirinkimui tinkamų užuominų per mažai. Pasirinkite daugiau temų " +
      "arba platesnį sudėtingumą.",
    errorNoInterlock:
      "Šių užuominų nepavyko sujungti į tinklelį. Pasirinkite daugiau temų " +
      "arba platesnį sudėtingumą.",
    errorRateLimited:
      "Per daug dėlionių per trumpą laiką. Truputį palaukite ir bandykite vėl.",
    errorUnknown: "Kažkas nepavyko. Bandykite dar kartą.",
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
  client: {
    dashboardTitle: "Mano dėlionės",
    dashboardSubtitle: "Dėlionės, kurias sugeneravote būdami prisijungę.",
    empty: "Kol kas nesugeneravote nė vienos dėlionės.",
    generateCta: "Generuoti dėlionę",
    continueSolving: "Tęsti sprendimą",
    signOut: "Atsijungti",
    loginTitle: "Prisijungti",
    loginDescription: "Prisijunkite, kad išsaugotumėte dėliones savo paskyroje.",
    signupTitle: "Sukurti paskyrą",
    signupDescription:
      "Išsaugokite sugeneruotas dėliones ir tęskite sprendimą bet kuriame įrenginyje.",
    name: "Vardas",
    email: "El. paštas",
    password: "Slaptažodis",
    submitLogin: "Prisijungti",
    submitSignup: "Sukurti paskyrą",
    submitting: "Prašome palaukti…",
    errorGeneric: "Kažkas nutiko. Bandykite dar kartą.",
    errorCredentials: "Neteisingas el. paštas arba slaptažodis.",
    errorTooManyAttempts:
      "Per daug nepavykusių bandymų prisijungti. Palaukite kelias minutes ir bandykite dar kartą.",
    haveAccount: "Jau turite paskyrą?",
    noAccount: "Reikia paskyros?",
    switchToSignup: "Registruotis",
    switchToLogin: "Prisijungti",
  },
};
