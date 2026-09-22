/*
 * Static TV data. Contains NO watch progress (that lives in store.js).
 *
 * STARTER SAMPLE ONLY: 7 shows, not the full database. The posters/tv folder
 * has many more poster files than are listed here -- that does NOT mean
 * those shows are MCU canon or ready to add. Do not infer a show's
 * universe/category from the presence of a poster file; only add a show
 * once its own record (universe, category, phase, seasons) is established.
 *
 * Structure: Show -> Seasons -> Episodes.
 *   - Every show and every season has an explicit, stable "id". IDs are
 *     never derived from array position or computed on the fly in app.js.
 *       show id:    "<show-id>"                e.g. "loki"
 *       season id:  "<show-id>-s<number>"      e.g. "loki-s1", "loki-s2"
 *       episode id: "<season-id>-e<number>"    e.g. "loki-s2-e1"
 *   - "phase" lives on each SEASON, not the show, because a show can span
 *     more than one MCU phase (Loki S1 is Phase 4, Loki S2 is Phase 5). Any
 *     code that needs "the show's phase" should derive it from a season
 *     (e.g. the earliest season), never read a phase off the show itself.
 *   - episodes is intentionally [] for every season right now: there are no
 *     reliable per-episode titles/dates in the project yet, so none are
 *     invented. The app shows those seasons as "Episode data unavailable" and
 *     never fakes progress for them. episodeCount is the real episode total
 *     for the season, kept even while episodes is empty.
 *
 * EPISODE RECORD (fill in one season at a time; add every episode of a season):
 *     { id: "<season-id>-e<episode>", episode: <number>, title: "<real title>",
 *       releaseDate: "YYYY-MM-DD", releaseOrder: <number> }
 *   - id must be exactly "<season id>-e<episode number>" (e.g. "loki-s2-e1").
 *     It is the key saved in localStorage (Store "episodes"), so never change
 *     an id once someone has watched it.
 *   - releaseOrder is only compared with the other episodes of the SAME season
 *     (it is not on the movie/season scale). Use 1, 2, 3... in release order.
 *   - optional chronologicalOrder: only add it if EVERY episode of the season
 *     has one; otherwise the Chronological Order view uses episode number.
 *   - a season that lists fewer episodes than episodeCount counts as
 *     incomplete: it can never show as complete until all of them are listed.
 *
 * releaseOrder is on the SAME shared scale as data-movies.js (steps of 100
 * for movies; TV seasons use the open space between them), so movies and TV
 * seasons can be interleaved in true release order later. A show's position
 * in the grid comes from its earliest season.
 *
 * chronologicalOrder is on each SEASON (same reason as phase: a show's seasons
 * can sit far apart on the timeline; Loki S1 is right after Endgame, Loki S2 is
 * after The Marvels). It is the season's position in Marvel's official "MCU
 * Complete Timeline" x 100, on the same scale and from the same source as
 * data-movies.js (see the note there), so movies and seasons interleave. It is
 * separate from releaseOrder and is never computed from release dates.
 *
 * show.poster is the season 1 poster. A season may set its own poster, used on
 * the show page and on the chronological season cards. A later season with no
 * poster of its own shows a "Poster not added yet" placeholder on the show page.
 *
 * universe: "mcu" | "sony" | "fox" (same meaning as in data-movies.js)
 * category: "series" | "animation" | "special" | "documentary"
 */
window.MCU_TV = [
  { id: "wandavision", title: "WandaVision", type: "tv", universe: "mcu", category: "series",
    importance: "essential", poster: "posters/tv/wandavision-s1.webp",
    description: "Wanda and Vision appear to be living an idealized suburban life, but something is off.",
    seasons: [
      { id: "wandavision-s1", season: 1, phase: 4, releaseDate: "2021-01-15", releaseOrder: 2320, chronologicalOrder: 4800,
        episodeCount: 9, episodes: [
          { id: "wandavision-s1-e1", episode: 1, title: "Filmed Before a Live Studio Audience", releaseDate: "2021-01-15", releaseOrder: 1 },
          { id: "wandavision-s1-e2", episode: 2, title: "Don't Touch That Dial", releaseDate: "2021-01-15", releaseOrder: 2 },
          { id: "wandavision-s1-e3", episode: 3, title: "Now in Color", releaseDate: "2021-01-22", releaseOrder: 3 },
          { id: "wandavision-s1-e4", episode: 4, title: "We Interrupt This Program", releaseDate: "2021-01-29", releaseOrder: 4 },
          { id: "wandavision-s1-e5", episode: 5, title: "On a Very Special Episode...", releaseDate: "2021-02-05", releaseOrder: 5 },
          { id: "wandavision-s1-e6", episode: 6, title: "All-New Halloween Spooktacular!", releaseDate: "2021-02-12", releaseOrder: 6 },
          { id: "wandavision-s1-e7", episode: 7, title: "Breaking the Fourth Wall", releaseDate: "2021-02-19", releaseOrder: 7 },
          { id: "wandavision-s1-e8", episode: 8, title: "Previously On", releaseDate: "2021-02-26", releaseOrder: 8 },
          { id: "wandavision-s1-e9", episode: 9, title: "The Series Finale", releaseDate: "2021-03-05", releaseOrder: 9 }
        ] }
    ] },

  { id: "the-falcon-and-the-winter-soldier", title: "The Falcon and the Winter Soldier", type: "tv", universe: "mcu", category: "series",
    importance: "recommended", poster: "posters/tv/the-falcon-and-the-winter-soldier-s1.webp",
    description: "Sam Wilson and Bucky Barnes team up to face a global threat and the legacy of the shield.",
    seasons: [
      { id: "the-falcon-and-the-winter-soldier-s1", season: 1, phase: 4, releaseDate: "2021-03-19", releaseOrder: 2340, chronologicalOrder: 5000,
        episodeCount: 6, episodes: [
          { id: "the-falcon-and-the-winter-soldier-s1-e1", episode: 1, title: "New World Order", releaseDate: "2021-03-19", releaseOrder: 1 },
          { id: "the-falcon-and-the-winter-soldier-s1-e2", episode: 2, title: "The Star-Spangled Man", releaseDate: "2021-03-26", releaseOrder: 2 },
          { id: "the-falcon-and-the-winter-soldier-s1-e3", episode: 3, title: "Power Broker", releaseDate: "2021-04-02", releaseOrder: 3 },
          { id: "the-falcon-and-the-winter-soldier-s1-e4", episode: 4, title: "The Whole World Is Watching", releaseDate: "2021-04-09", releaseOrder: 4 },
          { id: "the-falcon-and-the-winter-soldier-s1-e5", episode: 5, title: "Truth", releaseDate: "2021-04-16", releaseOrder: 5 },
          { id: "the-falcon-and-the-winter-soldier-s1-e6", episode: 6, title: "One World, One People", releaseDate: "2021-04-23", releaseOrder: 6 }
        ] }
    ] },

  { id: "loki", title: "Loki", type: "tv", universe: "mcu", category: "series",
    importance: "essential", poster: "posters/tv/loki-s1.webp",
    description: "Loki is pulled out of time by the Time Variance Authority and forced to answer for his crimes.",
    seasons: [
      { id: "loki-s1", season: 1, phase: 4, releaseDate: "2021-06-09", releaseOrder: 2360, chronologicalOrder: 4500,
        episodeCount: 6, episodes: [
          { id: "loki-s1-e1", episode: 1, title: "Glorious Purpose", releaseDate: "2021-06-09", releaseOrder: 1 },
          { id: "loki-s1-e2", episode: 2, title: "The Variant", releaseDate: "2021-06-16", releaseOrder: 2 },
          { id: "loki-s1-e3", episode: 3, title: "Lamentis", releaseDate: "2021-06-23", releaseOrder: 3 },
          { id: "loki-s1-e4", episode: 4, title: "The Nexus Event", releaseDate: "2021-06-30", releaseOrder: 4 },
          { id: "loki-s1-e5", episode: 5, title: "Journey Into Mystery", releaseDate: "2021-07-07", releaseOrder: 5 },
          { id: "loki-s1-e6", episode: 6, title: "For All Time. Always.", releaseDate: "2021-07-14", releaseOrder: 6 }
        ] },
      { id: "loki-s2", season: 2, phase: 5, releaseDate: "2023-10-05", releaseOrder: 3250, chronologicalOrder: 6900,
        episodeCount: 6, episodes: [
          { id: "loki-s2-e1", episode: 1, title: "Ouroboros", releaseDate: "2023-10-05", releaseOrder: 1 },
          { id: "loki-s2-e2", episode: 2, title: "Breaking Brad", releaseDate: "2023-10-12", releaseOrder: 2 },
          { id: "loki-s2-e3", episode: 3, title: "1893", releaseDate: "2023-10-19", releaseOrder: 3 },
          { id: "loki-s2-e4", episode: 4, title: "Heart of the TVA", releaseDate: "2023-10-26", releaseOrder: 4 },
          { id: "loki-s2-e5", episode: 5, title: "Science/Fiction", releaseDate: "2023-11-02", releaseOrder: 5 },
          { id: "loki-s2-e6", episode: 6, title: "Glorious Purpose", releaseDate: "2023-11-09", releaseOrder: 6 }
        ], poster: "posters/tv/loki-s2.webp" }
    ] },

  { id: "hawkeye", title: "Hawkeye", type: "tv", universe: "mcu", category: "series",
    importance: "optional", poster: "posters/tv/hawkeye-s1.webp",
    description: "Clint Barton teams up with a young archer to settle unfinished business before the holidays.",
    seasons: [
      { id: "hawkeye-s1", season: 1, phase: 4, releaseDate: "2021-11-24", releaseOrder: 2650, chronologicalOrder: 5500,
        episodeCount: 6, episodes: [
          { id: "hawkeye-s1-e1", episode: 1, title: "Never Meet Your Heroes", releaseDate: "2021-11-24", releaseOrder: 1 },
          { id: "hawkeye-s1-e2", episode: 2, title: "Hide and Seek", releaseDate: "2021-11-24", releaseOrder: 2 },
          { id: "hawkeye-s1-e3", episode: 3, title: "Echoes", releaseDate: "2021-12-01", releaseOrder: 3 },
          { id: "hawkeye-s1-e4", episode: 4, title: "Partners, Am I Right?", releaseDate: "2021-12-08", releaseOrder: 4 },
          { id: "hawkeye-s1-e5", episode: 5, title: "Ronin", releaseDate: "2021-12-15", releaseOrder: 5 },
          { id: "hawkeye-s1-e6", episode: 6, title: "So This Is Christmas?", releaseDate: "2021-12-22", releaseOrder: 6 }
        ] }
    ] },

  { id: "moon-knight", title: "Moon Knight", type: "tv", universe: "mcu", category: "series",
    importance: "optional", poster: "posters/tv/moon-knight-s1.webp",
    description: "Steven Grant discovers he shares his body with a mercenary tied to an Egyptian moon god.",
    seasons: [
      { id: "moon-knight-s1", season: 1, phase: 4, releaseDate: "2022-03-30", releaseOrder: 2750, chronologicalOrder: 5600,
        episodeCount: 6, episodes: [
          { id: "moon-knight-s1-e1", episode: 1, title: "The Goldfish Problem", releaseDate: "2022-03-30", releaseOrder: 1 },
          { id: "moon-knight-s1-e2", episode: 2, title: "Summon the Suit", releaseDate: "2022-04-06", releaseOrder: 2 },
          { id: "moon-knight-s1-e3", episode: 3, title: "The Friendly Type", releaseDate: "2022-04-13", releaseOrder: 3 },
          { id: "moon-knight-s1-e4", episode: 4, title: "The Tomb", releaseDate: "2022-04-20", releaseOrder: 4 },
          { id: "moon-knight-s1-e5", episode: 5, title: "Asylum", releaseDate: "2022-04-27", releaseOrder: 5 },
          { id: "moon-knight-s1-e6", episode: 6, title: "Gods and Monsters", releaseDate: "2022-05-04", releaseOrder: 6 }
        ] }
    ] },

  { id: "agatha-all-along", title: "Agatha All Along", type: "tv", universe: "mcu", category: "series",
    importance: "optional", poster: "posters/tv/agatha-all-along-s1.webp",
    description: "Agatha Harkness regains her power by walking a dangerous road with a coven of new allies.",
    seasons: [
      { id: "agatha-all-along-s1", season: 1, phase: 5, releaseDate: "2024-09-18", releaseOrder: 3450, chronologicalOrder: 7200,
        episodeCount: 9, episodes: [
          { id: "agatha-all-along-s1-e1", episode: 1, title: "Seekest Thou the Road", releaseDate: "2024-09-18", releaseOrder: 1 },
          { id: "agatha-all-along-s1-e2", episode: 2, title: "Circle Sewn with Fate / Unlock Thy Hidden Gate", releaseDate: "2024-09-18", releaseOrder: 2 },
          { id: "agatha-all-along-s1-e3", episode: 3, title: "Through Many Miles / Of Tricks and Trials", releaseDate: "2024-09-25", releaseOrder: 3 },
          { id: "agatha-all-along-s1-e4", episode: 4, title: "If I Can't Reach You / Let My Song Teach You", releaseDate: "2024-10-02", releaseOrder: 4 },
          { id: "agatha-all-along-s1-e5", episode: 5, title: "Darkest Hour / Wake Thy Power", releaseDate: "2024-10-09", releaseOrder: 5 },
          { id: "agatha-all-along-s1-e6", episode: 6, title: "Familiar by Thy Side", releaseDate: "2024-10-16", releaseOrder: 6 },
          { id: "agatha-all-along-s1-e7", episode: 7, title: "Death's Hand in Mine", releaseDate: "2024-10-23", releaseOrder: 7 },
          { id: "agatha-all-along-s1-e8", episode: 8, title: "Follow Me My Friend to Glory at the End", releaseDate: "2024-10-30", releaseOrder: 8 },
          { id: "agatha-all-along-s1-e9", episode: 9, title: "Maiden Mother Crone", releaseDate: "2024-10-30", releaseOrder: 9 }
        ] }
    ] },

  { id: "daredevil-born-again", title: "Daredevil: Born Again", type: "tv", universe: "mcu", category: "series",
    importance: "recommended", poster: "posters/tv/daredevil-born-again-s1.webp",
    description: "Matt Murdock and Wilson Fisk clash again as Fisk's political ambitions take hold of New York.",
    seasons: [
      { id: "daredevil-born-again-s1", season: 1, phase: 5, releaseDate: "2025-03-04", releaseOrder: 3550, chronologicalOrder: 7400,
        episodeCount: 9, episodes: [
          { id: "daredevil-born-again-s1-e1", episode: 1, title: "Heaven's Half Hour", releaseDate: "2025-03-04", releaseOrder: 1 },
          { id: "daredevil-born-again-s1-e2", episode: 2, title: "Optics", releaseDate: "2025-03-04", releaseOrder: 2 },
          { id: "daredevil-born-again-s1-e3", episode: 3, title: "The Hollow of His Hand", releaseDate: "2025-03-11", releaseOrder: 3 },
          { id: "daredevil-born-again-s1-e4", episode: 4, title: "Sic Semper Systema", releaseDate: "2025-03-18", releaseOrder: 4 },
          { id: "daredevil-born-again-s1-e5", episode: 5, title: "With Interest", releaseDate: "2025-03-25", releaseOrder: 5 },
          { id: "daredevil-born-again-s1-e6", episode: 6, title: "Excessive Force", releaseDate: "2025-03-25", releaseOrder: 6 },
          { id: "daredevil-born-again-s1-e7", episode: 7, title: "Art for Art's Sake", releaseDate: "2025-04-01", releaseOrder: 7 },
          { id: "daredevil-born-again-s1-e8", episode: 8, title: "Isle of Joy", releaseDate: "2025-04-08", releaseOrder: 8 },
          { id: "daredevil-born-again-s1-e9", episode: 9, title: "Straight to Hell", releaseDate: "2025-04-15", releaseOrder: 9 }
        ] }
    ] }
];
