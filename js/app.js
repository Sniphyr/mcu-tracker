/*
 * Mission Control: app logic.
 * Reads static data (MCU_MOVIES, MCU_TV) and personal progress (Store).
 * Everything derived (progress %, next up, phase counts) is computed here
 * on every render and never saved.
 *
 * The WATCH ORDER selector (release / chronological) chooses which data field
 * orders the lists: releaseOrder or chronologicalOrder. See ORDERS below.
 *
 * Pages (hash routes): #/dashboard (home, the Command Center), #/movies,
 * #/tv, #/tv/<show-id>, #/tv/<show-id>/<season-number>, #/timeline (movies and
 * TV seasons together in the selected watch order) and #/watchlist (things
 * saved for later; kept apart from watched progress).
 */
(function () {
  "use strict";

  var ALL_MOVIES = (window.MCU_MOVIES || []).concat(window.XMEN_MOVIES || []);
  // Only MCU films drive the list, progress and Next Up. Any Sony/Fox films
  // added to the data later stay out of the main MCU progression.
  var MOVIES = ALL_MOVIES.filter(function (m) { return m.universe === "mcu"; });
  // X-Men films (Batch 11B). Kept as their own pool, deliberately parallel to
  // MOVIES rather than merged into it: MOVIES/UNITS/the Dashboard's Next Up
  // and progress math must keep meaning exactly what they meant before this
  // batch (MCU only -- see the batch report). X-Men movies get their own
  // small "X-Men" section on the Movies page and their own block on the
  // Timeline (built from XMOVIES/xsequence() below), reusing every existing
  // card/detail/watch/watchlist mechanism -- nothing new is invented, this
  // is just a second read of the same ALL_MOVIES-derived pool.
  var XMOVIES = ALL_MOVIES.filter(function (m) { return m.universe === "X-Men"; });
  var TV = window.MCU_TV || [];
  var app = document.getElementById("app");
  var view = null; // handles to the currently rendered view
  var modal = null; // handles to the movie detail modal (built once, reused)
  var modalMovieId = null; // id of the movie currently shown in the modal
  var modalOpener = null; // element to refocus when the modal closes

  /* ------------------------------------------------------------ watch order */

  // The two watch orders. Each reads its OWN field from the data; neither is
  // ever derived from the other or from release dates.
  var ORDERS = [
    { key: "release",       label: "Release Order",       field: "releaseOrder" },
    { key: "chronological", label: "Chronological Order", field: "chronologicalOrder" }
  ];

  function orderDef(key) {
    for (var i = 0; i < ORDERS.length; i++) if (ORDERS[i].key === key) return ORDERS[i];
    return ORDERS[0];
  }
  function isOrderKey(key) {
    return ORDERS.some(function (o) { return o.key === key; });
  }
  function storedOrder() {
    var saved = Store.getPref("watchOrder", ORDERS[0].key);
    return isOrderKey(saved) ? saved : ORDERS[0].key;
  }
  var watchOrder = storedOrder();

  // Every watchable unit (one MCU movie or one TV season) in a single list, so
  // movies and seasons can be ordered together by either mode.
  var UNITS = [];
  MOVIES.forEach(function (m) {
    UNITS.push({ kind: "movie", id: m.id, rec: m, phase: m.phase, date: m.releaseDate, movie: m });
  });
  TV.forEach(function (s) {
    s.seasons.forEach(function (se) {
      UNITS.push({ kind: "season", id: se.id, rec: se, phase: se.phase, date: se.releaseDate, show: s, season: se });
    });
  });

  // Units in the given order (optionally one kind only). The mode's own field
  // decides the order; the release date only breaks an exact tie.
  function sequence(mode, kind) {
    var field = orderDef(mode).field;
    return UNITS.filter(function (u) { return !kind || u.kind === kind; }).sort(function (a, b) {
      return a.rec[field] - b.rec[field] || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    });
  }

  // X-Men movies, in the selected watch order, from their OWN releaseOrder /
  // chronologicalOrder fields -- never merged into sequence()/UNITS above.
  // X-Men's order fields live on their own independent numeric scale (see
  // the header comment in data-movies-xmen.js): both universes start
  // counting at 100 in steps of 100, so comparing an X-Men value against an
  // MCU value directly would sort titles by coincidental numeric collisions
  // (e.g. X-Men 100 = X-Men (2000), MCU 100 = Iron Man (2008)) rather than
  // real chronology or story order. Keeping this as a separate sequence is
  // what lets X-Men use its own real order fields without corrupting the
  // shared MCU+TV interleaved order or requiring anyone to renumber it.
  function xsequence(mode) {
    var field = orderDef(mode).field;
    return XMOVIES.slice().sort(function (a, b) {
      return a[field] - b[field] || (a.releaseDate < b.releaseDate ? -1 : a.releaseDate > b.releaseDate ? 1 : 0);
    });
  }

  // Editorial X-Men story-era labels, parallel to saga(phase) for the MCU.
  var XMEN_ERAS = {
    1: "Original Trilogy", 2: "Wolverine Solo Films",
    3: "First Class Prequels", 4: "Deadpool & Modern Era"
  };
  function xmenEra(phase) { return XMEN_ERAS[phase] || "X-Men"; }

  /* ---------------------------------------------------------------- helpers */

  // Tiny element builder. Text is always added as text nodes (never HTML).
  function h(tag, props) {
    var el = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var kids = [].concat(arguments[i]);
      for (var j = 0; j < kids.length; j++) {
        var kid = kids[j];
        if (kid === null || kid === undefined || kid === false) continue;
        el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
      }
    }
    return el;
  }

  // Release order is explicit: sort by releaseOrder, date only breaks ties.
  function byOrder(a, b) {
    return a.order - b.order || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Both guard against a missing/malformed date so one bad data entry can't
  // crash a whole page render; validateData() is what flags the problem.
  function year(iso) {
    return (typeof iso === "string" && iso.length >= 4) ? iso.slice(0, 4) : "\u2014";
  }
  function fmtDate(iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Date unknown";
    var p = iso.split("-");
    var m = MONTHS[Number(p[1]) - 1];
    return (m || "?") + " " + Number(p[2]) + ", " + p[0];
  }
  function saga(phase) { return phase <= 3 ? "The Infinity Saga" : "The Multiverse Saga"; }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function groupByPhase(entries) {
    var map = {};
    entries.forEach(function (e) { (map[e.phase] = map[e.phase] || []).push(e); });
    return Object.keys(map).map(Number).sort(function (a, b) { return a - b; })
      .map(function (p) { return { phase: p, entries: map[p] }; });
  }

  /* ------------------------------------------------------------ data check */

  // Console-only guard for the "never trust array position" rule.
  function validateData() {
    var all = [], problems = [], ids = {}, orders = {};

    // Every movie record (any universe) must be complete and well-formed.
    var REQUIRED = ["id", "title", "type", "universe", "releaseDate", "releaseOrder",
                    "phase", "importance", "description", "poster"];
    var movieIds = {};
    ALL_MOVIES.forEach(function (m) {
      var name = m.id || m.title || "(unnamed movie)";
      REQUIRED.forEach(function (f) {
        if (m[f] === undefined || m[f] === null || m[f] === "") problems.push("Movie " + name + " is missing '" + f + "'");
      });
      if (m.id) {
        if (movieIds[m.id]) problems.push("Duplicate movie id: " + m.id);
        movieIds[m.id] = true;
        if (m.poster && m.poster !== "posters/movies/" + m.id + ".webp") {
          problems.push("Poster path for " + m.id + " should be posters/movies/" + m.id + ".webp");
        }
      }
      if (m.type !== "movie") problems.push("Movie " + name + ": type should be 'movie'");
      if (["mcu", "sony", "fox", "X-Men"].indexOf(m.universe) === -1) problems.push("Movie " + name + ": unknown universe '" + m.universe + "'");
      if (["essential", "recommended", "optional"].indexOf(m.importance) === -1) problems.push("Movie " + name + ": unknown importance '" + m.importance + "'");
      if (!(m.phase >= 1 && m.phase % 1 === 0)) problems.push("Movie " + name + ": phase should be a whole number 1 or higher");
    });

    // Every TV show/season/episode record must be complete and well-formed,
    // with explicit, stable, non-duplicated ids at every level.
    var TV_SHOW_REQUIRED = ["id", "title", "type", "universe", "category", "description", "poster", "seasons"];
    var TV_SEASON_REQUIRED = ["id", "season", "phase", "releaseDate", "releaseOrder", "episodeCount", "episodes"];
    var EPISODE_REQUIRED = ["id", "episode", "title", "releaseDate", "releaseOrder"];
    var showIds = {}, seasonIds = {}, episodeIds = {};
    TV.forEach(function (s) {
      var name = s.id || s.title || "(unnamed show)";
      TV_SHOW_REQUIRED.forEach(function (f) {
        if (s[f] === undefined || s[f] === null || s[f] === "") problems.push("TV show " + name + " is missing '" + f + "'");
      });
      if (s.id) {
        if (showIds[s.id]) problems.push("Duplicate TV show id: " + s.id);
        showIds[s.id] = true;
      }
      if (s.type !== "tv") problems.push("TV show " + name + ": type should be 'tv'");
      if (["mcu", "sony", "fox"].indexOf(s.universe) === -1) problems.push("TV show " + name + ": unknown universe '" + s.universe + "'");
      if (["series", "animation", "special", "documentary"].indexOf(s.category) === -1) problems.push("TV show " + name + ": unknown category '" + s.category + "'");
      if (!Array.isArray(s.seasons) || !s.seasons.length) problems.push("TV show " + name + " has no seasons");

      (s.seasons || []).forEach(function (se) {
        var sName = se.id || (name + " season " + se.season);
        TV_SEASON_REQUIRED.forEach(function (f) {
          if (se[f] === undefined || se[f] === null || se[f] === "") problems.push("Season " + sName + " is missing '" + f + "'");
        });
        if (se.id) {
          if (se.id.indexOf(s.id + "-s") !== 0) problems.push("Season id '" + se.id + "' should start with '" + s.id + "-s'");
          if (seasonIds[se.id]) problems.push("Duplicate season id: " + se.id);
          seasonIds[se.id] = true;
        }
        if (!(se.phase >= 1 && se.phase % 1 === 0)) problems.push("Season " + sName + ": phase should be a whole number 1 or higher");
        if (!Array.isArray(se.episodes)) problems.push("Season " + sName + ": episodes should be an array");

        (se.episodes || []).forEach(function (ep) {
          var epName = ep.id || (sName + " episode " + ep.episode);
          EPISODE_REQUIRED.forEach(function (f) {
            if (ep[f] === undefined || ep[f] === null || ep[f] === "") problems.push("Episode " + epName + " is missing '" + f + "'");
          });
          if (ep.id) {
            if (episodeIds[ep.id]) problems.push("Duplicate episode id: " + ep.id);
            episodeIds[ep.id] = true;
            if (ep.episode !== undefined && ep.id !== se.id + "-e" + ep.episode) {
              problems.push("Episode id '" + ep.id + "' should be '" + se.id + "-e" + ep.episode + "'");
            }
          }
          if (ep.releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(ep.releaseDate)) problems.push("Bad releaseDate on episode: " + epName);
          if (typeof ep.episode !== "number" || !(ep.episode >= 1)) problems.push("Episode " + epName + ": 'episode' should be a number, 1 or higher");
        });
        // A season with some episodes listed must list all of them, or say so
        // (the app treats a short list as incomplete and never as finished).
        if (Array.isArray(se.episodes) && se.episodes.length && se.episodes.length !== se.episodeCount) {
          problems.push("Season " + sName + " lists " + se.episodes.length + " episodes but episodeCount is " + se.episodeCount);
        }
      });
    });

    // Release order is checked for the MCU films, together with TV seasons.
    MOVIES.forEach(function (m) {
      all.push({ id: m.id, order: m.releaseOrder, date: m.releaseDate });
    });
    TV.forEach(function (s) {
      s.seasons.forEach(function (se) {
        all.push({ id: se.id, order: se.releaseOrder, date: se.releaseDate });
      });
    });
    all.forEach(function (i) {
      if (ids[i.id]) problems.push("Duplicate id: " + i.id);
      ids[i.id] = true;
      if (typeof i.order !== "number") problems.push("Missing releaseOrder: " + i.id);
      else if (orders[i.order]) problems.push("Same releaseOrder " + i.order + ": " + orders[i.order] + " and " + i.id);
      else orders[i.order] = i.id;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date || "")) problems.push("Bad releaseDate on: " + i.id);
    });
    all.sort(byOrder).forEach(function (i, n, arr) {
      if (n && i.date < arr[n - 1].date) {
        problems.push("releaseOrder and releaseDate disagree: " + arr[n - 1].id + " then " + i.id);
      }
    });
    // chronologicalOrder: one value per MCU movie and per TV season, on the same
    // scale (so they interleave), unique, and NOT just the release order again.
    var chrSeen = {}, allNumeric = true;
    UNITS.forEach(function (u) {
      var v = u.rec.chronologicalOrder;
      if (typeof v !== "number" || !isFinite(v)) {
        problems.push("Missing chronologicalOrder: " + u.id);
        allNumeric = false;
      } else if (chrSeen[v]) {
        problems.push("Same chronologicalOrder " + v + ": " + chrSeen[v] + " and " + u.id);
      } else {
        chrSeen[v] = u.id;
      }
    });
    if (allNumeric) {
      // Checked for the movies alone AND for movies + seasons together: copying
      // release order onto just the movies must not slip past because the TV
      // seasons happen to differ. (Seasons alone are too few to test this way.)
      var ids = function (mode, kind) { return sequence(mode, kind).map(function (u) { return u.id; }).join(); };
      [["the movies", "movie"], ["movies and TV seasons together", undefined]].forEach(function (c) {
        if (ids("release", c[1]).indexOf(",") !== -1 && ids("release", c[1]) === ids("chronological", c[1])) {
          problems.push("chronologicalOrder gives exactly the release order for " + c[0] +
            ". It must come from the MCU timeline, not release dates");
        }
      });
    }

    // X-Men: checked against ITSELF only (never against MOVIES/TV -- its
    // releaseOrder/chronologicalOrder fields are their own independent
    // scale by design, see data-movies-xmen.js and xsequence() above, so a
    // shared value with an MCU/TV entry is expected and not a problem).
    var xRelSeen = {}, xChrSeen = {};
    XMOVIES.forEach(function (m) {
      if (typeof m.releaseOrder !== "number") problems.push("Missing X-Men releaseOrder: " + m.id);
      else if (xRelSeen[m.releaseOrder]) problems.push("Same X-Men releaseOrder " + m.releaseOrder + ": " + xRelSeen[m.releaseOrder] + " and " + m.id);
      else xRelSeen[m.releaseOrder] = m.id;
      if (typeof m.chronologicalOrder !== "number") problems.push("Missing X-Men chronologicalOrder: " + m.id);
      else if (xChrSeen[m.chronologicalOrder]) problems.push("Same X-Men chronologicalOrder " + m.chronologicalOrder + ": " + xChrSeen[m.chronologicalOrder] + " and " + m.id);
      else xChrSeen[m.chronologicalOrder] = m.id;
    });
    xsequence("release").forEach(function (m, n, arr) {
      if (n && m.releaseDate < arr[n - 1].releaseDate) {
        problems.push("X-Men releaseOrder and releaseDate disagree: " + arr[n - 1].id + " then " + m.id);
      }
    });

    if (problems.length) console.warn("[Mission Control] Data problems:\n - " + problems.join("\n - "));
  }

  /* ------------------------------------------------------------ shared UI */

  function posterBlock(item, extra) {
    var fallback = h("span", { class: "poster-fallback" },
      h("span", { class: "pf-title" }, item.title),
      h("span", { class: "pf-note" }, "Poster not added yet"));
    var poster = h("span", { class: "poster" }, fallback);
    var img = h("img", { src: item.poster, alt: "", loading: "lazy", decoding: "async", draggable: "false" });
    // Missing or broken poster file: reveal the fallback instead of a broken image.
    img.addEventListener("error", function () {
      poster.classList.add("no-poster");
      img.remove();
    });
    poster.appendChild(img);
    [].concat(extra || []).forEach(function (n) { poster.appendChild(n); });
    return poster;
  }

  function persistNotice() {
    return h("p", { class: "notice", hidden: Store.persistent },
      "This browser is blocking storage, so progress will be lost when you close the tab.");
  }

  function sectionHeader(title, sub, countText) {
    var count = h("span", { class: "phase-count" }, countText);
    var head = h("header", { class: "phase-head" },
      h("h2", { class: "phase-title" }, title),
      h("span", { class: "phase-saga" }, sub),
      h("span", { class: "phase-rule", "aria-hidden": "true" }),
      count);
    return { el: head, count: count };
  }

  function phaseHeader(phase, countText) {
    return sectionHeader("Phase " + phase, saga(phase), countText);
  }

  /* ------------------------------------------------- watchlist buttons */

  // Watchlist keys name what was saved, so a movie, a show and a season never
  // share a key: "movie:<id>", "tv:<show-id>", "season:<season-id>".
  function wlKey(kind, id) { return kind + ":" + id; }

  // The Add to / Remove from watchlist button used on the movie panel, the
  // show page and each season. It only ever touches the watchlist: it never
  // reads or writes watched progress. Store.subscribe repaints it (see
  // paintWatchlistBtn), so it also follows changes made in another tab.
  // key and subject may be strings or functions returning strings: the movie
  // panel is reused for every movie, so it supplies both at click time.
  function makeWatchlistBtn(key, subject) {
    var btn = h("button", { type: "button", class: "wl-btn" });
    btn.addEventListener("click", function () {
      var k = typeof key === "function" ? key() : key;
      if (!k) return;
      var name = typeof subject === "function" ? subject() : subject;
      var on = Store.toggleWatchlist(k);
      announce(name + (on ? " added to your watchlist." : " removed from your watchlist."));
    });
    if (typeof key !== "function") paintWatchlistBtn(btn, key);
    return btn;
  }

  function paintWatchlistBtn(btn, key) {
    var on = Store.inWatchlist(key);
    btn.classList.toggle("is-on", on);
    btn.textContent = on ? "REMOVE FROM WATCHLIST" : "ADD TO WATCHLIST";
  }

  /* ---------------------------------------------------------- movie modal */

  // Built once and reused for every movie; only its content changes.
  function buildModal() {
    var titleId = "movie-modal-title";

    var closeBtn = h("button", { type: "button", class: "modal-close", "aria-label": "Close" }, "\u2715");
    var posterWrap = h("div", { class: "modal-poster" });
    var titleEl = h("h2", { class: "modal-title", id: titleId });
    var metaList = h("dl", { class: "modal-meta" });
    var descEl = h("p", { class: "modal-desc" });
    var statusEl = h("p", { class: "modal-status" });
    var actionBtn = h("button", { type: "button", class: "modal-watch-btn" });
    var wlBtn = makeWatchlistBtn(
      function () { return modalMovieId ? wlKey("movie", modalMovieId) : null; },
      function () { return titleEl.textContent; });

    var body = h("div", { class: "modal-body" },
      titleEl, metaList, descEl,
      h("div", { class: "modal-footer" }, statusEl,
        h("div", { class: "modal-actions" }, wlBtn, actionBtn)));

    var panel = h("div", {
      class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId
    }, closeBtn, posterWrap, body);

    var overlay = h("div", { class: "modal-overlay", hidden: true }, panel);

    function onKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== "Tab") return;
      // Trap focus to the two focusable elements in the panel.
      var focusables = [closeBtn, wlBtn, actionBtn];
      var i = focusables.indexOf(document.activeElement);
      e.preventDefault();
      var next = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : (i === focusables.length - 1 ? 0 : i + 1);
      focusables[next < 0 ? 0 : next].focus();
    }

    overlay.addEventListener("mousedown", function (e) {
      if (e.target === overlay) closeModal();
    });
    closeBtn.addEventListener("click", closeModal);
    actionBtn.addEventListener("click", function () {
      if (!modalMovieId) return;
      Store.toggle("movies", modalMovieId); // Store.subscribe below re-syncs the UI
    });

    document.body.appendChild(overlay);

    return {
      overlay: overlay, panel: panel, posterWrap: posterWrap, titleEl: titleEl,
      metaList: metaList, descEl: descEl, statusEl: statusEl, actionBtn: actionBtn,
      wlBtn: wlBtn, closeBtn: closeBtn, onKeydown: onKeydown
    };
  }

  function metaRow(label, value) {
    return h("div", { class: "modal-meta-row" }, h("dt", null, label), h("dd", null, value));
  }

  function updateModalWatchState(watched) {
    modal.statusEl.textContent = watched ? "Watched" : "Not watched";
    modal.statusEl.classList.toggle("is-watched", watched);
    modal.actionBtn.textContent = watched ? "MARK AS UNWATCHED" : "MARK AS WATCHED";
    modal.actionBtn.classList.toggle("is-watched", watched);
  }

  function openMovieModal(m, opener) {
    if (!modal) modal = buildModal();
    modalMovieId = m.id;
    modalOpener = opener || null;

    modal.posterWrap.replaceChildren(posterBlock(m));
    modal.titleEl.textContent = m.title;
    modal.metaList.replaceChildren(
      metaRow("Release date", fmtDate(m.releaseDate)),
      metaRow("Phase", "Phase " + m.phase),
      metaRow("Universe", m.universe.toUpperCase()),
      metaRow("Importance", capitalize(m.importance)));
    modal.descEl.textContent = m.description;
    updateModalWatchState(Store.isWatched("movies", m.id));
    paintWatchlistBtn(modal.wlBtn, wlKey("movie", m.id));

    modal.overlay.hidden = false;
    document.body.classList.add("modal-open");
    document.addEventListener("keydown", modal.onKeydown);
    modal.closeBtn.focus();
  }

  function closeModal() {
    if (!modal || modal.overlay.hidden) return;
    modal.overlay.hidden = true;
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", modal.onKeydown);
    modalMovieId = null;
    var opener = modalOpener;
    modalOpener = null;
    if (opener && document.contains(opener)) opener.focus();
    else if (opener) app.focus({ preventScroll: true }); // opener was removed by a re-draw
  }

  /* ---------------------------------------------------------------- movies */

  // One movie poster card. withPhase adds "Phase N" to the sub line; used in
  // chronological order, where the phase headings are not shown.
  function makeMovieCard(m, withPhase) {
    var card = h("button", {
      type: "button",
      class: "card",
      "aria-haspopup": "dialog",
      title: m.title + " (" + fmtDate(m.releaseDate) + "). " + m.description,
      dataset: { id: m.id }
    },
      posterBlock(m, [h("span", { class: "badge", "aria-hidden": "true" }, "\u2713"),
                      h("span", { class: "tag-next" }, "Next up")]),
      h("span", { class: "meta" },
        h("span", { class: "title" }, m.title),
        h("span", { class: "sub" }, withPhase ? "Phase " + m.phase + " \u00b7 " + year(m.releaseDate) : year(m.releaseDate))));
    card.addEventListener("click", function () {
      openMovieModal(m, card);
    });
    return card;
  }

  function renderMovies() {
    var chrono = watchOrder === "chronological";
    // Order comes from the selected mode's own data field (see sequence()).
    var items = sequence(watchOrder, "movie").map(function (u) {
      return { m: u.movie, id: u.id, phase: u.phase };
    });

    var pctText = document.createTextNode("0");
    var gaugeEl = h("div", { class: "gauge", role: "img", "aria-label": "Movie progress" },
      h("div", { class: "gauge-ring" }),
      h("div", { class: "gauge-label" },
        h("span", { class: "gauge-pct" }, pctText, h("small", null, "%")),
        h("span", { class: "gauge-cap" }, "watched")));

    var statBig = h("span", { class: "stat-big" });
    var nextLabel = h("span", { class: "next-label" });
    var nextTitle = h("span", { class: "next-title" });
    var nextMeta = h("span", { class: "next-meta" });
    var nextBox = h("div", { class: "next" }, nextLabel, nextTitle, nextMeta);

    var notice = persistNotice();
    var cards = {};
    var phaseEls = {};
    var flatCount = null;
    var chipsEl = null;
    var sections;

    if (chrono) {
      // Phases interleave on the timeline, so this is one flat list. The
      // per-phase counts move into chips beside the progress ring.
      var totals = {};
      items.forEach(function (e) { totals[e.phase] = (totals[e.phase] || 0) + 1; });
      chipsEl = h("div", { class: "phase-chips", role: "group", "aria-label": "Progress by phase" });
      Object.keys(totals).map(Number).sort(function (a, b) { return a - b; }).forEach(function (p) {
        var count = h("span", { class: "phase-chip-count" });
        chipsEl.appendChild(h("span", { class: "phase-chip" }, h("span", { class: "phase-chip-name" }, "Phase " + p), count));
        phaseEls[p] = { count: count, total: totals[p], chip: true };
      });

      var flatHead = sectionHeader("Chronological order", "Marvel\u2019s official MCU timeline", "");
      flatCount = flatHead.count;
      var flatGrid = h("div", { class: "grid" });
      items.forEach(function (e) {
        var card = makeMovieCard(e.m, true);
        cards[e.m.id] = card;
        flatGrid.appendChild(card);
      });
      sections = [h("section", { class: "phase" }, flatHead.el, flatGrid)];
    } else {
      sections = groupByPhase(items).map(function (g) {
        var head = phaseHeader(g.phase, "");
        phaseEls[g.phase] = { count: head.count, total: g.entries.length };
        var grid = h("div", { class: "grid" });
        g.entries.forEach(function (e) {
          var card = makeMovieCard(e.m, false);
          cards[e.m.id] = card;
          grid.appendChild(card);
        });
        return h("section", { class: "phase" }, head.el, grid);
      });
    }

    var status = h("section", { class: "status", "aria-label": "Progress" },
      gaugeEl,
      h("div", { class: "status-info" },
        h("div", { class: "stat-line" }, statBig, h("span", { class: "stat-of" }, "movies watched")),
        nextBox,
        chipsEl));

    // ---- X-Men (Batch 11B): its own section below, same cards/detail/watch
    // mechanism, but kept out of the MCU gauge/Next Up above -- see the
    // XMOVIES comment near the top of this file and the batch report.
    var xCards = {};
    var xPhaseEls = {};
    var xFlatCount = null;
    var xItems = xsequence(watchOrder);
    var xSections;
    if (chrono) {
      var xFlatHead = sectionHeader("X-Men \u2014 Chronological order", "In-universe story order across both timelines", "");
      xFlatCount = xFlatHead.count;
      var xFlatGrid = h("div", { class: "grid" });
      xItems.forEach(function (m) {
        var card = makeMovieCard(m, true);
        xCards[m.id] = card;
        xFlatGrid.appendChild(card);
      });
      xSections = [h("section", { class: "phase" }, xFlatHead.el, xFlatGrid)];
    } else {
      var xGroups = {};
      xItems.forEach(function (m) { (xGroups[m.phase] = xGroups[m.phase] || []).push(m); });
      xSections = Object.keys(xGroups).map(Number).sort(function (a, b) { return a - b; }).map(function (p) {
        var head = sectionHeader(xmenEra(p), "X-Men", "");
        xPhaseEls[p] = { count: head.count, total: xGroups[p].length };
        var grid = h("div", { class: "grid" });
        xGroups[p].forEach(function (m) {
          var card = makeMovieCard(m, false);
          xCards[m.id] = card;
          grid.appendChild(card);
        });
        return h("section", { class: "phase" }, head.el, grid);
      });
    }
    var xHeading = xItems.length ? h("h2", { class: "phase-title", style: "margin-top:12px" }, "X-Men Movies") : null;

    view = {
      kind: "movies", items: items, cards: cards, phaseEls: phaseEls, notice: notice,
      flatCount: flatCount,
      gauge: gaugeEl, pctText: pctText, statBig: statBig,
      nextBox: nextBox, nextLabel: nextLabel, nextTitle: nextTitle, nextMeta: nextMeta,
      xItems: xItems, xCards: xCards, xPhaseEls: xPhaseEls, xFlatCount: xFlatCount
    };

    app.replaceChildren.apply(app, [
      h("h1", { class: "sr-only" }, "Movies, " + orderDef(watchOrder).label.toLowerCase()),
      notice, status
    ].concat(sections, xHeading ? [xHeading] : [], xSections));
    syncMovies();
  }

  // Recompute everything derived from progress and update the page in place
  // (no full re-render, so scroll position never jumps).
  function syncMovies() {
    var v = view;
    if (!v || v.kind !== "movies") return;

    var done = 0, next = null, perPhase = {};
    v.items.forEach(function (e) {
      var watched = Store.isWatched("movies", e.id);
      if (watched) {
        done++;
        perPhase[e.phase] = (perPhase[e.phase] || 0) + 1;
      } else if (!next) {
        next = e; // items are in the selected watch order, so the first unwatched is next up
      }
      var card = v.cards[e.id];
      card.classList.toggle("is-watched", watched);
      card.classList.toggle("is-next", !!next && next.id === e.id && !watched);
    });

    Object.keys(v.phaseEls).forEach(function (p) {
      var pe = v.phaseEls[p];
      var n = perPhase[p] || 0;
      pe.count.textContent = n + " of " + pe.total + (pe.chip ? "" : " watched");
    });
    if (v.flatCount) v.flatCount.textContent = done + " of " + v.items.length + " watched";

    var total = v.items.length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    v.gauge.style.setProperty("--p", total ? (done / total) * 100 : 0);
    v.pctText.nodeValue = String(pct);
    v.statBig.textContent = done + " of " + total;

    if (next) {
      var m = next.m;
      v.nextBox.classList.remove("is-clear");
      v.nextLabel.textContent = "Next up";
      v.nextTitle.textContent = m.title;
      v.nextMeta.textContent = year(m.releaseDate) + ", Phase " + m.phase;
    } else {
      v.nextBox.classList.add("is-clear");
      v.nextLabel.textContent = "All caught up";
      v.nextTitle.textContent = "Every movie in the tracker is watched";
      v.nextMeta.textContent = "";
    }

    v.notice.hidden = Store.persistent;

    // X-Men (kept separate from the MCU gauge/Next Up above).
    if (v.xItems) {
      var xDone = 0, xPerPhase = {};
      v.xItems.forEach(function (m) {
        var watched = Store.isWatched("movies", m.id);
        if (watched) { xDone++; xPerPhase[m.phase] = (xPerPhase[m.phase] || 0) + 1; }
        v.xCards[m.id].classList.toggle("is-watched", watched);
      });
      Object.keys(v.xPhaseEls).forEach(function (p) {
        var pe = v.xPhaseEls[p];
        var n = xPerPhase[p] || 0;
        pe.count.textContent = n + " of " + pe.total + " watched";
      });
      if (v.xFlatCount) v.xFlatCount.textContent = xDone + " of " + v.xItems.length + " watched";
    }

    syncOpenModal();
  }

  // Keep an open movie detail panel in sync if its watched state changed
  // elsewhere (the panel's own button, or another tab). The panel can be open
  // over the Movies page or over the Dashboard, so both syncs call this.
  function syncOpenModal() {
    if (modal && modalMovieId && !modal.overlay.hidden) {
      updateModalWatchState(Store.isWatched("movies", modalMovieId));
      paintWatchlistBtn(modal.wlBtn, wlKey("movie", modalMovieId));
    }
  }

  /* ------------------------------------------------------------------- tv */

  // TV progress is ALWAYS derived from the watched episode ids in the store
  // (Store "episodes"), on every render. No percentage, count or "season
  // watched" flag is ever saved. Seasons and shows have no watched state of
  // their own: a season is complete only when every one of its episodes is.
  //
  // Some seasons have no episode records yet (episodes: []). Those are shown as
  // "Episode data unavailable": nothing is invented and no progress is faked.

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  // "a \u00b7 b \u00b7 c" where a line can only wrap at the dots, never inside a part.
  function dotted(parts) {
    var out = [];
    parts.forEach(function (t, i) {
      if (i) out.push(" \u00b7 ");
      out.push(h("span", { class: "nw" }, t));
    });
    return out;
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  function pctOf(done, total) { return total ? (done / total) * 100 : 0; }
  // Whole-number percent for compact cards. Never reads 100% until it is.
  function pctWhole(done, total) {
    var p = Math.round(pctOf(done, total));
    return (p >= 100 && done < total ? 99 : p) + "%";
  }
  // One decimal place only when needed (66.7%, 83.3%, 50%, 100%).
  function pctPrecise(done, total) {
    return String(Math.round(pctOf(done, total) * 10) / 10) + "%";
  }

  // state: "none"    no episode records at all (data unavailable)
  //        "partial" some records, fewer than episodeCount (list incomplete)
  //        "full"    every episode of the season has a record
  // total is episodeCount (the real season size) unless more records exist, so
  // a partly filled season can never look complete.
  function seasonStats(se) {
    var eps = se.episodes || [];
    if (!eps.length) {
      return { state: "none", listed: 0, total: se.episodeCount || 0, done: 0, complete: false };
    }
    var total = Math.max(se.episodeCount || 0, eps.length);
    var done = 0;
    eps.forEach(function (ep) { if (Store.isWatched("episodes", ep.id)) done++; });
    return {
      state: eps.length >= total ? "full" : "partial",
      listed: eps.length, total: total, done: done,
      complete: eps.length >= total && done === total
    };
  }

  // Show-level totals over every season that has episode records.
  function showStats(show) {
    var out = { done: 0, total: 0, seasonsMissing: 0, partial: false, complete: false };
    show.seasons.forEach(function (se) {
      var st = seasonStats(se);
      if (st.state === "none") { out.seasonsMissing++; return; }
      out.done += st.done;
      out.total += st.total;
      if (st.state === "partial") out.partial = true;
    });
    out.complete = out.total > 0 && !out.partial && out.seasonsMissing === 0 && out.done === out.total;
    return out;
  }

  // Episodes of one season in the selected watch order. A per-episode value of
  // the mode's field is used when EVERY episode has one; otherwise episode
  // number decides (a season is a single stretch of the timeline).
  function episodeSeq(se, mode) {
    var field = orderDef(mode).field;
    var eps = (se.episodes || []).slice();
    var all = eps.every(function (e) { return typeof e[field] === "number"; });
    return eps.sort(function (a, b) {
      return (all ? a[field] - b[field] : 0) || a.episode - b.episode;
    });
  }

  // Seasons (optionally of one show) in the selected watch order.
  function seasonsInOrder(show) {
    return sequence(watchOrder, "season").filter(function (u) { return !show || u.show === show; });
  }

  // The earliest unwatched episode in the selected order. An earlier unwatched
  // episode is never skipped because a later one is also unwatched. Seasons
  // without episode records can't supply one and are passed over.
  function nextEpisode(show) {
    var units = seasonsInOrder(show);
    for (var i = 0; i < units.length; i++) {
      var eps = episodeSeq(units[i].season, watchOrder);
      for (var j = 0; j < eps.length; j++) {
        if (!Store.isWatched("episodes", eps[j].id)) {
          return { show: units[i].show, season: units[i].season, ep: eps[j] };
        }
      }
    }
    return null;
  }

  // Everything the TV pages need to know about all shows at once.
  function tvTotals() {
    var t = { done: 0, total: 0, seasonsMissing: 0, seasons: 0 };
    TV.forEach(function (s) {
      var st = showStats(s);
      t.done += st.done;
      t.total += st.total;
      t.seasonsMissing += st.seasonsMissing;
      t.seasons += s.seasons.length;
    });
    return t;
  }

  function showPhases(show) {
    var seen = {};
    show.seasons.forEach(function (se) { seen[se.phase] = true; });
    var list = Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
    if (list.length === 1) return "Phase " + list[0];
    return "Phases " + list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
  }

  // A season's own poster; otherwise the show poster, which is the poster of
  // the first season. Later seasons with no poster of their own get none.
  function seasonPoster(show, se) {
    if (se.poster) return se.poster;
    var first = Math.min.apply(null, show.seasons.map(function (x) { return x.season; }));
    return se.season === first ? show.poster : null;
  }

  function announce(text) {
    var el = document.getElementById("tv-status");
    if (el) el.textContent = text;
  }

  function nextText(n) {
    return {
      title: n.ep.title,
      meta: n.show.title + ", season " + n.season.season + " episode " + n.ep.episode +
        " \u00b7 Phase " + n.season.phase + " \u00b7 " + fmtDate(n.ep.releaseDate)
    };
  }

  /* ------------------------------------------------------ tv browse pages */

  // One TV card. In release order a card is a whole show; in chronological
  // order it is one season (a show's seasons can sit far apart on the
  // timeline). Either way it links to the show page and marks nothing watched.
  function makeTVCard(entry, refs) {
    var s = entry.show, se = entry.season;
    var href = "#/tv/" + encodeURIComponent(s.id) + (se ? "/" + se.season : "");
    var label = se ? s.title + ", season " + se.season : s.title;
    var posterItem = se
      ? { title: s.title + " (Season " + se.season + ")", poster: se.poster || s.poster }
      : s;
    var subs = [];
    if (se) {
      subs.push(h("span", { class: "sub" }, "Season " + se.season));
      subs.push(h("span", { class: "sub" }, "Phase " + se.phase + " \u00b7 " + year(se.releaseDate)));
    } else {
      var years = s.seasons.map(function (x) { return Number(year(x.releaseDate)); });
      var first = Math.min.apply(null, years), last = Math.max.apply(null, years);
      subs.push(h("span", { class: "sub" }, first === last ? String(first) : first + " to " + last));
      subs.push(h("span", { class: "sub" }, plural(s.seasons.length, "season", "seasons")));
    }
    var progA = h("span", { class: "sub tv-progress" });
    var progB = h("span", { class: "sub tv-progress" });
    var progC = h("span", { class: "sub tv-progress-note" });

    var card = h("a", {
      class: "card",
      href: href,
      title: label + ". " + s.description,
      dataset: { id: se ? se.id : s.id, show: s.id }
    },
      posterBlock(posterItem, [h("span", { class: "badge", "aria-hidden": "true" }, "\u2713"),
                               h("span", { class: "tag-next" }, "Next up")]),
      h("span", { class: "meta" },
        h("span", { class: "title" }, s.title),
        subs, progA, progB, progC));
    refs.push({ card: card, entry: entry, progA: progA, progB: progB, progC: progC });
    return card;
  }

  function tvBand() {
    var pctNode = document.createTextNode("0");
    var gauge = h("div", { class: "gauge", role: "img", "aria-label": "TV episode progress" },
      h("div", { class: "gauge-ring" }),
      h("div", { class: "gauge-label" },
        h("span", { class: "gauge-pct" }, pctNode, h("small", null, "%")),
        h("span", { class: "gauge-cap" }, "watched")));
    var statBig = h("span", { class: "stat-big" });
    var statOf = h("span", { class: "stat-of" });
    var nextLabel = h("span", { class: "next-label" });
    var nextTitle = h("span", { class: "next-title" });
    var nextMeta = h("span", { class: "next-meta" });
    var nextBox = h("div", { class: "next" }, nextLabel, nextTitle, nextMeta);
    var note = h("p", { class: "tv-note" });
    var el = h("section", { class: "status", "aria-label": "TV progress" },
      gauge,
      h("div", { class: "status-info" },
        h("div", { class: "stat-line" }, statBig, statOf), nextBox, note));
    return {
      el: el, gauge: gauge, pctNode: pctNode, statBig: statBig, statOf: statOf,
      nextBox: nextBox, nextLabel: nextLabel, nextTitle: nextTitle, nextMeta: nextMeta, note: note
    };
  }

  function renderTV() {
    var refs = [];
    var band = tvBand();
    var sections;

    if (watchOrder === "chronological") {
      var seasons = sequence("chronological", "season");
      var n = seasons.length;
      var head = sectionHeader("Chronological order", "Marvel\u2019s official MCU timeline", plural(n, "season", "seasons"));
      var grid = h("div", { class: "grid" });
      seasons.forEach(function (u) {
        grid.appendChild(makeTVCard({ show: u.show, season: u.season }, refs));
      });
      sections = [h("section", { class: "phase" }, head.el, grid)];
    } else {
      var entries = TV.map(function (s) {
        var first = s.seasons.slice().sort(function (a, b) { return a.releaseOrder - b.releaseOrder; })[0];
        return { s: s, id: s.id, order: first.releaseOrder, date: first.releaseDate, phase: first.phase };
      }).sort(byOrder);
      sections = groupByPhase(entries).map(function (g) {
        var head = phaseHeader(g.phase, plural(g.entries.length, "show", "shows"));
        var grid = h("div", { class: "grid" });
        g.entries.forEach(function (e) {
          grid.appendChild(makeTVCard({ show: e.s, season: null }, refs));
        });
        return h("section", { class: "phase" }, head.el, grid);
      });
    }

    var notice = persistNotice();
    view = { kind: "tv", refs: refs, band: band, notice: notice };

    app.replaceChildren.apply(app, [
      h("h1", { class: "sr-only" }, chronoTitle("TV Shows")),
      notice,
      band.el,
      h("p", { class: "section-note" },
        watchOrder === "chronological"
          ? "Each season sits where it falls on the timeline, so a show can appear more than once. Open one to track its episodes."
          : "Browse the series in release order. Open a show to track it season by season and episode by episode.")
    ].concat(sections));
    syncTV();
  }

  function chronoTitle(base) {
    return watchOrder === "chronological" ? base + ", chronological order" : base;
  }

  // Update the whole TV browse page in place from the current progress.
  function syncTV() {
    var v = view;
    if (!v || v.kind !== "tv") return;
    var next = nextEpisode(null);

    v.refs.forEach(function (r) {
      var st = r.entry.season ? seasonStats(r.entry.season) : showStats(r.entry.show);
      var has = st.total > 0 && (r.entry.season ? st.state !== "none" : true);
      var complete = !!st.complete;
      r.card.classList.toggle("is-watched", complete);
      var holdsNext = !!next && next.show === r.entry.show && (!r.entry.season || next.season === r.entry.season);
      r.card.classList.toggle("is-next", holdsNext);

      if (!has) {
        r.progA.textContent = "Episode data unavailable";
        r.progB.textContent = "";
        r.progC.textContent = "";
      } else {
        r.progA.textContent = st.done + " / " + st.total + " episodes";
        r.progB.textContent = pctWhole(st.done, st.total);
        var gaps = r.entry.season ? (st.state === "partial" ? 1 : 0) : st.seasonsMissing + (st.partial ? 1 : 0);
        r.progC.textContent = gaps ? "Some episode data missing" : "";
      }
      r.progB.hidden = !has;
      r.progC.hidden = !r.progC.textContent;
    });

    var b = v.band, t = tvTotals();
    var any = t.total > 0;
    b.gauge.hidden = !any;
    b.el.classList.toggle("no-gauge", !any);
    if (any) {
      b.gauge.style.setProperty("--p", pctOf(t.done, t.total));
      b.pctNode.nodeValue = String(Math.round(pctOf(t.done, t.total)));
      b.statBig.textContent = t.done + " of " + t.total;
      b.statOf.textContent = "episodes watched";
    } else {
      b.statBig.textContent = "Episode data unavailable";
      b.statOf.textContent = "";
    }

    if (next) {
      var nt = nextText(next);
      b.nextBox.classList.remove("is-clear");
      b.nextLabel.textContent = "Next up";
      b.nextTitle.textContent = nt.title;
      b.nextMeta.textContent = nt.meta;
    } else if (!any) {
      b.nextBox.classList.add("is-clear");
      b.nextLabel.textContent = "Next up";
      b.nextTitle.textContent = "No episodes to track yet";
      b.nextMeta.textContent = "Episode lists have not been added to any show.";
    } else {
      b.nextBox.classList.add("is-clear");
      b.nextLabel.textContent = "All caught up";
      b.nextTitle.textContent = "Every episode in the tracker is watched";
      b.nextMeta.textContent = "";
    }
    b.note.textContent = any && t.seasonsMissing
      ? plural(t.seasonsMissing, "season has", "seasons have") + " no episode data yet and " +
        (t.seasonsMissing === 1 ? "is" : "are") + " left out of these totals."
      : "";
    b.note.hidden = !b.note.textContent;

    v.notice.hidden = Store.persistent;
  }

  /* ------------------------------------------------------ tv show detail */

  var openSeasons = {}; // season id -> true while its episode list is expanded

  function makeBar() {
    var fill = h("span", { class: "bar-fill" });
    return { el: h("span", { class: "bar", "aria-hidden": "true" }, fill), fill: fill };
  }

  function renderShow(showId) {
    var show = null;
    TV.forEach(function (s) { if (s.id === showId) show = s; });

    if (!show) {
      view = { kind: "show-missing" };
      app.replaceChildren(
        h("h1", { class: "sr-only" }, "Show not found"),
        h("a", { class: "back-link", href: "#/tv" }, "\u2039 All TV shows"),
        h("p", { class: "notice" }, "There is no TV show with that address. Pick one from the TV Shows list."));
      return;
    }

    var refs = { show: show, seasons: [], episodes: {}, wl: [] };

    // Show summary: poster, title, facts, description, overall progress.
    var progText = h("span", { class: "show-progress-text" });
    var progBar = makeBar();
    var progNote = h("p", { class: "tv-note" });
    var nextLabel = h("span", { class: "next-label" }, "Next up");
    var nextTitle = h("span", { class: "next-title" });
    var nextMeta = h("span", { class: "next-meta" });
    var nextBox = h("div", { class: "next" }, nextLabel, nextTitle, nextMeta);

    var facts = h("dl", { class: "show-meta" },
      h("div", null, h("dt", null, "Category"), h("dd", null, capitalize(show.category))),
      h("div", null, h("dt", null, "Universe"), h("dd", null, show.universe.toUpperCase())),
      h("div", null, h("dt", null, "Phase"), h("dd", null, showPhases(show))),
      h("div", null, h("dt", null, "Seasons"), h("dd", null, String(show.seasons.length))));

    // Watchlist for the whole show (each season has its own button below).
    var showWlKey = wlKey("tv", show.id);
    var showWl = makeWatchlistBtn(showWlKey, show.title);
    refs.wl.push({ btn: showWl, key: showWlKey });

    var summary = h("section", { class: "show-head", "aria-label": "About " + show.title },
      h("div", { class: "show-poster" }, posterBlock(show)),
      h("div", { class: "show-info" },
        h("h1", { class: "show-title" }, show.title),
        facts,
        h("p", { class: "modal-desc" }, show.description),
        h("div", { class: "wl-row" }, showWl),
        h("div", { class: "show-progress" }, progText, progBar.el, progNote),
        nextBox));

    // Seasons, each an expandable list of episodes.
    var list = h("div", { class: "seasons" });
    seasonsInOrder(show).forEach(function (u) {
      var se = u.season;
      var panelId = "season-panel-" + se.id;
      var poster = seasonPoster(show, se);

      var sPosterEl;
      if (poster) {
        sPosterEl = posterBlock({ title: show.title + " (Season " + se.season + ")", poster: poster });
      } else {
        sPosterEl = h("span", { class: "poster no-poster" },
          h("span", { class: "poster-fallback" },
            h("span", { class: "pf-title" }, "Season " + se.season),
            h("span", { class: "pf-note" }, "Poster not added yet")));
      }

      var line3 = h("span", { class: "season-progress" });
      var bar = makeBar();
      var doneTag = h("span", { class: "season-done", hidden: true }, "Complete");
      var toggle = h("button", {
        type: "button", class: "season-toggle",
        "aria-expanded": openSeasons[se.id] ? "true" : "false",
        "aria-controls": panelId
      },
        h("span", { class: "season-thumb" }, sPosterEl),
        h("span", { class: "season-info" },
          h("span", { class: "season-name" }, "Season " + se.season, doneTag),
          h("span", { class: "season-facts" },
            dotted(["Phase " + se.phase, fmtDate(se.releaseDate), plural(se.episodeCount, "episode", "episodes")])),
          line3, bar.el),
        h("span", { class: "season-chevron", "aria-hidden": "true" }));

      var epList = h("ol", { class: "episodes" });
      var episodes = episodeSeq(se, watchOrder);
      episodes.forEach(function (ep) {
        var mark = h("span", { class: "ep-mark", "aria-hidden": "true" });
        var stateEl = h("span", { class: "ep-state" });
        var btn = h("button", { type: "button", class: "ep-btn" }, mark, stateEl);
        var li = h("li", { class: "ep", dataset: { id: ep.id } },
          h("span", { class: "ep-num" }, pad2(ep.episode)),
          h("span", { class: "ep-main" },
            h("span", { class: "ep-title" }, ep.title),
            h("span", { class: "ep-date" }, fmtDate(ep.releaseDate))),
          btn);
        // Only this episode changes. The season and show update themselves
        // from the watched episode ids (see syncShow).
        btn.addEventListener("click", function () {
          var now = Store.toggle("episodes", ep.id);
          var st = seasonStats(se);
          announce("Episode " + ep.episode + " " + (now ? "marked watched" : "marked unwatched") +
            ". Season " + se.season + ": " + st.done + " of " + st.total + " watched.");
        });
        refs.episodes[ep.id] = { ep: ep, li: li, btn: btn, mark: mark, stateEl: stateEl, se: se };
        epList.appendChild(li);
      });

      // Watchlist for this season: first thing in its opened panel.
      var seasonWlKey = wlKey("season", se.id);
      var seasonWl = makeWatchlistBtn(seasonWlKey, show.title + " season " + se.season);
      refs.wl.push({ btn: seasonWl, key: seasonWlKey });

      var panelBody = [h("div", { class: "wl-row" }, seasonWl)];
      var stNow = seasonStats(se);
      if (stNow.state === "none") {
        panelBody.push(h("p", { class: "season-empty" },
          "Episode data unavailable. This season has " + plural(se.episodeCount, "episode", "episodes") +
          ", but their titles and release dates have not been added yet, so there is nothing to mark."));
      } else {
        panelBody.push(epList);
        if (stNow.state === "partial") {
          panelBody.push(h("p", { class: "season-empty" },
            "Only " + stNow.listed + " of " + stNow.total + " episodes have been added so far. " +
            "This season stays incomplete until the rest are added and watched."));
        }
      }
      var panel = h("div", { class: "season-panel", id: panelId, hidden: !openSeasons[se.id] }, panelBody);

      toggle.addEventListener("click", function () {
        var open = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        panel.hidden = !open;
        if (open) openSeasons[se.id] = true; else delete openSeasons[se.id];
      });

      var box = h("article", { class: "season", id: "season-" + se.id },
        h("h2", { class: "season-heading" }, toggle), panel);
      list.appendChild(box);
      refs.seasons.push({
        se: se, box: box, toggle: toggle, line3: line3, bar: bar, doneTag: doneTag
      });
    });

    var notice = persistNotice();
    view = {
      kind: "show", showId: show.id, refs: refs, notice: notice,
      progText: progText, progBar: progBar, progNote: progNote,
      nextBox: nextBox, nextLabel: nextLabel, nextTitle: nextTitle, nextMeta: nextMeta
    };
    app.replaceChildren(
      notice,
      h("a", { class: "back-link", href: "#/tv" }, "\u2039 All TV shows"),
      summary,
      h("h2", { class: "sr-only" }, "Seasons"),
      list);
    syncShow();
  }

  // Recompute every number on the show page from the watched episode ids and
  // update the page in place (no re-render, so focus and scroll stay put).
  function syncShow() {
    var v = view;
    if (!v || v.kind !== "show") return;
    var show = v.refs.show;

    v.refs.wl.forEach(function (x) { paintWatchlistBtn(x.btn, x.key); });

    Object.keys(v.refs.episodes).forEach(function (id) {
      var r = v.refs.episodes[id];
      var watched = Store.isWatched("episodes", id);
      r.li.classList.toggle("is-watched", watched);
      r.btn.classList.toggle("is-watched", watched);
      r.mark.textContent = watched ? "\u2713" : "\u25cb";
      r.stateEl.textContent = watched ? "Watched" : "Unwatched";
      r.btn.setAttribute("aria-label",
        "Episode " + r.ep.episode + ", " + r.ep.title + ": " + (watched ? "watched" : "unwatched") +
        ". Press to mark " + (watched ? "unwatched" : "watched") + ".");
    });

    v.refs.seasons.forEach(function (r) {
      var st = seasonStats(r.se);
      r.box.classList.toggle("is-complete", st.complete);
      r.doneTag.hidden = !st.complete;
      if (st.state === "none") {
        r.line3.textContent = "Episode data unavailable";
        r.bar.el.hidden = true;
      } else {
        r.line3.replaceChildren.apply(r.line3,
          dotted([st.done + " / " + st.total + " episodes watched", pctPrecise(st.done, st.total)]));
        r.bar.el.hidden = false;
        r.bar.fill.style.width = pctOf(st.done, st.total) + "%";
      }
    });

    var ss = showStats(show);
    if (ss.total > 0) {
      v.progText.replaceChildren.apply(v.progText,
        dotted([ss.done + " / " + ss.total + " episodes watched", pctPrecise(ss.done, ss.total)]));
      v.progBar.el.hidden = false;
      v.progBar.fill.style.width = pctOf(ss.done, ss.total) + "%";
    } else {
      v.progText.textContent = "Episode data unavailable";
      v.progBar.el.hidden = true;
    }
    v.progNote.textContent = ss.total > 0 && (ss.seasonsMissing || ss.partial)
      ? "Some episode data is missing, so these totals cover only the episodes that have been added."
      : "";
    v.progNote.hidden = !v.progNote.textContent;

    var next = nextEpisode(show);
    if (next) {
      var nt = nextText(next);
      v.nextBox.hidden = false;
      v.nextBox.classList.remove("is-clear");
      v.nextLabel.textContent = "Next up";
      v.nextTitle.textContent = nt.title;
      v.nextMeta.textContent = "Season " + next.season.season + ", episode " + next.ep.episode +
        " \u00b7 " + fmtDate(next.ep.releaseDate);
    } else if (ss.total > 0) {
      v.nextBox.hidden = false;
      v.nextBox.classList.add("is-clear");
      v.nextLabel.textContent = "All caught up";
      v.nextTitle.textContent = "Every listed episode is watched";
      v.nextMeta.textContent = "";
    } else {
      v.nextBox.hidden = true; // nothing to point at when there are no episodes
    }

    v.notice.hidden = Store.persistent;
  }

  /* ------------------------------------------------------------ dashboard */

  // The Command Center (home). Every number on it is DERIVED from the static
  // data plus the watched ids in the store, each time it syncs. Nothing here
  // is saved, hardcoded, or kept in a second progress database.
  //
  // Shape (so a later batch can add to it without rebuilding it):
  //   computeDashboard()  reads the store once and returns one plain object
  //                       `d` (movies, tv, overall, recent, continuing).
  //                       New data goes here.
  //   DASH_PANELS         ordered list of self-contained panels. Each entry is
  //                       { key, wide, build() } and build() returns
  //                       { el, sync(d) }. To add a panel, add one entry.
  //                       Panels never read each other, so the normal
  //                       Dashboard does not depend on any optional panel.
  //   .dash-modes         an empty slot in the Dashboard header, reserved for
  //                       mode controls a later batch may add.

  var UNAVAILABLE = "Episode data unavailable";
  var RECENT_LIMIT = 6;
  var CONTINUE_LIMIT = 4;
  var dashEnter = false; // true only while route() draws the page (drives the fade-in)

  // Lookups over STATIC data, built once (never over progress).
  var MOVIE_BY_ID = {};
  MOVIES.forEach(function (m) { MOVIE_BY_ID[m.id] = m; });
  var EPISODE_BY_ID = {};
  TV.forEach(function (s) {
    s.seasons.forEach(function (se) {
      (se.episodes || []).forEach(function (ep) {
        EPISODE_BY_ID[ep.id] = { show: s, season: se, ep: ep };
      });
    });
  });
  var MOVIE_PHASES = (function () {
    var seen = {};
    MOVIES.forEach(function (m) { seen[m.phase] = true; });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  })();

  // The orders never change while the page is open (static data), so each
  // one is worked out once and reused.
  var movieOrderCache = {};
  function moviesInOrder(mode) {
    return movieOrderCache[mode] || (movieOrderCache[mode] = sequence(mode, "movie"));
  }
  var showOrderCache = {};
  // Shows in the selected order, each placed by its earliest season in that order.
  function showsInOrder(mode) {
    if (showOrderCache[mode]) return showOrderCache[mode];
    var seen = {}, out = [];
    sequence(mode, "season").forEach(function (u) {
      if (!seen[u.show.id]) { seen[u.show.id] = true; out.push(u.show); }
    });
    return (showOrderCache[mode] = out);
  }

  // Whole-number percent that never reads 100 until everything is done, and
  // never reads 0 once something is.
  function pctInt(done, total) {
    if (!total) return 0;
    var p = Math.round((done / total) * 100);
    if (p >= 100 && done < total) return 99;
    if (p < 1 && done > 0) return 1;
    return p;
  }

  // Saved times are ISO strings. Anything else (or garbage) counts as "unknown".
  function stamp(at) {
    var t = typeof at === "string" ? Date.parse(at) : NaN;
    return isNaN(t) ? 0 : t;
  }
  function timeAgo(t) {
    if (!t) return "Earlier";
    var sec = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (sec < 60) return "Just now";
    var min = Math.floor(sec / 60);
    if (min < 60) return min + " min ago";
    var hr = Math.floor(min / 60);
    if (hr < 24) return plural(hr, "hour", "hours") + " ago";
    var day = Math.floor(hr / 24);
    if (day < 7) return plural(day, "day", "days") + " ago";
    var dt = new Date(t);
    return MONTHS[dt.getMonth()] + " " + dt.getDate() + ", " + dt.getFullYear();
  }

  function seasonHref(show, se) {
    return "#/tv/" + encodeURIComponent(show.id) + "/" + se.season;
  }

  // Poster for a season (falls back to the same placeholder the TV pages use).
  // extra (optional): nodes laid over the poster, such as the watched badge.
  function seasonThumb(show, se, extra) {
    var label = show.title + " (Season " + se.season + ")";
    var poster = seasonPoster(show, se);
    if (poster) return posterBlock({ title: label, poster: poster }, extra);
    return h("span", { class: "poster no-poster" },
      h("span", { class: "poster-fallback" },
        h("span", { class: "pf-title" }, label),
        h("span", { class: "pf-note" }, "Poster not added yet")),
      extra);
  }

  /* ----- the snapshot: one read of the store, everything derived from it ----- */

  function computeDashboard() {
    var d = {};

    // Movies: one pass in the selected watch order. The first unwatched one
    // in that order is next up, so nothing earlier is ever skipped.
    var order = moviesInOrder(watchOrder);
    var phases = {}, done = 0, next = null;
    MOVIE_PHASES.forEach(function (p) { phases[p] = { phase: p, done: 0, total: 0 }; });
    order.forEach(function (u) {
      var ph = phases[u.phase];
      ph.total++;
      if (Store.isWatched("movies", u.id)) { done++; ph.done++; }
      else if (!next) next = u.movie;
    });
    d.movies = {
      total: order.length, done: done, remaining: order.length - done, next: next,
      phases: MOVIE_PHASES.map(function (p) { return phases[p]; })
    };

    // TV: the same per-show numbers the TV pages use (showStats), summed once.
    // Only seasons that have episode records count; the rest are left out and
    // reported as unavailable. Nothing is estimated.
    var t = { done: 0, total: 0, seasonsMissing: 0, seasons: 0, declared: 0, partial: false, shows: [] };
    showsInOrder(watchOrder).forEach(function (s) {
      var st = showStats(s);
      t.done += st.done;
      t.total += st.total;
      t.seasonsMissing += st.seasonsMissing;
      if (st.partial) t.partial = true;
      t.seasons += s.seasons.length;
      s.seasons.forEach(function (se) { t.declared += se.episodeCount || 0; });
      t.shows.push({ show: s, st: st });
    });
    t.remaining = t.total - t.done;
    t.next = nextEpisode(null); // earliest unwatched episode in the selected order
    t.nextGaps = 0;             // earlier seasons that could not supply an episode
    if (t.next) {
      var units = seasonsInOrder(null);
      for (var i = 0; i < units.length && units[i].season !== t.next.season; i++) {
        var eps = units[i].season.episodes || [];
        if (eps.length < (units[i].season.episodeCount || 0)) t.nextGaps++;
      }
    }
    d.tv = t;

    // Everything watched, newest first (movies and episodes together).
    var history = [], lastByShow = {};
    Store.entries("movies").forEach(function (e) {
      var m = MOVIE_BY_ID[e.id];
      if (m) history.push({ kind: "movie", id: e.id, at: stamp(e.at), movie: m });
    });
    Store.entries("episodes").forEach(function (e) {
      var r = EPISODE_BY_ID[e.id];
      if (!r) return;
      var at = stamp(e.at);
      history.push({ kind: "episode", id: e.id, at: at, show: r.show, season: r.season, ep: r.ep });
      if (!(r.show.id in lastByShow) || at > lastByShow[r.show.id]) lastByShow[r.show.id] = at;
    });
    history.sort(function (a, b) {
      return b.at - a.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    d.recent = history.slice(0, RECENT_LIMIT);

    // Continue watching: shows that are started, not finished, and have an
    // episode to carry on with (in the selected order). Real progress only.
    d.continuing = [];
    t.shows.forEach(function (r) {
      if (r.st.done > 0 && !r.st.complete) {
        var nx = nextEpisode(r.show);
        if (nx) d.continuing.push({ show: r.show, st: r.st, next: nx, last: lastByShow[r.show.id] || 0 });
      }
    });
    d.continuing.sort(function (a, b) {
      return b.last - a.last || (a.show.title < b.show.title ? -1 : 1);
    });

    // Movies and the episodes that can actually be tracked, combined.
    var oDone = d.movies.done + t.done, oTotal = d.movies.total + t.total;
    d.overall = { done: oDone, total: oTotal, pct: pctInt(oDone, oTotal), exact: pctOf(oDone, oTotal) };
    return d;
  }

  /* -------------------------------------------------------- panel pieces */

  // Section wrapper shared by every panel.
  function panelShell(key, label, link) {
    var titleId = "dash-h-" + key;
    var head = h("header", { class: "dash-panel-head" },
      h("h2", { class: "dash-label", id: titleId }, label),
      link ? h("a", { class: "dash-link", href: link.href }, link.text) : null);
    var el = h("section", { class: "dash-panel dash-" + key, "aria-labelledby": titleId }, head);
    return el;
  }

  // Row of big numbers with small captions.
  function statRow(labels) {
    var nums = labels.map(function () { return h("span", { class: "dash-stat-num" }); });
    var el = h("div", { class: "dash-stats" }, labels.map(function (l, i) {
      return h("div", { class: "dash-stat" }, nums[i], h("span", { class: "dash-stat-key" }, l));
    }));
    return { el: el, nums: nums };
  }

  function setBar(bar, done, total) {
    bar.fill.style.width = pctOf(done, total) + "%";
  }

  /* ------------------------------------------------------ mission status */

  function buildMissionPanel() {
    var pctNode = document.createTextNode("0");
    var gauge = h("div", { class: "gauge", role: "img", "aria-label": "Overall progress" },
      h("div", { class: "gauge-ring" }),
      h("div", { class: "gauge-label" },
        h("span", { class: "gauge-pct" }, pctNode, h("small", null, "%")),
        h("span", { class: "gauge-cap" }, "overall")));

    function line(name) {
      var val = h("span", { class: "m-val" });
      var bar = makeBar();
      return { val: val, bar: bar, el: h("div", { class: "m-line" }, h("span", { class: "m-key" }, name), val, bar.el) };
    }
    var mv = line("Movies"), tv = line("TV Episodes"), all = line("Overall");
    var remMovies = h("dd", { class: "m-rem-val" });
    var remTV = h("dd", { class: "m-rem-val" });
    var note = h("p", { class: "dash-note" });

    var el = panelShell("mission", "Mission status");
    el.appendChild(h("div", { class: "mission-body" },
      gauge,
      h("div", { class: "m-lines" }, mv.el, tv.el, all.el),
      h("div", { class: "mission-remaining" },
        h("h3", { class: "dash-label" }, "Remaining"),
        h("dl", { class: "m-rem" },
          h("div", null, h("dt", null, "Movies"), remMovies),
          h("div", null, h("dt", null, "TV Episodes"), remTV)))));
    el.appendChild(note);

    return {
      el: el,
      sync: function (d) {
        var o = d.overall, t = d.tv;
        gauge.style.setProperty("--p", o.exact);
        pctNode.nodeValue = String(o.pct);
        gauge.setAttribute("aria-label", "Overall progress " + o.pct + " percent");

        mv.val.textContent = d.movies.done + " / " + d.movies.total;
        setBar(mv.bar, d.movies.done, d.movies.total);
        remMovies.textContent = String(d.movies.remaining);

        var hasTV = t.total > 0;
        tv.val.textContent = hasTV ? t.done + " / " + t.total : UNAVAILABLE;
        tv.val.classList.toggle("is-na", !hasTV);
        tv.bar.el.hidden = !hasTV;
        if (hasTV) setBar(tv.bar, t.done, t.total);
        remTV.textContent = hasTV ? String(t.remaining) : UNAVAILABLE;
        remTV.classList.toggle("is-na", !hasTV);

        all.val.textContent = o.pct + "%";
        setBar(all.bar, o.done, o.total);

        note.textContent = !hasTV
          ? "Overall covers movies only. TV episode data has not been added yet."
          : t.seasonsMissing
            ? "Overall covers movies and tracked episodes. " + plural(t.seasonsMissing, "season has", "seasons have") +
              " no episode data yet and " + (t.seasonsMissing === 1 ? "is" : "are") + " left out."
            : "";
        note.hidden = !note.textContent;
      }
    };
  }

  /* ------------------------------------------------------------- next up */

  // One Next Up card. The whole card is one target (a stretched link on the
  // title); when there is nothing to open, the title is plain text instead.
  function buildNextCard(kind) {
    var posterSlot = h("div", { class: "nextup-poster" });
    var titleLink = kind === "movie"
      ? h("button", { type: "button", class: "nextup-title nextup-link", "aria-haspopup": "dialog" })
      : h("a", { class: "nextup-title nextup-link" });
    var titlePlain = h("span", { class: "nextup-title" });
    var meta = h("span", { class: "nextup-meta" });
    var desc = h("span", { class: "nextup-desc" });
    var note = h("span", { class: "nextup-note" });
    var cta = h("span", { class: "nextup-cta", "aria-hidden": "true" });
    var el = h("div", { class: "nextup-card nextup-" + kind },
      posterSlot,
      h("div", { class: "nextup-body" },
        h("span", { class: "nextup-label" }, kind === "movie" ? "Movie next up" : "TV next up"),
        titleLink, titlePlain, meta, desc, note, cta));
    var shownKey = null;

    // spec: { key, actionable, title, meta, desc, note, cta, href, poster() }
    function show(spec) {
      var go = !!spec.actionable;
      el.classList.toggle("is-actionable", go);
      el.classList.toggle("is-clear", !go);
      titleLink.hidden = !go;
      titlePlain.hidden = go;
      (go ? titleLink : titlePlain).textContent = spec.title;
      if (go && spec.href) titleLink.setAttribute("href", spec.href);
      meta.textContent = spec.meta || "";
      desc.textContent = spec.desc || "";
      note.textContent = spec.note || "";
      cta.textContent = go ? spec.cta : "";
      meta.hidden = !spec.meta;
      desc.hidden = !spec.desc;
      note.hidden = !spec.note;
      cta.hidden = !go;
      if (spec.key !== shownKey) { // only redraw the poster when the target changes
        shownKey = spec.key;
        if (spec.poster) posterSlot.replaceChildren(spec.poster()); else posterSlot.replaceChildren();
        posterSlot.hidden = !spec.poster;
      }
    }
    return { el: el, link: titleLink, show: show };
  }

  function buildNextUpPanel() {
    var movieCard = buildNextCard("movie");
    var tvCard = buildNextCard("tv");
    var movieNow = null; // the movie the card currently points at

    // Opens the existing movie detail panel, right here over the Dashboard.
    movieCard.link.addEventListener("click", function () {
      if (movieNow) openMovieModal(movieNow, movieCard.link);
    });

    var el = panelShell("nextup", "Next up");
    el.appendChild(h("div", { class: "nextup-grid" }, movieCard.el, tvCard.el));

    return {
      el: el,
      sync: function (d) {
        var m = d.movies.next;
        movieNow = m;
        if (m) {
          movieCard.show({
            key: "m:" + m.id, actionable: true, title: m.title,
            meta: year(m.releaseDate) + " \u00b7 Phase " + m.phase,
            desc: m.description, cta: "View details",
            poster: function () { return posterBlock(m); }
          });
        } else {
          movieCard.show({
            key: "m:none", actionable: false, title: "All movies watched",
            meta: "Every MCU movie in the tracker is marked watched."
          });
        }

        var t = d.tv, n = t.next;
        if (n) {
          tvCard.show({
            key: "e:" + n.ep.id, actionable: true, title: n.ep.title,
            meta: n.show.title + " \u00b7 Season " + n.season.season + " \u00b7 Episode " + n.ep.episode,
            desc: "Phase " + n.season.phase + " \u00b7 " + fmtDate(n.ep.releaseDate),
            note: t.nextGaps
              ? plural(t.nextGaps, "earlier season has", "earlier seasons have") + " incomplete episode data and " +
                (t.nextGaps === 1 ? "is" : "are") + " not counted here."
              : "",
            cta: "Open season", href: seasonHref(n.show, n.season),
            poster: function () { return seasonThumb(n.show, n.season); }
          });
        } else if (!t.total) {
          tvCard.show({
            key: "e:na", actionable: false, title: UNAVAILABLE,
            meta: "No episode records have been added for " + plural(t.seasons, "season", "seasons") +
              ", so there is no episode to queue."
          });
        } else {
          tvCard.show({
            key: "e:done", actionable: false, title: "All tracked episodes watched",
            meta: "Nothing is left in the episodes that have been added.",
            note: t.seasonsMissing || t.partial ? "Some seasons still have incomplete episode data." : ""
          });
        }
      }
    };
  }

  /* ------------------------------------------------------ movie progress */

  function buildMoviePanel() {
    var stats = statRow(["Watched", "Remaining", "Overall"]);
    var bar = makeBar();
    var rows = MOVIE_PHASES.map(function (p) {
      var count = h("span", { class: "pl-count" });
      var b = makeBar();
      var li = h("li", { class: "pl-row" },
        h("span", { class: "pl-name" }, "Phase " + p),
        h("span", { class: "pl-saga" }, saga(p)),
        count, b.el);
      return { li: li, count: count, bar: b };
    });

    var el = panelShell("movies", "Movie progress", { href: "#/movies", text: "All movies \u203a" });
    el.appendChild(stats.el);
    el.appendChild(bar.el);
    el.appendChild(h("h3", { class: "dash-sublabel" }, "By phase"));
    el.appendChild(h("ul", { class: "pl-list" }, rows.map(function (r) { return r.li; })));

    return {
      el: el,
      sync: function (d) {
        var mv = d.movies;
        stats.nums[0].textContent = String(mv.done);
        stats.nums[1].textContent = String(mv.remaining);
        stats.nums[2].textContent = pctInt(mv.done, mv.total) + "%";
        setBar(bar, mv.done, mv.total);
        rows.forEach(function (r, i) {
          var ph = mv.phases[i];
          r.count.textContent = ph.done + " / " + ph.total;
          r.li.classList.toggle("is-complete", ph.total > 0 && ph.done === ph.total);
          setBar(r.bar, ph.done, ph.total);
        });
      }
    };
  }

  /* ---------------------------------------------------------- tv progress */

  function buildTVPanel() {
    var stats = statRow(["Watched", "Remaining", "Overall"]);
    var na = h("div", { class: "dash-empty" },
      h("strong", { class: "dash-empty-title" }, UNAVAILABLE),
      h("span", { class: "dash-empty-text" }));
    var bar = makeBar();
    var note = h("p", { class: "dash-note" });

    var rows = showsInOrder(watchOrder).map(function (s) {
      var name = h("span", { class: "tv-row-name" }, s.title);
      var count = h("span", { class: "tv-row-count" });
      var b = makeBar();
      var gap = h("span", { class: "tv-row-gap" }, "Some episode data missing");
      var a = h("a", { class: "tv-row", href: "#/tv/" + encodeURIComponent(s.id) }, name, count, b.el, gap);
      return { show: s, a: a, count: count, bar: b, gap: gap };
    });

    var el = panelShell("tv", "TV progress", { href: "#/tv", text: "All shows \u203a" });
    el.appendChild(stats.el);
    el.appendChild(na);
    el.appendChild(bar.el);
    el.appendChild(note);
    el.appendChild(h("h3", { class: "dash-sublabel" }, "By show"));
    el.appendChild(h("ul", { class: "tv-list" }, rows.map(function (r) { return h("li", null, r.a); })));

    return {
      el: el,
      sync: function (d) {
        var t = d.tv, has = t.total > 0;
        stats.el.hidden = !has;
        bar.el.hidden = !has;
        na.hidden = has;
        if (has) {
          stats.nums[0].textContent = String(t.done);
          stats.nums[1].textContent = String(t.remaining);
          stats.nums[2].textContent = pctInt(t.done, t.total) + "%";
          setBar(bar, t.done, t.total);
        } else {
          na.lastChild.textContent = plural(t.seasons, "season", "seasons") + " across " + plural(TV.length, "show", "shows") +
            " are listed (" + t.declared + " episodes in their season counts), but no episode titles or dates have " +
            "been added yet, so nothing can be marked watched.";
        }
        note.textContent = has && t.seasonsMissing
          ? plural(t.seasonsMissing, "season has", "seasons have") + " no episode data yet and " +
            (t.seasonsMissing === 1 ? "is" : "are") + " left out of these totals."
          : "";
        note.hidden = !note.textContent;

        rows.forEach(function (r, i) {
          var st = d.tv.shows[i].st;
          var any = st.total > 0;
          r.count.textContent = any
            ? st.done + " / " + st.total + " episodes \u00b7 " + pctPrecise(st.done, st.total)
            : UNAVAILABLE;
          r.count.classList.toggle("is-na", !any);
          r.bar.el.hidden = !any;
          if (any) setBar(r.bar, st.done, st.total);
          r.gap.hidden = !(any && (st.seasonsMissing || st.partial));
          r.a.classList.toggle("is-complete", !!st.complete);
        });
      }
    };
  }

  /* --------------------------------------------------- continue watching */

  function buildContinuePanel() {
    var list = h("ul", { class: "dash-list" });
    var empty = h("div", { class: "dash-empty" },
      h("strong", { class: "dash-empty-title" }),
      h("span", { class: "dash-empty-text" }));
    var more = h("a", { class: "dash-more", href: "#/tv" });
    var sig = null;

    var el = panelShell("continue", "Continue watching");
    el.appendChild(list);
    el.appendChild(empty);
    el.appendChild(more);
    el.appendChild(h("p", { class: "dash-note" },
      "TV only. Movies are either watched or not, so they never show partial progress."));

    return {
      el: el,
      sync: function (d) {
        var items = d.continuing.slice(0, CONTINUE_LIMIT);
        // Redraw only when something on screen would change.
        var s = d.continuing.length + "|" + items.map(function (x) {
          return x.show.id + ":" + x.st.done + "/" + x.st.total + ":" + x.next.ep.id;
        }).join("|");
        if (s === sig) return;
        sig = s;

        list.replaceChildren.apply(list, items.map(function (x) {
          var b = makeBar();
          setBar(b, x.st.done, x.st.total);
          return h("li", null,
            h("a", { class: "cw-row", href: seasonHref(x.show, x.next.season) },
              h("span", { class: "cw-top" },
                h("span", { class: "cw-title" }, x.show.title),
                h("span", { class: "cw-pct" }, pctPrecise(x.st.done, x.st.total))),
              h("span", { class: "cw-next" },
                "Continue: Season " + x.next.season.season + " \u00b7 Episode " + x.next.ep.episode + ", " + x.next.ep.title),
              b.el,
              h("span", { class: "cw-count" }, x.st.done + " / " + x.st.total + " episodes watched")));
        }));
        list.hidden = !items.length;

        empty.hidden = items.length > 0;
        if (!items.length) {
          empty.firstChild.textContent = d.tv.total ? "Nothing in progress" : "TV progress can\u2019t start yet";
          empty.lastChild.textContent = d.tv.total
            ? "Start a show and it will appear here."
            : "Episode data has not been added, so there are no episodes to continue.";
        }
        var extra = d.continuing.length - items.length;
        more.hidden = extra <= 0;
        if (extra > 0) more.textContent = "+ " + extra + " more in progress \u203a";
      }
    };
  }

  /* ---------------------------------------------------- recently watched */

  function buildRecentPanel() {
    var list = h("ul", { class: "dash-list" });
    var empty = h("div", { class: "dash-empty" },
      h("strong", { class: "dash-empty-title" }, "Nothing watched yet"),
      h("span", { class: "dash-empty-text" }, "Mark a movie or an episode as watched and it will show up here."));
    var sig = null;
    var times = []; // { el, at }: relative times are refreshed on every sync

    var el = panelShell("recent", "Recently watched");
    el.appendChild(list);
    el.appendChild(empty);

    function row(item) {
      var isMovie = item.kind === "movie";
      var when = h("time", { class: "rw-time" });
      if (item.at) when.setAttribute("datetime", new Date(item.at).toISOString());
      times.push({ el: when, at: item.at });
      var inner = [
        h("span", { class: "rw-tag" }, isMovie ? "Movie" : "TV"),
        h("span", { class: "rw-main" },
          h("span", { class: "rw-title" }, isMovie ? item.movie.title : item.ep.title),
          h("span", { class: "rw-sub" }, isMovie
            ? "Phase " + item.movie.phase + " \u00b7 " + year(item.movie.releaseDate)
            : item.show.title + " \u00b7 Season " + item.season.season + " \u00b7 Episode " + item.ep.episode)),
        when
      ];
      if (isMovie) {
        // The existing movie detail panel opens over the Dashboard.
        var btn = h("button", { type: "button", class: "rw-row", "aria-haspopup": "dialog" }, inner);
        btn.addEventListener("click", function () { openMovieModal(item.movie, btn); });
        return h("li", null, btn);
      }
      return h("li", null, h("a", { class: "rw-row", href: seasonHref(item.show, item.season) }, inner));
    }

    return {
      el: el,
      sync: function (d) {
        var s = d.recent.map(function (x) { return x.kind + ":" + x.id + "@" + x.at; }).join("|");
        if (s !== sig) {
          sig = s;
          times = [];
          list.replaceChildren.apply(list, d.recent.map(row));
          list.hidden = !d.recent.length;
          empty.hidden = d.recent.length > 0;
        }
        times.forEach(function (t) { t.el.textContent = timeAgo(t.at); });
      }
    };
  }

  /* ------------------------------------------------------ the page itself */

  var DASH_PANELS = [
    { key: "mission",  wide: true,  build: buildMissionPanel },
    { key: "nextup",   wide: true,  build: buildNextUpPanel },
    { key: "movies",   wide: false, build: buildMoviePanel },
    { key: "tv",       wide: false, build: buildTVPanel },
    { key: "continue", wide: false, build: buildContinuePanel },
    { key: "recent",   wide: false, build: buildRecentPanel }
  ];

  function renderDashboard() {
    var panels = DASH_PANELS.map(function (def, i) {
      var p = def.build();
      p.el.classList.toggle("is-wide", !!def.wide);
      p.el.style.setProperty("--i", i);
      return p;
    });

    var head = h("header", { class: "dash-head" },
      h("div", { class: "dash-heading" },
        h("p", { class: "dash-eyebrow" }, h("span", { class: "dash-dot", "aria-hidden": "true" }), "J.A.R.V.I.S. \u00b7 Online"),
        h("h1", { class: "dash-title" }, "Command Center")),
      h("div", { class: "dash-head-side" },
        h("div", { class: "dash-modes" }), // reserved slot for mode controls
        h("p", { class: "dash-chip" },
          h("span", { class: "dash-chip-key" }, "Sequence"),
          h("strong", null, orderDef(watchOrder).label))));

    var notice = persistNotice();
    view = { kind: "dashboard", panels: panels, notice: notice };
    app.replaceChildren(notice, head,
      h("div", { class: "dash-grid" + (dashEnter ? " is-entering" : "") }, panels.map(function (p) { return p.el; })));
    syncDashboard();
  }

  // Recompute from the store and update the page in place (no re-render, so
  // scroll position and focus never jump).
  function syncDashboard() {
    var v = view;
    if (!v || v.kind !== "dashboard") return;
    var d = computeDashboard();
    v.panels.forEach(function (p) { p.sync(d); });
    v.notice.hidden = Store.persistent;
    syncOpenModal();
  }

  /* ------------------------------------------------- timeline + watchlist */

  // Both pages list the same kind of entry: one MCU movie, one TV season, or
  // (watchlist only) a whole TV show. Nothing about them is saved here except
  // the watchlist keys held by the Store. Watched state and TV progress are
  // derived from the existing watch data every time a page syncs, and both
  // pages take their order from the existing sequence() (the WATCH ORDER
  // selector), never from a second ordering.

  function pageHead(title) {
    return h("header", { class: "dash-head" },
      h("div", { class: "dash-heading" }, h("h1", { class: "dash-title" }, title)),
      h("div", { class: "dash-head-side" },
        h("p", { class: "dash-chip" },
          h("span", { class: "dash-chip-key" }, "Sequence"),
          h("strong", null, orderDef(watchOrder).label))));
  }

  function movieEntry(m) {
    return { type: "movie", key: wlKey("movie", m.id), title: m.title, movie: m,
             phaseText: "Phase " + m.phase, date: m.releaseDate };
  }
  function seasonEntry(show, se) {
    return { type: "tv", key: wlKey("season", se.id), title: show.title, show: show, season: se,
             href: seasonHref(show, se), phaseText: "Phase " + se.phase, date: se.releaseDate,
             label: "Season " + se.season };
  }
  function showEntry(show) {
    return { type: "tv", key: wlKey("tv", show.id), title: show.title, show: show, season: null,
             href: "#/tv/" + encodeURIComponent(show.id), phaseText: showPhases(show),
             label: plural(show.seasons.length, "season", "seasons") };
  }

  var LEVEL_TEXT = { done: "Watched", part: "In progress", none: "Not watched" };

  // Watched state and TV progress for one entry, from the watch data only.
  //   movie          watched or not
  //   season / show  "done" only when every episode is watched (seasonStats /
  //                  showStats), "part" once any episode is, and no progress
  //                  at all (just "Episode data unavailable") when the
  //                  episode records have not been added.
  function entryState(e) {
    if (e.movie) {
      return { level: Store.isWatched("movies", e.movie.id) ? "done" : "none", progress: null };
    }
    var st = e.season ? seasonStats(e.season) : showStats(e.show);
    var has = e.season ? st.state !== "none" : st.total > 0;
    if (!has) return { level: "none", progress: UNAVAILABLE, na: true, pct: 0, note: "" };
    var gaps = e.season ? st.state === "partial" : (st.seasonsMissing > 0 || st.partial);
    return {
      level: st.complete ? "done" : st.done > 0 ? "part" : "none",
      progress: st.done + " / " + st.total + " episodes \u00b7 " + pctWhole(st.done, st.total),
      na: false, pct: pctOf(st.done, st.total),
      note: gaps ? "Some episode data missing" : ""
    };
  }

  function entryPoster(e, extra) {
    if (e.movie) return posterBlock(e.movie, extra);
    if (e.season) return seasonThumb(e.show, e.season, extra);
    return posterBlock(e.show, extra);
  }

  function checkBadge() { return h("span", { class: "badge", "aria-hidden": "true" }, "\u2713"); }

  /* ------------------------------------------------------------- timeline */

  // One row. A movie opens the existing movie detail panel; a TV season opens
  // the existing TV page with that season expanded.
  function buildTimelineRow(e) {
    var stateEl = h("span", { class: "tl-state" });
    var progEl = h("span", { class: "tl-progress" });
    var bar = makeBar();
    var noteEl = h("span", { class: "tl-note" });
    var subParts = e.movie ? [e.phaseText] : [e.label, e.phaseText];

    var inner = [
      h("span", { class: "tl-poster" }, entryPoster(e)),
      h("span", { class: "tl-body" },
        h("span", { class: "tl-title" }, e.title),
        // Shown above the title, but after it in the source, so a screen
        // reader announces the title first.
        h("span", { class: "tl-kicker" },
          h("span", { class: "rw-tag" }, e.movie ? "Movie" : "TV"),
          h("time", { class: "tl-date", datetime: e.date }, fmtDate(e.date))),
        h("span", { class: "tl-sub" }, dotted(subParts)),
        progEl, bar.el, noteEl),
      stateEl
    ];

    var card;
    if (e.movie) {
      card = h("button", { type: "button", class: "tl-card", "aria-haspopup": "dialog" }, inner);
      card.addEventListener("click", function () { openMovieModal(e.movie, card); });
    } else {
      card = h("a", { class: "tl-card", href: e.href }, inner);
    }
    var li = h("li", { class: "tl-item" }, card);

    return {
      el: li,
      sync: function () {
        var s = entryState(e);
        li.classList.toggle("is-watched", s.level === "done");
        li.classList.toggle("is-part", s.level === "part");
        stateEl.textContent = LEVEL_TEXT[s.level];
        stateEl.classList.toggle("is-done", s.level === "done");
        stateEl.classList.toggle("is-part", s.level === "part");
        progEl.hidden = s.progress === null;
        progEl.textContent = s.progress || "";
        progEl.classList.toggle("is-na", !!s.na);
        bar.el.hidden = s.progress === null || !!s.na;
        if (!bar.el.hidden) bar.fill.style.width = s.pct + "%";
        noteEl.textContent = s.note || "";
        noteEl.hidden = !s.note;
      }
    };
  }

  function renderTimeline() {
    var units = sequence(watchOrder); // every MCU movie and TV season, in the selected order
    var rows = units.map(function (u) {
      return buildTimelineRow(u.kind === "movie" ? movieEntry(u.movie) : seasonEntry(u.show, u.season));
    });
    var movies = units.filter(function (u) { return u.kind === "movie"; }).length;

    // X-Men: its own block further down the SAME Timeline page, in the same
    // selected order, built with the exact same buildTimelineRow()/
    // movieEntry() used above -- not a second timeline page or component.
    // It cannot be interleaved into the `units` list above without breaking
    // the MCU+TV order: X-Men's order fields are their own independent
    // numeric scale (see xsequence() and data-movies-xmen.js), so comparing
    // them directly against MCU/TV order values would sort by coincidental
    // numeric collisions rather than real time or story order.
    var xUnits = xsequence(watchOrder);
    var xRows = xUnits.map(function (m) { return buildTimelineRow(movieEntry(m)); });

    var notice = persistNotice();
    view = { kind: "timeline", rows: rows.concat(xRows), notice: notice };

    app.replaceChildren(
      notice,
      pageHead("Timeline"),
      h("p", { class: "section-note" },
        (watchOrder === "chronological"
          ? "Every MCU movie and TV season in the order they happen on Marvel\u2019s official MCU timeline. "
          : "Every MCU movie and TV season in the order they came out. ") +
        plural(units.length, "title", "titles") + ": " + plural(movies, "movie", "movies") + " and " +
        plural(units.length - movies, "TV season", "TV seasons") + "."),
      h("ol", { class: "tl-list" }, rows.map(function (r) { return r.el; })),
      xUnits.length ? h("h2", { class: "phase-title", style: "margin-top:36px" }, "X-Men Timeline") : null,
      xUnits.length ? h("p", { class: "section-note" },
        (watchOrder === "chronological"
          ? "Every X-Men movie in the order they happen in the X-Men story timeline. "
          : "Every X-Men movie in the order they came out. ") +
        plural(xUnits.length, "movie", "movies") + ".") : null,
      xUnits.length ? h("ol", { class: "tl-list" }, xRows.map(function (r) { return r.el; })) : null);
    syncTimeline();
  }

  function syncTimeline() {
    var v = view;
    if (!v || v.kind !== "timeline") return;
    v.rows.forEach(function (r) { r.sync(); });
    v.notice.hidden = Store.persistent;
    syncOpenModal();
  }

  /* ------------------------------------------------------------ watchlist */

  var WL_FILTERS = [
    { key: "all",   label: "All" },
    { key: "movie", label: "Movies" },
    { key: "tv",    label: "TV" }
  ];
  var watchFilter = "all"; // which filter is showing; reset when you arrive on the page

  // Everything on the watchlist, in the selected watch order. A whole show is
  // placed where its earliest season falls in that order, just ahead of that
  // season's own entry. Keys that match nothing in the data are ignored.
  function watchlistItems() {
    var out = [], seen = {};
    sequence(watchOrder).forEach(function (u) {
      if (u.kind === "movie") {
        if (Store.inWatchlist(wlKey("movie", u.id))) out.push(movieEntry(u.movie));
        return;
      }
      if (!seen[u.show.id]) {
        seen[u.show.id] = true;
        if (Store.inWatchlist(wlKey("tv", u.show.id))) out.push(showEntry(u.show));
      }
      if (Store.inWatchlist(wlKey("season", u.id))) out.push(seasonEntry(u.show, u.season));
    });
    // X-Men: same wlKey("movie", id) scheme, same watchlist store -- just a
    // second pass over xsequence() since X-Men isn't part of sequence().
    xsequence(watchOrder).forEach(function (m) {
      if (Store.inWatchlist(wlKey("movie", m.id))) out.push(movieEntry(m));
    });
    return out;
  }

  function buildWatchlistCard(e) {
    var stateEl = h("span", { class: "sub wl-state" });
    var progEl = h("span", { class: "sub tv-progress" });
    var noteEl = h("span", { class: "sub tv-progress-note" });
    var typeParts = e.movie ? ["Movie", e.phaseText] : ["TV", e.label, e.phaseText];

    var inner = [
      entryPoster(e, [checkBadge()]),
      h("span", { class: "meta" },
        h("span", { class: "title" }, e.title),
        h("span", { class: "sub" }, dotted(typeParts)),
        stateEl, progEl, noteEl)
    ];

    var card;
    if (e.movie) {
      card = h("button", {
        type: "button", class: "card", "aria-haspopup": "dialog", dataset: { key: e.key },
        title: e.title + " (" + fmtDate(e.movie.releaseDate) + "). " + e.movie.description
      }, inner);
      card.addEventListener("click", function () { openMovieModal(e.movie, card); });
    } else {
      card = h("a", {
        class: "card", href: e.href, dataset: { key: e.key },
        title: e.title + (e.season ? ", season " + e.season.season : "") + ". " + e.show.description
      }, inner);
    }

    return {
      key: e.key,
      el: card,
      sync: function () {
        var s = entryState(e);
        card.classList.toggle("is-watched", s.level === "done");
        stateEl.textContent = LEVEL_TEXT[s.level];
        stateEl.classList.toggle("is-done", s.level === "done");
        stateEl.classList.toggle("is-part", s.level === "part");
        progEl.hidden = s.progress === null;
        progEl.textContent = s.progress || "";
        noteEl.textContent = s.note || "";
        noteEl.hidden = !s.note;
      }
    };
  }

  function watchlistEmpty(totalSaved) {
    var title, text, links = [];
    if (!totalSaved) {
      title = "Your watchlist is empty";
      text = "Open a movie, a TV show or a season and press Add to watchlist to save it here. " +
        "Adding something does not mark it watched.";
      links = [h("a", { class: "dash-more", href: "#/movies" }, "Browse movies \u203a"),
               h("a", { class: "dash-more", href: "#/tv" }, "Browse TV shows \u203a")];
    } else {
      title = watchFilter === "movie" ? "No movies on your watchlist" : "No TV on your watchlist";
      text = "Choose All to see everything you have saved.";
    }
    return h("div", { class: "dash-empty wl-empty" },
      h("strong", { class: "dash-empty-title" }, title),
      h("span", { class: "dash-empty-text" }, text),
      links.length ? h("span", { class: "wl-empty-links" }, links) : null);
  }

  function renderWatchlist() {
    var host = h("div", { class: "wl-results" });
    var buttons = {};
    var bar = h("div", { class: "filter-row", role: "group", "aria-label": "Filter watchlist" },
      WL_FILTERS.map(function (f) {
        var count = h("span", { class: "filter-count" });
        var btn = h("button", { type: "button", class: "filter-btn", "aria-pressed": "false" }, f.label, count);
        btn.addEventListener("click", function () {
          if (watchFilter === f.key) return;
          watchFilter = f.key;
          syncWatchlist();
          var n = view && view.kind === "watchlist" ? view.shownCount : 0;
          announce("Showing " + f.label.toLowerCase() + " on your watchlist: " + n + (n === 1 ? " item." : " items."));
        });
        buttons[f.key] = { btn: btn, count: count };
        return btn;
      }));

    var notice = persistNotice();
    view = { kind: "watchlist", host: host, buttons: buttons, cards: [], sig: null, shownCount: 0, notice: notice };
    app.replaceChildren(
      notice,
      pageHead("My Watchlist"),
      h("p", { class: "section-note" },
        "Titles you have saved for later, in the selected watch order. The watchlist is separate from " +
        "watched progress: saving a title does not mark it watched, and watching it does not remove it."),
      bar,
      host);
    syncWatchlist();
  }

  // Redraw only when the visible set of cards changes; otherwise update the
  // existing cards in place (no scroll jump, focus stays where it is).
  function syncWatchlist() {
    var v = view;
    if (!v || v.kind !== "watchlist") return;

    var all = watchlistItems();
    var counts = { all: all.length, movie: 0, tv: 0 };
    all.forEach(function (e) { counts[e.type]++; });
    WL_FILTERS.forEach(function (f) {
      var b = v.buttons[f.key];
      b.count.textContent = String(counts[f.key]);
      b.btn.classList.toggle("is-on", watchFilter === f.key);
      b.btn.setAttribute("aria-pressed", watchFilter === f.key ? "true" : "false");
    });

    var shown = all.filter(function (e) { return watchFilter === "all" || e.type === watchFilter; });
    v.shownCount = shown.length;
    var sig = watchFilter + "|" + shown.map(function (e) { return e.key; }).join(",");
    if (sig !== v.sig) {
      v.sig = sig;
      v.cards = shown.map(buildWatchlistCard);
      if (v.cards.length) {
        v.host.replaceChildren(h("div", { class: "grid" }, v.cards.map(function (c) { return c.el; })));
      } else {
        v.host.replaceChildren(watchlistEmpty(all.length));
      }
    }
    v.cards.forEach(function (c) { c.sync(); });

    v.notice.hidden = Store.persistent;
    syncOpenModal();
  }

  /* -------------------------------------------------------------- search */

  // Search looks across every MCU movie and TV season (and, when a season
  // lists them, its episode titles). It reuses the SAME entry shape as
  // Timeline/Watchlist (movieEntry / seasonEntry, just above) and the exact
  // watchlist card renderer, so a result looks and behaves like everywhere
  // else in the app: click a movie to open the existing movie panel, click a
  // season to open the existing show page with that season in view. Search
  // never reads or writes watched state or the watchlist, and it orders
  // results using the SAME sequence() the rest of the app uses, so it always
  // matches the current WATCH ORDER selection -- there is no second ordering
  // system here.

  var SEARCH_TYPE_FILTERS = [
    { key: "all", label: "All" },
    { key: "movie", label: "Movies" },
    { key: "tv", label: "TV" }
  ];
  var SEARCH_WATCH_FILTERS = [
    { key: "all", label: "All" },
    { key: "watched", label: "Watched" },
    { key: "unwatched", label: "Unwatched" }
  ];
  // Every phase actually present in the data, so the filter never offers a
  // phase with nothing in it and never needs updating by hand.
  var SEARCH_PHASES = (function () {
    var seen = {};
    MOVIES.forEach(function (m) { seen[m.phase] = true; });
    TV.forEach(function (s) { s.seasons.forEach(function (se) { seen[se.phase] = true; }); });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  })();
  var SEARCH_PHASE_FILTERS = [{ key: "all", label: "All phases" }].concat(
    SEARCH_PHASES.map(function (p) { return { key: String(p), label: "Phase " + p }; }));

  // UI state only -- never saved, never touches Store. Reset to "all" every
  // fresh arrival on the page (see route()); searchQuery is left alone since
  // it mirrors the always-visible search box in the toolbar.
  var searchQuery = "";
  var searchType = "all";
  var searchWatch = "all";
  var searchPhase = "all";

  // Every movie and TV season as one flat, searchable list. Rebuilt on every
  // search (the dataset is tiny -- well under a hundred entries -- so this
  // stays fast without any caching or extra libraries).
  function searchEntries() {
    // X-Men movies use the same movieEntry() shape as MCU movies, so every
    // existing searchable field (title, type, watched state) already works
    // on them with no new code -- see searchResults() below for how their
    // rank/order is worked out, since they aren't part of sequence().
    var out = MOVIES.map(movieEntry).concat(XMOVIES.map(movieEntry));
    TV.forEach(function (s) {
      s.seasons.forEach(function (se) { out.push(seasonEntry(s, se)); });
    });
    return out;
  }

  function searchEntryPhase(e) { return e.movie ? e.movie.phase : e.season.phase; }

  // Title, season number, and (when the season has them) episode titles --
  // joined and lower-cased once per entry per keystroke.
  function searchHaystack(e) {
    var parts;
    if (e.movie) {
      parts = [e.movie.title];
    } else {
      parts = [e.show.title, "season " + e.season.season, String(e.season.season)];
      (e.season.episodes || []).forEach(function (ep) { parts.push(ep.title); });
    }
    return parts.join(" \u2022 ").toLowerCase();
  }

  function matchesSearchFilters(e) {
    if (searchType !== "all" && e.type !== searchType) return false;
    if (searchPhase !== "all" && String(searchEntryPhase(e)) !== searchPhase) return false;
    if (searchWatch !== "all") {
      var watched = entryState(e).level === "done";
      if (searchWatch === "watched" && !watched) return false;
      if (searchWatch === "unwatched" && watched) return false;
    }
    return true;
  }

  function matchesSearchQuery(e) {
    var q = searchQuery.trim().toLowerCase();
    return !q || searchHaystack(e).indexOf(q) !== -1;
  }

  // True once the person has typed something or changed a filter away from
  // "All". Below this, the page shows a prompt instead of every title in the
  // tracker -- Search is for finding something specific, not another browse
  // page.
  function searchIsActive() {
    return searchQuery.trim() !== "" || searchType !== "all" || searchWatch !== "all" || searchPhase !== "all";
  }

  function searchResults() {
    if (!searchIsActive()) return [];
    var order = sequence(watchOrder).map(function (u) { return u.id; });
    var rank = {};
    order.forEach(function (id, i) { rank[id] = i; });
    // X-Men results are ranked after every MCU/TV result, in X-Men's own
    // watch order -- appended rather than interleaved for the same reason
    // xsequence() is kept separate from sequence() (see its comment above):
    // the two universes' order fields are not on a shared numeric scale.
    xsequence(watchOrder).forEach(function (m, i) { rank[m.id] = order.length + i; });
    return searchEntries()
      .filter(matchesSearchFilters)
      .filter(matchesSearchQuery)
      .sort(function (a, b) {
        var ra = rank[a.season ? a.season.id : a.movie.id];
        var rb = rank[b.season ? b.season.id : b.movie.id];
        return ra - rb;
      });
  }

  function searchEmptyState(active) {
    if (!active) {
      return h("div", { class: "dash-empty" },
        h("strong", { class: "dash-empty-title" }, "Search your tracker"),
        h("span", { class: "dash-empty-text" },
          "Type a movie, show, season or episode title above, or use a filter to browse."));
    }
    return h("div", { class: "dash-empty" },
      h("strong", { class: "dash-empty-title" }, "No results found"),
      h("span", { class: "dash-empty-text" }, "Try a different search term, or clear a filter."));
  }

  // One row of filter buttons. get/set point at the module-level filter
  // variable above; sync() re-paints which button is pressed after either
  // one changes.
  function searchFilterRow(label, filters, get, set) {
    var buttons = {};
    var el = h("div", { class: "filter-row", role: "group", "aria-label": label },
      filters.map(function (f) {
        var btn = h("button", { type: "button", class: "filter-btn" }, f.label);
        btn.addEventListener("click", function () {
          if (get() === f.key) return;
          set(f.key);
          syncSearch();
        });
        buttons[f.key] = btn;
        return btn;
      }));
    return {
      el: el,
      sync: function () {
        filters.forEach(function (f) {
          var on = get() === f.key;
          buttons[f.key].classList.toggle("is-on", on);
          buttons[f.key].setAttribute("aria-pressed", on ? "true" : "false");
        });
      }
    };
  }

  function renderSearch() {
    var typeRow = searchFilterRow("Filter by type", SEARCH_TYPE_FILTERS,
      function () { return searchType; }, function (k) { searchType = k; });
    var watchRow = searchFilterRow("Filter by watched state", SEARCH_WATCH_FILTERS,
      function () { return searchWatch; }, function (k) { searchWatch = k; });
    var phaseRow = searchFilterRow("Filter by phase", SEARCH_PHASE_FILTERS,
      function () { return searchPhase; }, function (k) { searchPhase = k; });

    var countEl = h("p", { class: "section-note", role: "status", "aria-live": "polite" });
    var host = h("div", { class: "wl-results" });
    var notice = persistNotice();

    view = {
      kind: "search", host: host, countEl: countEl, notice: notice,
      typeRow: typeRow, watchRow: watchRow, phaseRow: phaseRow,
      cards: [], sig: null
    };

    app.replaceChildren(
      notice,
      pageHead("Search"),
      h("div", { class: "search-filters" }, typeRow.el, watchRow.el, phaseRow.el),
      countEl,
      host);
    syncSearch();
  }

  // Redraw only when the visible set of results changes; otherwise update the
  // existing cards in place. Called on every keystroke and every filter
  // click, so this stays as cheap as the Watchlist page's own sync.
  function syncSearch() {
    var v = view;
    if (!v || v.kind !== "search") return;

    v.typeRow.sync();
    v.watchRow.sync();
    v.phaseRow.sync();

    var active = searchIsActive();
    var results = searchResults();
    var q = searchQuery.trim();

    v.countEl.textContent = !active
      ? "Search across movies, TV shows, seasons and episodes."
      : plural(results.length, "result", "results") + (q ? " for \u201c" + q + "\u201d" : " for the selected filters");

    var sig = q.toLowerCase() + "|" + searchType + "|" + searchWatch + "|" + searchPhase + "|" +
      results.map(function (e) { return e.key; }).join(",");
    if (sig !== v.sig) {
      v.sig = sig;
      if (results.length) {
        v.cards = results.map(buildWatchlistCard);
        v.host.replaceChildren(h("div", { class: "grid" }, v.cards.map(function (c) { return c.el; })));
      } else {
        v.cards = [];
        v.host.replaceChildren(searchEmptyState(active));
      }
    }
    v.cards.forEach(function (c) { c.sync(); });

    v.notice.hidden = Store.persistent;
    syncOpenModal();
  }

  /* ---------------------------------------------------------------- router */

  var tabs = [].slice.call(document.querySelectorAll(".tab"));

  // Routes: #/dashboard (home; also an empty or unknown address), #/movies,
  // #/tv (the list), #/tv/<show-id> (one show), and
  // #/tv/<show-id>/<season-number> (one show with that season opened),
  // #/timeline, #/watchlist and #/search.
  var ROUTE_NAMES = ["tv", "movies", "timeline", "watchlist", "search"];
  function parseHash() {
    var parts = window.location.hash.replace(/^#\/?/, "").split("/");
    var out = {
      name: ROUTE_NAMES.indexOf(parts[0]) !== -1 ? parts[0] : "dashboard",
      showId: null, seasonNum: null
    };
    if (out.name === "tv" && parts[1]) {
      try { out.showId = decodeURIComponent(parts[1]); } catch (e) { out.showId = parts[1]; }
      if (parts[2] && Number(parts[2]) > 0) out.seasonNum = Number(parts[2]);
    }
    return out;
  }

  function renderRoute() {
    var r = parseHash();
    if (r.name === "tv") {
      if (r.showId) renderShow(r.showId); else renderTV();
    } else if (r.name === "movies") {
      renderMovies();
    } else if (r.name === "timeline") {
      renderTimeline();
    } else if (r.name === "watchlist") {
      renderWatchlist();
    } else if (r.name === "search") {
      renderSearch();
    } else {
      renderDashboard();
    }
  }

  function route() {
    var r = parseHash();
    var leaving = view; // what was on screen before this navigation

    closeModal();

    tabs.forEach(function (t) {
      if (t.getAttribute("data-route") === r.name) t.setAttribute("aria-current", "page");
      else t.removeAttribute("aria-current");
    });

    var showRec = null;
    if (r.showId) TV.forEach(function (s) { if (s.id === r.showId) showRec = s; });
    if (r.name === "dashboard") document.title = "Command Center | Marvel Mission Control";
    else if (r.name === "movies") document.title = "Movies | Marvel Mission Control";
    else if (r.name === "timeline") document.title = "Timeline | Marvel Mission Control";
    else if (r.name === "watchlist") document.title = "Watchlist | Marvel Mission Control";
    else if (r.name === "search") document.title = "Search | Marvel Mission Control";
    else if (showRec) document.title = showRec.title + " | TV Shows | Marvel Mission Control";
    else document.title = "TV Shows | Marvel Mission Control";

    // Every arrival on a page starts with its seasons collapsed. Only a season
    // named in the address opens. (A watch-order change re-renders in place
    // without coming through here, so the seasons you opened stay open.)
    openSeasons = {};
    if (showRec && r.seasonNum) {
      showRec.seasons.forEach(function (se) { if (se.season === r.seasonNum) openSeasons[se.id] = true; });
    }

    if (r.name === "watchlist") watchFilter = "all"; // each arrival starts on All
    // Each arrival on Search starts its filters on All too; the typed query
    // is left alone since it mirrors the always-visible search box.
    if (r.name === "search") { searchType = "all"; searchWatch = "all"; searchPhase = "all"; }

    dashEnter = true; // a fresh arrival on the Dashboard fades its panels in
    renderRoute();
    dashEnter = false;
    window.scrollTo(0, 0);

    if (showRec) {
      // New page: put keyboard and screen-reader focus at the top of it, or on
      // the season the address points at.
      var target = null;
      if (r.seasonNum && view && view.kind === "show") {
        view.refs.seasons.forEach(function (x) { if (x.se.season === r.seasonNum) target = x; });
      }
      if (target) {
        target.box.scrollIntoView();
        target.toggle.focus({ preventScroll: true });
      } else {
        app.focus({ preventScroll: true });
      }
    } else if (r.name === "tv" && leaving && leaving.kind === "show") {
      // Back from a show: return focus to that show's card in the list.
      var back = app.querySelector('a.card[data-show="' + leaving.showId + '"]');
      if (back) back.focus();
    }
  }

  /* ------------------------------------------------------------------ boot */

  // Includes X-Men: this badge counts every movie card actually shown on
  // the Movies page (MCU section + X-Men section), not MCU progress.
  document.getElementById("tab-count-movies").textContent = String(ALL_MOVIES.length);
  document.getElementById("tab-count-tv").textContent = String(TV.length);

  document.getElementById("reset-movies").addEventListener("click", function () {
    if (window.confirm("Clear every watched movie? This cannot be undone.")) {
      Store.reset("movies"); // Store.subscribe below re-syncs the UI
      settingsStatus("Movie progress cleared.");
    }
  });

  document.getElementById("reset-tv").addEventListener("click", function () {
    if (window.confirm("Clear every watched TV episode? This cannot be undone.")) {
      Store.reset("episodes");
      Store.reset("seasons");
      settingsStatus("TV progress cleared.");
    }
  });

  document.getElementById("reset-all").addEventListener("click", function () {
    if (window.confirm("Clear ALL watched movies and TV episodes? Your watchlist and settings are kept. This cannot be undone.")) {
      Store.reset("movies");
      Store.reset("episodes");
      Store.reset("seasons");
      settingsStatus("All watched progress cleared.");
    }
  });

  function settingsStatus(text) {
    var el = document.getElementById("settings-status");
    if (el) el.textContent = text;
  }

  // EXPORT: write the whole saved state (movies, episodes, watchlist, prefs)
  // out as a JSON file the person can keep or move to another browser.
  document.getElementById("export-progress").addEventListener("click", function () {
    try {
      var data = Store.exportData();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      var stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = "marvel-mission-control-backup-" + stamp + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      settingsStatus("Progress exported.");
    } catch (e) {
      settingsStatus("Export failed. Your browser may be blocking downloads.");
    }
  });

  // IMPORT: pick a previously exported file, validate its shape, and only
  // then replace the store. Never partially applies a bad file.
  var importInput = document.getElementById("import-file-input");
  document.getElementById("import-progress").addEventListener("click", function () {
    importInput.click();
  });
  importInput.addEventListener("change", function () {
    var file = importInput.files && importInput.files[0];
    importInput.value = ""; // allow re-selecting the same file later
    if (!file) return;
    if (!window.confirm("Import progress from \"" + file.name + "\"? This replaces all current progress, watchlist and settings.")) {
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (e) {
        settingsStatus("Import failed: that file isn't valid JSON.");
        return;
      }
      var result = Store.importData(parsed);
      if (result.ok) {
        settingsStatus("Progress imported.");
      } else {
        settingsStatus("Import failed: " + result.reason);
      }
    };
    reader.onerror = function () {
      settingsStatus("Import failed: couldn't read that file.");
    };
    reader.readAsText(file);
  });

  // WATCH ORDER selector. Its options come from ORDERS; changing it saves the
  // choice in the store, and the subscriber below re-renders in place.
  var orderSelect = document.getElementById("watch-order");
  var orderStatus = document.getElementById("order-status");
  ORDERS.forEach(function (o) {
    orderSelect.appendChild(h("option", { value: o.key }, o.label));
  });
  orderSelect.value = watchOrder;
  orderSelect.addEventListener("change", function () {
    if (isOrderKey(orderSelect.value)) Store.setPref("watchOrder", orderSelect.value);
  });

  // Global search box (lives in the toolbar, visible on every page). Typing
  // the first character jumps to the Search page without touching focus, so
  // typing continues uninterrupted; every character after that just updates
  // the results in place. This never reads from or writes to the store.
  var searchInput = document.getElementById("global-search");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      searchQuery = searchInput.value;
      if (parseHash().name === "search") {
        syncSearch();
      } else {
        window.location.hash = "#/search"; // route() renders with searchQuery already set
      }
    });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (searchInput.value) {
        e.preventDefault();
        searchInput.value = "";
        searchQuery = "";
        if (parseHash().name === "search") syncSearch();
      } else {
        searchInput.blur();
      }
    });
  }

  // Single place that reacts to any change in the store: a toggle or reset
  // made here, the modal's own button, a new watch order, or another tab
  // writing the same localStorage key. Keeps exactly one storage system in sync.
  Store.subscribe(function () {
    var saved = storedOrder();
    if (saved !== watchOrder) {
      watchOrder = saved;
      orderSelect.value = saved;
      orderStatus.textContent = "Showing " + orderDef(saved).label.toLowerCase();
      renderRoute(); // in place: no reload, no scroll jump
      return;
    }
    if (!view) return;
    if (view.kind === "movies") syncMovies();
    else if (view.kind === "tv") syncTV();
    else if (view.kind === "show") syncShow();
    else if (view.kind === "dashboard") syncDashboard();
    else if (view.kind === "timeline") syncTimeline();
    else if (view.kind === "watchlist") syncWatchlist();
    else if (view.kind === "search") syncSearch();
  });

  // Escape leaves a TV show page and goes back to the list (the movie modal
  // closes itself on Escape). Ignored inside the watch order menu.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (!view || (view.kind !== "show" && view.kind !== "show-missing")) return;
    if (modal && !modal.overlay.hidden) return;
    if (e.target && e.target.tagName === "SELECT") return;
    e.preventDefault();
    window.location.hash = "#/tv";
  });

  window.addEventListener("hashchange", route);
  validateData();
  route();
})();
