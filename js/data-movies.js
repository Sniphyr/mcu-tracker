/*
 * Static movie data. Contains NO watch progress (that lives in store.js).
 *
 * SCOPE: every MCU film released in theaters, as of 2026-09-20 (38 films).
 * Unreleased titles (Avengers: Doomsday, Avengers: Secret Wars, etc.) are
 * intentionally NOT included yet.
 *
 * SOURCES: release dates are U.S. theatrical release dates and phases are
 * Marvel Studios' own phase groupings, taken from Wikipedia's "List of Marvel
 * Cinematic Universe films". Spider-Man: Brand New Day (July 31, 2026, Phase 6)
 * was cross-checked against Variety, Deadline and CNBC coverage of its release.
 *
 * universe: "mcu" | "sony" | "fox"
 *   The Spider-Man films co-produced with Marvel Studios (Homecoming, Far From
 *   Home, No Way Home, Brand New Day) are set in the MCU, so they are "mcu"
 *   even though Sony distributes them. Non-MCU Sony/Fox films are NOT in this
 *   file. If they are added later, use "sony" / "fox": app.js keeps them out
 *   of the MCU list, progress and Next Up.
 *
 * releaseOrder is the source of truth for RELEASE ordering (never array
 * position). ONE shared scale for movies and TV seasons, in steps of 100, so
 * anything can be slotted in later without renumbering. releaseDate must agree
 * with releaseOrder; app.js warns in the console if it ever doesn't.
 *
 * chronologicalOrder is a SEPARATE field for the in-universe "timeline" watch
 * order. It is documented data, NOT computed from releaseDate/releaseOrder and
 * it must never be edited to "match" them; the two orders differ on purpose
 * (Captain America: The First Avenger is 5th to release but 1st in-universe).
 * app.js reads whichever field the WATCH ORDER selector points at.
 *   SOURCE: Marvel's own "MCU Complete Timeline" (the Disney+ timeline, with
 *   TV broken out by season), published on Marvel.com on June 2, 2026:
 *   https://www.marvel.com/articles/movies/mcu-timeline-order-disney-plus
 *   SCALE: value = that title's position in Marvel's list x 100. Marvel's list
 *   also holds titles this tracker doesn't carry (One-Shots, Netflix series,
 *   Eternals-era specials, etc.); those keep their slots, so adding them later
 *   never needs a renumber. Same scale and same source in data-tv.js, so
 *   movies and TV seasons interleave correctly.
 *   EXCEPTIONS (judgment calls, documented so they are not "fixed" by accident):
 *   - Spider-Man: Brand New Day (8100) is NOT in Marvel's June 2 list (it
 *     released July 31, 2026, after the list). It is set about four years after
 *     No Way Home, which makes it the latest-set title in this tracker, so it
 *     takes the slot after the last entry on Marvel's list. Cross-checked
 *     against GamesRadar's timeline guide (updated Sept 9, 2026) and Rotten
 *     Tomatoes' chronological guide; both place it last.
 *   - The Fantastic Four: First Steps is set on a different Earth (Earth-828)
 *     in a 1960s-style world, so it has no true position in the main timeline.
 *     Marvel's list puts it after Thunderbolts*, and this file follows Marvel.
 *     Some third-party guides place it in the 1960s instead.
 *   - Marvel's list, not third-party fan orders, decides every other position
 *     (e.g. Deadpool & Wolverine sits after Loki S2, not right after Endgame).
 *
 * importance is an EDITORIAL judgement, not a fact:
 *   "essential"   = part of the main storyline spine; hard to follow the big
 *                   crossovers without it
 *   "recommended" = adds real context or character weight, but skippable
 *   "optional"    = mostly standalone; safe to skip
 *
 * poster: always "posters/movies/<id>.webp". If the file is missing the UI
 * shows the fallback card automatically.
 */
window.MCU_MOVIES = [
  /* ---------------------------------------------------------- Phase 1 */
  { id: "iron-man", title: "Iron Man", type: "movie", universe: "mcu",
    releaseDate: "2008-05-02", releaseOrder: 100, chronologicalOrder: 500, phase: 1, importance: "essential",
    description: "Billionaire engineer Tony Stark builds a powered suit to escape captivity and reinvents himself as a hero.",
    poster: "posters/movies/iron-man.webp" },

  { id: "the-incredible-hulk", title: "The Incredible Hulk", type: "movie", universe: "mcu",
    releaseDate: "2008-06-13", releaseOrder: 200, chronologicalOrder: 700, phase: 1, importance: "optional",
    description: "Scientist Bruce Banner hunts for a cure while the military chases the monster he becomes.",
    poster: "posters/movies/the-incredible-hulk.webp" },

  { id: "iron-man-2", title: "Iron Man 2", type: "movie", universe: "mcu",
    releaseDate: "2010-05-07", releaseOrder: 300, chronologicalOrder: 600, phase: 1, importance: "recommended",
    description: "Tony Stark resists government demands for his armor while a vengeful engineer and a business rival close in.",
    poster: "posters/movies/iron-man-2.webp" },

  { id: "thor", title: "Thor", type: "movie", universe: "mcu",
    releaseDate: "2011-05-06", releaseOrder: 400, chronologicalOrder: 900, phase: 1, importance: "essential",
    description: "The arrogant Thor is banished to Earth without his powers and must prove himself worthy of his hammer.",
    poster: "posters/movies/thor.webp" },

  { id: "captain-america-the-first-avenger", title: "Captain America: The First Avenger", type: "movie", universe: "mcu",
    releaseDate: "2011-07-22", releaseOrder: 500, chronologicalOrder: 200, phase: 1, importance: "essential",
    description: "Frail Steve Rogers becomes a super-soldier and takes the fight to a Nazi science division in World War II.",
    poster: "posters/movies/captain-america-the-first-avenger.webp" },

  { id: "the-avengers", title: "The Avengers", type: "movie", universe: "mcu",
    releaseDate: "2012-05-04", releaseOrder: 600, chronologicalOrder: 1100, phase: 1, importance: "essential",
    description: "Earth's mightiest heroes are forced to unite when Loki leads an alien invasion of New York.",
    poster: "posters/movies/the-avengers.webp" },

  /* ---------------------------------------------------------- Phase 2 */
  { id: "iron-man-3", title: "Iron Man 3", type: "movie", universe: "mcu",
    releaseDate: "2013-05-03", releaseOrder: 700, chronologicalOrder: 1400, phase: 2, importance: "recommended",
    description: "A shaken Tony Stark is drawn into a fight with a mysterious terrorist known as the Mandarin.",
    poster: "posters/movies/iron-man-3.webp" },

  { id: "thor-the-dark-world", title: "Thor: The Dark World", type: "movie", universe: "mcu",
    releaseDate: "2013-11-08", releaseOrder: 800, chronologicalOrder: 1300, phase: 2, importance: "optional",
    description: "Thor faces an ancient enemy who threatens the Nine Realms and turns to Loki for help.",
    poster: "posters/movies/thor-the-dark-world.webp" },

  { id: "captain-america-the-winter-soldier", title: "Captain America: The Winter Soldier", type: "movie", universe: "mcu",
    releaseDate: "2014-04-04", releaseOrder: 900, chronologicalOrder: 1600, phase: 2, importance: "essential",
    description: "Steve Rogers uncovers a conspiracy inside S.H.I.E.L.D. while hunted by a mysterious assassin.",
    poster: "posters/movies/captain-america-the-winter-soldier.webp" },

  { id: "guardians-of-the-galaxy", title: "Guardians of the Galaxy", type: "movie", universe: "mcu",
    releaseDate: "2014-08-01", releaseOrder: 1000, chronologicalOrder: 1700, phase: 2, importance: "recommended",
    description: "A band of misfit outlaws in space fight to keep a powerful artifact out of the wrong hands.",
    poster: "posters/movies/guardians-of-the-galaxy.webp" },

  { id: "avengers-age-of-ultron", title: "Avengers: Age of Ultron", type: "movie", universe: "mcu",
    releaseDate: "2015-05-01", releaseOrder: 1100, chronologicalOrder: 2300, phase: 2, importance: "essential",
    description: "The Avengers face Ultron, an artificial intelligence that decides humanity must be eliminated.",
    poster: "posters/movies/avengers-age-of-ultron.webp" },

  { id: "ant-man", title: "Ant-Man", type: "movie", universe: "mcu",
    releaseDate: "2015-07-17", releaseOrder: 1200, chronologicalOrder: 2400, phase: 2, importance: "recommended",
    description: "Con man Scott Lang is recruited to wear a shrinking suit and pull off a heist for inventor Hank Pym.",
    poster: "posters/movies/ant-man.webp" },

  /* ---------------------------------------------------------- Phase 3 */
  { id: "captain-america-civil-war", title: "Captain America: Civil War", type: "movie", universe: "mcu",
    releaseDate: "2016-05-06", releaseOrder: 1300, chronologicalOrder: 2900, phase: 3, importance: "essential",
    description: "Government oversight splits the Avengers into two opposing camps.",
    poster: "posters/movies/captain-america-civil-war.webp" },

  { id: "doctor-strange", title: "Doctor Strange", type: "movie", universe: "mcu",
    releaseDate: "2016-11-04", releaseOrder: 1400, chronologicalOrder: 3400, phase: 3, importance: "recommended",
    description: "A brilliant surgeon whose career ends in a crash turns to the mystic arts.",
    poster: "posters/movies/doctor-strange.webp" },

  { id: "guardians-of-the-galaxy-vol-2", title: "Guardians of the Galaxy Vol. 2", type: "movie", universe: "mcu",
    releaseDate: "2017-05-05", releaseOrder: 1500, chronologicalOrder: 1800, phase: 3, importance: "recommended",
    description: "The Guardians are hunted across space while Peter Quill learns the truth about his father.",
    poster: "posters/movies/guardians-of-the-galaxy-vol-2.webp" },

  { id: "spider-man-homecoming", title: "Spider-Man: Homecoming", type: "movie", universe: "mcu",
    releaseDate: "2017-07-07", releaseOrder: 1600, chronologicalOrder: 3200, phase: 3, importance: "recommended",
    description: "Peter Parker juggles high school and his Spider-Man ambitions while chasing a dangerous arms dealer.",
    poster: "posters/movies/spider-man-homecoming.webp" },

  { id: "thor-ragnarok", title: "Thor: Ragnarok", type: "movie", universe: "mcu",
    releaseDate: "2017-11-03", releaseOrder: 1700, chronologicalOrder: 3900, phase: 3, importance: "essential",
    description: "Stranded on a gladiator planet, Thor must escape in time to stop his sister Hela from conquering Asgard.",
    poster: "posters/movies/thor-ragnarok.webp" },

  { id: "black-panther", title: "Black Panther", type: "movie", universe: "mcu",
    releaseDate: "2018-02-16", releaseOrder: 1800, chronologicalOrder: 3100, phase: 3, importance: "recommended",
    description: "T'Challa returns to Wakanda to claim the throne and confronts a threat from its past.",
    poster: "posters/movies/black-panther.webp" },

  { id: "avengers-infinity-war", title: "Avengers: Infinity War", type: "movie", universe: "mcu",
    releaseDate: "2018-04-27", releaseOrder: 1900, chronologicalOrder: 4300, phase: 3, importance: "essential",
    description: "The Avengers and their allies race to stop Thanos from collecting the Infinity Stones.",
    poster: "posters/movies/avengers-infinity-war.webp" },

  { id: "ant-man-and-the-wasp", title: "Ant-Man and the Wasp", type: "movie", universe: "mcu",
    releaseDate: "2018-07-06", releaseOrder: 2000, chronologicalOrder: 4200, phase: 3, importance: "optional",
    description: "Scott Lang, under house arrest, is pulled into Hope and Hank Pym's hunt for the missing Janet van Dyne.",
    poster: "posters/movies/ant-man-and-the-wasp.webp" },

  { id: "captain-marvel", title: "Captain Marvel", type: "movie", universe: "mcu",
    releaseDate: "2019-03-08", releaseOrder: 2100, chronologicalOrder: 400, phase: 3, importance: "essential",
    description: "Carol Danvers, a Kree warrior with no memory of her past, lands in the middle of a war on Earth in 1995.",
    poster: "posters/movies/captain-marvel.webp" },

  { id: "avengers-endgame", title: "Avengers: Endgame", type: "movie", universe: "mcu",
    releaseDate: "2019-04-26", releaseOrder: 2200, chronologicalOrder: 4400, phase: 3, importance: "essential",
    description: "The surviving heroes assemble once more to reverse the damage Thanos has done.",
    poster: "posters/movies/avengers-endgame.webp" },

  { id: "spider-man-far-from-home", title: "Spider-Man: Far From Home", type: "movie", universe: "mcu",
    releaseDate: "2019-07-02", releaseOrder: 2300, chronologicalOrder: 5100, phase: 3, importance: "recommended",
    description: "Peter Parker's European school trip is interrupted by Nick Fury and a new elemental threat.",
    poster: "posters/movies/spider-man-far-from-home.webp" },

  /* ---------------------------------------------------------- Phase 4 */
  { id: "black-widow", title: "Black Widow", type: "movie", universe: "mcu",
    releaseDate: "2021-07-09", releaseOrder: 2400, chronologicalOrder: 3000, phase: 4, importance: "recommended",
    description: "Natasha Romanoff confronts her past and the Red Room program that trained her.",
    poster: "posters/movies/black-widow.webp" },

  { id: "shang-chi-and-the-legend-of-the-ten-rings", title: "Shang-Chi and the Legend of the Ten Rings", type: "movie", universe: "mcu",
    releaseDate: "2021-09-03", releaseOrder: 2500, chronologicalOrder: 4900, phase: 4, importance: "recommended",
    description: "Shang-Chi is pulled back into the criminal organization he fled years ago.",
    poster: "posters/movies/shang-chi-and-the-legend-of-the-ten-rings.webp" },

  { id: "eternals", title: "Eternals", type: "movie", universe: "mcu",
    releaseDate: "2021-11-05", releaseOrder: 2600, chronologicalOrder: 5200, phase: 4, importance: "optional",
    description: "Immortal beings who have secretly guarded Earth for thousands of years reunite to face an ancient threat.",
    poster: "posters/movies/eternals.webp" },

  { id: "spider-man-no-way-home", title: "Spider-Man: No Way Home", type: "movie", universe: "mcu",
    releaseDate: "2021-12-17", releaseOrder: 2700, chronologicalOrder: 5300, phase: 4, importance: "essential",
    description: "Peter Parker's identity is exposed, and a spell gone wrong lets in visitors from other universes.",
    poster: "posters/movies/spider-man-no-way-home.webp" },

  { id: "doctor-strange-in-the-multiverse-of-madness", title: "Doctor Strange in the Multiverse of Madness", type: "movie", universe: "mcu",
    releaseDate: "2022-05-06", releaseOrder: 2800, chronologicalOrder: 5400, phase: 4, importance: "essential",
    description: "Stephen Strange protects America Chavez, a teenager who can travel between universes, from a powerful pursuer.",
    poster: "posters/movies/doctor-strange-in-the-multiverse-of-madness.webp" },

  { id: "thor-love-and-thunder", title: "Thor: Love and Thunder", type: "movie", universe: "mcu",
    releaseDate: "2022-07-08", releaseOrder: 2900, chronologicalOrder: 6100, phase: 4, importance: "optional",
    description: "Thor sets out to stop a killer of gods, joined by Valkyrie, Korg and Jane Foster, who now wields his old hammer.",
    poster: "posters/movies/thor-love-and-thunder.webp" },

  { id: "black-panther-wakanda-forever", title: "Black Panther: Wakanda Forever", type: "movie", universe: "mcu",
    releaseDate: "2022-11-11", releaseOrder: 3000, chronologicalOrder: 5700, phase: 4, importance: "recommended",
    description: "Wakanda's leaders defend their nation after the loss of their king and the rise of a hidden underwater power.",
    poster: "posters/movies/black-panther-wakanda-forever.webp" },

  /* ---------------------------------------------------------- Phase 5 */
  { id: "ant-man-and-the-wasp-quantumania", title: "Ant-Man and the Wasp: Quantumania", type: "movie", universe: "mcu",
    releaseDate: "2023-02-17", releaseOrder: 3100, chronologicalOrder: 6500, phase: 5, importance: "essential",
    description: "Scott Lang, Hope and their family are pulled into the Quantum Realm, where they meet Kang the Conqueror.",
    poster: "posters/movies/ant-man-and-the-wasp-quantumania.jpg" },

  { id: "guardians-of-the-galaxy-volume-3", title: "Guardians of the Galaxy Vol. 3", type: "movie", universe: "mcu",
    releaseDate: "2023-05-05", releaseOrder: 3200, chronologicalOrder: 6600, phase: 5, importance: "recommended",
    description: "The Guardians rally to protect Rocket and confront the man who created him.",
    poster: "posters/movies/guardians-of-the-galaxy-volume-3.webp" },

  { id: "the-marvels", title: "The Marvels", type: "movie", universe: "mcu",
    releaseDate: "2023-11-10", releaseOrder: 3300, chronologicalOrder: 6800, phase: 5, importance: "recommended",
    description: "Carol Danvers, Monica Rambeau and Kamala Khan find their powers linked and start swapping places.",
    poster: "posters/movies/the-marvels.webp" },

  { id: "deadpool-and-wolverine", title: "Deadpool & Wolverine", type: "movie", universe: "mcu",
    releaseDate: "2024-07-26", releaseOrder: 3400, chronologicalOrder: 7100, phase: 5, importance: "recommended",
    description: "The TVA recruits Wade Wilson, who teams up with a reluctant Wolverine to save his world.",
    poster: "posters/movies/deadpool-and-wolverine.webp" },

  { id: "captain-america-brave-new-world", title: "Captain America: Brave New World", type: "movie", universe: "mcu",
    releaseDate: "2025-02-14", releaseOrder: 3500, chronologicalOrder: 7500, phase: 5, importance: "recommended",
    description: "Sam Wilson, the new Captain America, is caught up in an international crisis involving President Ross.",
    poster: "posters/movies/captain-america-brave-new-world.webp" },

  { id: "thunderbolts", title: "Thunderbolts*", type: "movie", universe: "mcu",
    releaseDate: "2025-05-02", releaseOrder: 3600, chronologicalOrder: 7600, phase: 5, importance: "recommended",
    description: "A team of antiheroes and government castoffs is sent on a mission that may be a trap.",
    poster: "posters/movies/thunderbolts.webp" },

  /* ---------------------------------------------------------- Phase 6 */
  { id: "the-fantastic-four-first-steps", title: "The Fantastic Four: First Steps", type: "movie", universe: "mcu",
    releaseDate: "2025-07-25", releaseOrder: 3700, chronologicalOrder: 7700, phase: 6, importance: "recommended",
    description: "Marvel's first family defends its retro-futuristic world from the planet-devouring Galactus.",
    poster: "posters/movies/the-fantastic-four-first-steps.webp" },

  { id: "spider-man-brand-new-day", title: "Spider-Man: Brand New Day", type: "movie", universe: "mcu",
    releaseDate: "2026-07-31", releaseOrder: 3800, chronologicalOrder: 8100, phase: 6, importance: "recommended",
    description: "Four years after the world forgot him, Peter Parker fights crime as a full-time Spider-Man as a powerful new threat emerges.",
    poster: "posters/movies/spider-man-brand-new-day.webp" }
];
