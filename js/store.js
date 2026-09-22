/*
 * Watch-progress store. The ONLY file that touches localStorage.
 * Holds personal progress plus the person's UI choices (currently just the
 * WATCH ORDER selection); static content lives in data-*.js.
 *
 * Saved as one JSON blob under "marvel-tracker:v1":
 *   { v: 1,
 *     movies:   { "<movie-id>":   "<ISO time watched>" },
 *     seasons:  { "<season-id>":  "<ISO time watched>" },   // unused: a season is
 *                                                            // complete only when all its episodes are
 *     episodes: { "<episode-id>": "<ISO time watched>" },   // TV progress (e.g. "loki-s2-e1")
 *     prefs:    { "watchOrder": "release" | "chronological" },
 *     watchlist: { "<watchlist-key>": "<ISO time added>" } }   // saved-for-later, NOT progress
 * "prefs" and "watchlist" are optional. Saves written before they existed
 * load fine (each is simply empty) and their watched progress is untouched.
 * Resetting progress never clears prefs or the watchlist.
 *
 * The watchlist is deliberately separate from watched progress: adding to it
 * never marks anything watched, and marking watched never removes anything
 * from it. Its keys name the kind of thing saved, so ids never collide:
 *   "movie:<movie-id>"   "tv:<show-id>"   "season:<season-id>"
 *
 * Usage:  Store.isWatched("movies", id)   Store.toggle("movies", id)
 *         Store.count("movies")           Store.reset("movies")
 *         Store.getPref(key, fallback)    Store.setPref(key, value)
 *         Store.inWatchlist(key)          Store.toggleWatchlist(key)
 *         Store.watchlistEntries()  -- read-only list of { key, at } (copies)
 *         Store.entries(kind)  -- read-only list of { id, at } for everything
 *         watched in that kind, where "at" is the saved ISO time. The Dashboard
 *         uses it for Recently Watched. It returns copies; changing the result
 *         never changes the store.
 *         Store.exportData()  -- read-only deep copy of the whole saved
 *         state, for writing out as a backup file.
 *         Store.importData(obj)  -- validates a parsed backup and, only if
 *         it's well-formed, replaces the whole store with it. Returns
 *         { ok: true } or { ok: false, reason }. Never partially applies
 *         a bad file.
 *         Store.subscribe(fn)  -- fn is called after any change to the
 *         store, whether made in this tab or (via the "storage" event)
 *         in another tab with the same page open. UI code uses this to
 *         re-sync instead of relying only on its own toggle/reset calls,
 *         so two open tabs never stomp on each other's progress.
 *
 * If the browser blocks localStorage (some private modes), progress still
 * works for the current session only, and Store.persistent is false so the
 * UI can warn about it.
 */
window.Store = (function () {
  "use strict";

  var KEY = "marvel-tracker:v1";
  var KINDS = ["movies", "seasons", "episodes"];
  var persistent = true;
  var state = load();
  var listeners = [];

  function notify() {
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) { /* one bad listener shouldn't break the rest */ }
    });
  }

  // Another tab wrote to the same key: pick up its state and tell the UI.
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    state = load();
    notify();
  });

  function blank() {
    return { v: 1, movies: {}, seasons: {}, episodes: {}, prefs: {}, watchlist: {} };
  }

  function load() {
    var fresh = blank();
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return fresh;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return fresh;
      KINDS.forEach(function (k) {
        if (parsed[k] && typeof parsed[k] === "object") fresh[k] = parsed[k];
      });
      if (parsed.prefs && typeof parsed.prefs === "object" && !Array.isArray(parsed.prefs)) {
        fresh.prefs = parsed.prefs;
      }
      if (parsed.watchlist && typeof parsed.watchlist === "object" && !Array.isArray(parsed.watchlist)) {
        fresh.watchlist = parsed.watchlist;
      }
      return fresh;
    } catch (e) {
      // Blocked storage or corrupt JSON: fall back to an in-memory state.
      try { window.localStorage.getItem(KEY); } catch (e2) { persistent = false; }
      return fresh;
    }
  }

  function save() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      persistent = true;
    } catch (e) {
      persistent = false;
    }
  }

  function check(kind) {
    if (KINDS.indexOf(kind) === -1) throw new Error("Store: unknown kind '" + kind + "'");
  }

  return {
    get persistent() { return persistent; },

    isWatched: function (kind, id) {
      check(kind);
      return Object.prototype.hasOwnProperty.call(state[kind], id);
    },

    // Returns the new watched state (true = now watched).
    toggle: function (kind, id) {
      check(kind);
      // Pick up any change another tab made since our last load/save, so a
      // toggle here never overwrites progress recorded in that other tab.
      state = load();
      var nowWatched;
      if (this.isWatched(kind, id)) {
        delete state[kind][id];
        nowWatched = false;
      } else {
        state[kind][id] = new Date().toISOString();
        nowWatched = true;
      }
      save();
      notify();
      return nowWatched;
    },

    // UI choices (not progress). getPref never throws and returns the
    // fallback when nothing is saved.
    getPref: function (key, fallback) {
      return Object.prototype.hasOwnProperty.call(state.prefs, key) ? state.prefs[key] : fallback;
    },

    setPref: function (key, value) {
      // Pick up other tabs' changes first, same as toggle(). Skipped when
      // storage is blocked: load() would return an empty state and throw away
      // the progress held in memory for this session.
      if (persistent) state = load();
      state.prefs[key] = value;
      save();
      notify();
    },

    // Watchlist: a separate list from watched progress. toggleWatchlist
    // returns the new state (true = now on the watchlist).
    inWatchlist: function (key) {
      return Object.prototype.hasOwnProperty.call(state.watchlist, key);
    },

    toggleWatchlist: function (key) {
      // Same cross-tab refresh as toggle(), skipped when storage is blocked
      // (load() would return an empty state and drop this session's data).
      if (persistent) state = load();
      var nowOn;
      if (this.inWatchlist(key)) {
        delete state.watchlist[key];
        nowOn = false;
      } else {
        state.watchlist[key] = new Date().toISOString();
        nowOn = true;
      }
      save();
      notify();
      return nowOn;
    },

    watchlistEntries: function () {
      var src = state.watchlist;
      return Object.keys(src).map(function (key) { return { key: key, at: src[key] }; });
    },

    count: function (kind) {
      check(kind);
      return Object.keys(state[kind]).length;
    },

    // Every watched id of one kind with the time it was marked. Read-only:
    // callers get a fresh array of fresh objects.
    entries: function (kind) {
      check(kind);
      var src = state[kind];
      return Object.keys(src).map(function (id) { return { id: id, at: src[id] }; });
    },

    reset: function (kind) {
      check(kind);
      state = load();
      state[kind] = {};
      save();
      notify();
    },

    // A deep, read-only copy of the whole saved state, suitable for writing
    // out as a backup file. Never the live state object.
    exportData: function () {
      state = load();
      return JSON.parse(JSON.stringify(state));
    },

    // Validates the shape of a parsed backup before touching anything: every
    // top-level key must be the right type, and every value in movies/
    // seasons/episodes/watchlist must be a string (an ISO timestamp), so a
    // malformed or foreign file can never corrupt the store. Returns
    // { ok: true } or { ok: false, reason: "<why>" }. On success this
    // REPLACES the whole store (progress, prefs and watchlist together) --
    // it is a restore, not a merge -- and only after validation has passed.
    importData: function (parsed) {
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, reason: "That file isn't a Mission Control backup (not a JSON object)." };
      }
      var next = blank();
      var mapKinds = KINDS.concat(["watchlist"]);
      for (var i = 0; i < mapKinds.length; i++) {
        var k = mapKinds[i];
        var v = parsed[k];
        if (v === undefined) continue; // optional: an older/partial backup still loads
        if (typeof v !== "object" || v === null || Array.isArray(v)) {
          return { ok: false, reason: "'" + k + "' should be an object of ids to dates." };
        }
        var ids = Object.keys(v);
        for (var j = 0; j < ids.length; j++) {
          if (typeof v[ids[j]] !== "string") {
            return { ok: false, reason: "'" + k + "." + ids[j] + "' should be a date string." };
          }
        }
        next[k] = v;
      }
      if (parsed.prefs !== undefined) {
        if (typeof parsed.prefs !== "object" || parsed.prefs === null || Array.isArray(parsed.prefs)) {
          return { ok: false, reason: "'prefs' should be an object." };
        }
        next.prefs = parsed.prefs;
      }
      state = next;
      save();
      notify();
      return { ok: true };
    },

    // fn is called (no args) after every toggle/reset, in this tab or
    // another. UI code should re-render its progress display from fn.
    subscribe: function (fn) {
      if (typeof fn === "function") listeners.push(fn);
    }
  };
})();
