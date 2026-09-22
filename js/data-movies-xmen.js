/*
 * Static movie data for the Fox X-Men film series, as a UNIVERSE SEPARATE
 * FROM THE MCU. Contains NO watch progress (that lives in store.js).
 *
 * This file is intentionally kept apart from data-movies.js (window.MCU_MOVIES)
 * rather than appended to it, so existing MCU data, ids and order values are
 * never touched. As of this writing app.js only reads window.MCU_MOVIES into
 * ALL_MOVIES, so these records are not yet wired into any page, the Movies
 * tab, Timeline, Search, Watchlist or the built-in validateData() console
 * check — that wiring (concatenating this array in, and teaching app.js's
 * universe allow-list about "X-Men") is a follow-up step, not part of this
 * batch. See the batch report for details.
 *
 * SCOPE: 13 of the 14 released X-Men theatrical films (the original
 * trilogy, the Wolverine solo films, the First Class prequel era, and
 * Deadpool), as of 2026-09-22. No unreleased titles. The 14th film,
 * "Deadpool & Wolverine" (2024), is INTENTIONALLY NOT included here — see
 * "RESOLVED CONFLICT" below.
 *
 * universe: "X-Men"
 *   A distinct value from "mcu" / "sony" / "fox" used in data-movies.js, per
 *   instruction. NOTE: app.js's validateData() currently only accepts
 *   "mcu" | "sony" | "fox" for a movie's universe — once this file is wired
 *   into ALL_MOVIES, that allow-list needs "X-Men" added too, or every record
 *   here will report as "unknown universe". Flagged here, not fixed here.
 *
 * releaseOrder: this file uses ITS OWN 100-step scale (100..1300), separate
 * from the shared MCU/TV movies+seasons scale documented in data-movies.js.
 * The MCU scale is a single shared timeline specifically so MCU movies and
 * MCU TV seasons can interleave; X-Men is a separate, self-contained
 * universe with no TV seasons to interleave with here, and the earliest
 * X-Men film (2000) predates the earliest MCU film (2008), so folding it
 * into the same numbering would mean renumbering existing MCU/TV values,
 * which this batch must not do. releaseOrder always agrees with
 * releaseDate (theatrical release order).
 *
 * chronologicalOrder: a SEPARATE field for in-universe/story watch order,
 * documented data, NOT computed from releaseDate/releaseOrder. This is NOT
 * a plain "sort by earliest scene" list: X-Men: Days of Future Past (2014)
 * splits the franchise into two distinct, mutually-erasing continuities,
 * and several films (Deadpool, Deadpool 2, The New Mutants) don't have a
 * precise in-story year at all. Rather than force an artificial single
 * timeline, this file gives each film a `timelineBranch` tag documenting
 * which continuity it belongs to, and chronologicalOrder walks the
 * branches in this sequence:
 *   1. "shared"    - X-Men: First Class (1962) and the past (1973) /
 *                    dystopian-future (2023) scenes of Days of Future Past,
 *                    the pivot both branches share.
 *   2. "original"  - the pre-1973 trilogy + Wolverine's solo films, the
 *                    continuity DOFP's time-travel erases: X-Men Origins:
 *                    Wolverine, X-Men, X2, The Last Stand, The Wolverine.
 *   3. "rebooted"  - the continuity that survives after 1973: Apocalypse,
 *                    Dark Phoenix, Deadpool, Deadpool 2, The New Mutants,
 *                    Logan (explicitly set in 2029, the branch's endpoint).
 *   ("crossover" was a 4th branch for "Deadpool & Wolverine" (2024); that
 *   film is not in this file — see "RESOLVED CONFLICT" below — so the tag
 *   isn't used here, but is documented in case a future batch needs it.)
 *   SOURCE: this sequencing is an editorial synthesis (there is no single
 *   agreed-upon "official" X-Men chronological order; most published fan
 *   guides disagree on exactly where Deadpool, Deadpool 2 and The New
 *   Mutants land) built from the widely-documented fact of the DOFP time-
 *   travel split and each film's own stated/implied setting (First Class
 *   is 1962; DOFP is 1973 past / 2023 future; Apocalypse is 1983; Dark
 *   Phoenix is 1992; Logan is 2029). Treat this as a reasonable, documented
 *   judgment call, not a definitive claim - see the batch report for the
 *   specific placements that are most debatable (Deadpool, Deadpool 2, The
 *   New Mutants all have vague, contemporary-to-release settings).
 *
 * phase: this file has no MCU-style production phases, so phase here is an
 * EDITORIAL story-era grouping (documented, not official Fox/Disney terms):
 *   1 = Original Trilogy       (X-Men, X2, The Last Stand)
 *   2 = Wolverine Solo Films   (X-Men Origins: Wolverine, The Wolverine)
 *   3 = First Class Prequels   (First Class, Days of Future Past, Apocalypse,
 *                               Dark Phoenix)
 *   4 = Deadpool & Modern Era  (Deadpool, Deadpool 2, The New Mutants, Logan)
 *   (5 = Multiversal Crossover was reserved for "Deadpool & Wolverine"; not
 *   used here since that film isn't in this file.)
 *
 * importance is an EDITORIAL judgement, not a fact (same scale as
 * data-movies.js: "essential" | "recommended" | "optional").
 *
 * poster: "posters/movies/<id>.webp", per the batch's exact required paths.
 * If the file is missing, the UI shows the fallback card automatically
 * once this data is wired in - see the batch report for which of these 13
 * poster files actually exist on disk right now.
 *
 * RESOLVED CONFLICT - "Deadpool & Wolverine" (2024):
 *   data-movies.js ALREADY has an entry for this exact film - id
 *   "deadpool-and-wolverine", universe "mcu" - because it's a genuine
 *   MCU/X-Men crossover. An earlier version of this file also carried a
 *   second record for it (same id, universe "X-Men"), which created a real
 *   duplicate-id conflict. Per instruction there must be exactly ONE
 *   tracker id for this film, the existing MCU record must not be touched,
 *   and no duplicate movie card should exist - so the X-Men-side record was
 *   REMOVED from this file rather than renamed. The film stays searchable
 *   and trackable purely through its existing MCU record in data-movies.js;
 *   nothing about that record (id, universe, poster, order values, watched
 *   state) changed. No other id in this file was touched or renumbered to
 *   make room for this removal.
 */
window.XMEN_MOVIES = [
  /* ---------------------------------------------------- Original Trilogy */
  { id: "x-men", title: "X-Men", type: "movie", universe: "X-Men",
    releaseDate: "2000-07-14", releaseOrder: 100, chronologicalOrder: 400, phase: 1, importance: "essential",
    timelineBranch: "original",
    description: "Charles Xavier's team of mutants faces Magneto's Brotherhood as a senator pushes to register mutants across America.",
    poster: "posters/movies/x-men.jpg" },

  { id: "x2-x-men-united", title: "X2: X-Men United", type: "movie", universe: "X-Men",
    releaseDate: "2003-05-02", releaseOrder: 200, chronologicalOrder: 500, phase: 1, importance: "essential",
    timelineBranch: "original",
    description: "A military strike on Xavier's school forces the X-Men and Magneto's Brotherhood into an uneasy alliance against a common enemy.",
    poster: "posters/movies/x2-x-men-united.jpg" },

  { id: "x-men-the-last-stand", title: "X-Men: The Last Stand", type: "movie", universe: "X-Men",
    releaseDate: "2006-05-26", releaseOrder: 300, chronologicalOrder: 600, phase: 1, importance: "recommended",
    timelineBranch: "original",
    description: "A 'cure' for mutation divides the X-Men just as a resurrected Jean Grey, consumed by the Phoenix, becomes an uncontrollable threat.",
    poster: "posters/movies/x-men-the-last-stand.jpg" },

  /* ------------------------------------------------ Wolverine Solo Films */
  { id: "x-men-origins-wolverine", title: "X-Men Origins: Wolverine", type: "movie", universe: "X-Men",
    releaseDate: "2009-05-01", releaseOrder: 400, chronologicalOrder: 300, phase: 2, importance: "optional",
    timelineBranch: "original",
    description: "Logan's backstory, from his early years with brother Victor Creed through the Weapon X program that gives him his adamantium claws.",
    poster: "posters/movies/x-men-origins-wolverine.jpg" },

  { id: "the-wolverine", title: "The Wolverine", type: "movie", universe: "X-Men",
    releaseDate: "2013-07-26", releaseOrder: 600, chronologicalOrder: 700, phase: 2, importance: "recommended",
    timelineBranch: "original",
    description: "A grief-stricken Logan travels to Japan, where an old friend's dying wish draws him into a family power struggle and strips away his healing factor.",
    poster: "posters/movies/the-wolverine.jpg" },

  /* ------------------------------------------------- First Class Prequels */
  { id: "x-men-first-class", title: "X-Men: First Class", type: "movie", universe: "X-Men",
    releaseDate: "2011-06-03", releaseOrder: 500, chronologicalOrder: 100, phase: 3, importance: "essential",
    timelineBranch: "shared",
    description: "In 1962, young Charles Xavier and Erik Lehnsherr form the first class of X-Men to stop a Cold War plot that could trigger nuclear war.",
    poster: "posters/movies/x-men-first-class.jpg" },

  { id: "x-men-days-of-future-past", title: "X-Men: Days of Future Past", type: "movie", universe: "X-Men",
    releaseDate: "2014-05-23", releaseOrder: 700, chronologicalOrder: 200, phase: 3, importance: "essential",
    timelineBranch: "shared",
    description: "In a dystopian future where Sentinels have nearly wiped out mutants, Wolverine's mind is sent back to 1973 to change history and prevent it.",
    poster: "posters/movies/x-men-days-of-future-past.webp" },

  { id: "x-men-apocalypse", title: "X-Men: Apocalypse", type: "movie", universe: "X-Men",
    releaseDate: "2016-05-27", releaseOrder: 900, chronologicalOrder: 800, phase: 3, importance: "recommended",
    timelineBranch: "rebooted",
    description: "In 1983, the first and most powerful mutant, Apocalypse, awakens and recruits four horsemen to remake the world.",
    poster: "posters/movies/x-men-apocalypse.webp" },

  { id: "dark-phoenix", title: "Dark Phoenix", type: "movie", universe: "X-Men",
    releaseDate: "2019-06-07", releaseOrder: 1200, chronologicalOrder: 900, phase: 3, importance: "optional",
    timelineBranch: "rebooted",
    description: "In 1992, a cosmic accident transforms Jean Grey into an unstable, immensely powerful being, tearing the X-Men apart from within.",
    poster: "posters/movies/x-men-dark-phoenix.webp" },

  /* --------------------------------------------- Deadpool & Modern Era */
  { id: "deadpool", title: "Deadpool", type: "movie", universe: "X-Men",
    releaseDate: "2016-02-12", releaseOrder: 800, chronologicalOrder: 1000, phase: 4, importance: "essential",
    timelineBranch: "rebooted",
    description: "Mercenary Wade Wilson, disfigured by an experiment that gives him accelerated healing, becomes the foul-mouthed antihero Deadpool to hunt down the man who ruined his life.",
    poster: "posters/movies/deadpool.webp" },

  { id: "logan", title: "Logan", type: "movie", universe: "X-Men",
    releaseDate: "2017-03-03", releaseOrder: 1000, chronologicalOrder: 1300, phase: 4, importance: "essential",
    timelineBranch: "rebooted",
    description: "In 2029, an aging Logan and an ailing Professor X protect a young mutant girl with a familiar power from a shadowy corporation.",
    poster: "posters/movies/logan.webp" },

  { id: "deadpool-2", title: "Deadpool 2", type: "movie", universe: "X-Men",
    releaseDate: "2018-05-18", releaseOrder: 1100, chronologicalOrder: 1100, phase: 4, importance: "recommended",
    timelineBranch: "rebooted",
    description: "Deadpool assembles a team of mutants to protect a troubled young mutant from Cable, a time-traveling soldier from the future.",
    poster: "posters/movies/deadpool-2.webp" },

  { id: "the-new-mutants", title: "The New Mutants", type: "movie", universe: "X-Men",
    releaseDate: "2020-08-28", releaseOrder: 1300, chronologicalOrder: 1200, phase: 4, importance: "optional",
    timelineBranch: "rebooted",
    description: "Five young mutants, institutionalized for evaluation, discover their dark, monstrous abilities while trying to escape a mysterious facility.",
    poster: "posters/movies/the-new-mutants.jpeg" }

  /* "Deadpool & Wolverine" (2024) is intentionally NOT here - it stays
     tracked solely under its existing MCU record (id "deadpool-and-wolverine"
     in data-movies.js). See "RESOLVED CONFLICT" in the file header. */
];
