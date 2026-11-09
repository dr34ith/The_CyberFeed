/* Videos tab: latest cybersecurity news/education videos from YouTube channel feeds
   (videos.json, written by fetch_feeds.py). Plays in-app via youtube-nocookie.
   IDs are validated before use; DOM is built with CF.el (no innerHTML). */
(function () {
  "use strict";
  const el = window.CF && window.CF.el;
  if (!el) return;
  const $ = (id) => document.getElementById(id);
  const VIDEO_RE = /^[\w-]{11}$/;
  const PAGE = 24;
  const ui = { topic: "All", search: "", shown: PAGE };
  let data = null, loaded = false, pending = null, timer = null;
  const FRESH = 48 * 3600 * 1000;
  const isNew = (v) => Date.now() - ts(v.published) < FRESH;

  const ts = (d) => { const t = Date.parse(d); return Number.isFinite(t) ? t : 0; };
  const doneKey = (v) => "v:" + v.id;
  const isDone = (k) => !!(window.CFDone && window.CFDone.isDone(k));

  function ago(d) {
    const t = ts(d); if (!t) return "";
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + "m ago";
    if (s < 86400) return Math.round(s / 3600) + "h ago";
    if (s < 86400 * 60) return Math.round(s / 86400) + "d ago";
    return new Date(t).toISOString().slice(0, 10);
  }
  function views(n) { return typeof n === "number" ? (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n)) + " views" : ""; }
  const valid = (v) => !!v && VIDEO_RE.test(v.id) && !!v.title;
  const list = () => ((data && data.items) || []).filter(valid);

  function thumbUrl(v) {
    // Only trust https thumbnails from YouTube's image hosts; otherwise build the standard one.
    try { const u = new URL(v.thumb); if (u.protocol === "https:" && /(^|\.)ytimg\.com$/.test(u.hostname)) return u.href; } catch (e) {}
    return "https://i.ytimg.com/vi/" + v.id + "/hqdefault.jpg";
  }

  function filtered() {
    const q = ui.search.trim().toLowerCase();
    return list().filter((v) =>
      (ui.topic === "All" || (ui.topic === "Watched" ? isDone(doneKey(v)) : v.topic === ui.topic)) &&
      (!q || v.title.toLowerCase().includes(q) || (v.channel || "").toLowerCase().includes(q)));
  }

  function renderFilters() {
    const wrap = $("video-filters"); if (!wrap) return;
    wrap.replaceChildren();
    const topics = Array.from(new Set(list().map((v) => v.topic).filter(Boolean))).sort();
    ["All"].concat(topics, ["Watched"]).forEach((t) => wrap.appendChild(el("button", {
      class: "chip-btn" + (t === ui.topic ? " active" : ""), type: "button", text: t,
      onclick: () => { ui.topic = t; ui.shown = PAGE; renderFilters(); renderGrid(); },
    })));
  }

  function card(v) {
    return el("button", { class: "course-card" + (isDone(doneKey(v)) ? " is-done" : ""), type: "button", onclick: () => play(v) }, [
      el("div", { class: "course-media" }, [
        el("img", { class: "course-thumb", src: thumbUrl(v), alt: "", loading: "lazy" }),
        el("span", { class: "course-play", text: "▶" }),
        isNew(v) ? el("span", { class: "new-badge", text: "NEW" }) : null,
      ]),
      el("div", { class: "course-body" }, [
        el("div", { class: "shelf-detail-cat", text: (v.topic || "Video") }),
        el("div", { class: "course-title", text: v.title }),
        el("div", { class: "course-channel", text: [v.channel, ago(v.published), views(v.views)].filter(Boolean).join(" · ") }),
      ]),
    ]);
  }

  function renderJustDropped() {
    const box = $("just-dropped"), row = $("just-dropped-row"); if (!box) return;
    row.replaceChildren();
    const fresh = list().filter(isNew).sort((a, b) => ts(b.published) - ts(a.published)).slice(0, 8);
    box.hidden = !fresh.length;
    fresh.forEach((v) => row.appendChild(card(v)));
  }

  function renderGrid() {
    const grid = $("video-grid"); if (!grid) return;
    grid.replaceChildren();
    const all = filtered();
    if (!loaded) grid.appendChild(el("p", { class: "shelf-empty", text: "Loading videos…" }));
    else if (!list().length) grid.appendChild(el("p", { class: "shelf-empty", text: "No videos yet. Run python fetch_feeds.py to generate videos.json (the GitHub Action does this automatically)." }));
    else if (!all.length) grid.appendChild(el("p", { class: "shelf-empty", text: ui.topic === "Watched" ? "Nothing marked as watched yet." : "No videos match." }));
    all.slice(0, ui.shown).forEach((v) => grid.appendChild(card(v)));
    $("video-more").hidden = all.length <= ui.shown;
    renderJustDropped();
  }

  function play(v) {
    const box = $("video-player"); if (!box || !valid(v)) return;
    box.replaceChildren();
    box.hidden = false;
    const frame = el("iframe", {
      class: "course-frame", src: "https://www.youtube-nocookie.com/embed/" + v.id + "?rel=0&autoplay=1", title: v.title,
      allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", referrerpolicy: "strict-origin-when-cross-origin",
    });
    box.append(
      el("div", { class: "course-frame-wrap" }, [frame]),
      el("div", { class: "course-player-bar" }, [
        el("div", {}, [el("strong", { text: v.title }), el("div", { class: "course-channel", text: [v.channel, ago(v.published)].filter(Boolean).join(" · ") })]),
        el("div", { class: "course-player-actions" }, [
          window.CFDone ? window.CFDone.button(doneKey(v)) : null,
          el("a", { class: "btn", href: "https://www.youtube.com/watch?v=" + v.id, target: "_blank", rel: "noopener noreferrer", text: "Open on YouTube ↗" }),
          el("button", { class: "btn", type: "button", text: "Close", onclick: () => { box.replaceChildren(); box.hidden = true; } }),
        ]),
      ])
    );
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function stamp() {
    const u = $("videos-updated");
    if (u) u.textContent = data && data.generated_at ? "Updated " + ago(data.generated_at) + " · checks every 2 min" : "";
  }

  async function fetchData() {
    try {
      const res = await fetch("videos.json?ts=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) { return null; }
  }

  function applyData(d) {
    data = d; pending = null;
    $("video-new-banner").hidden = true;
    stamp(); renderFilters(); renderGrid();
  }

  async function load() {
    const d = await fetchData();
    loaded = true;
    applyData(d);
  }

  // Poll while the Videos tab is open. New videos show up as a banner so a playing video is never interrupted.
  async function poll() {
    if (document.documentElement.getAttribute("data-view") !== "videos" || document.hidden) return;
    const d = await fetchData();
    if (!d || !Array.isArray(d.items)) return;
    const known = new Set(list().map((v) => v.id));
    const fresh = d.items.filter((v) => valid(v) && !known.has(v.id));
    if (!fresh.length) { data.generated_at = d.generated_at || data.generated_at; stamp(); return; }
    pending = d;
    const b = $("video-new-banner");
    b.textContent = fresh.length + " new video" + (fresh.length > 1 ? "s" : "") + ". Click to load";
    b.hidden = false;
  }

  function startPolling() { if (!timer) timer = setInterval(poll, 2 * 60 * 1000); }
  function stopPolling() { clearInterval(timer); timer = null; }

  function init() {
    if (!$("view-videos")) return;
    $("video-search").addEventListener("input", (e) => { ui.search = e.target.value; ui.shown = PAGE; renderGrid(); });
    $("video-more").addEventListener("click", () => { ui.shown += PAGE; renderGrid(); });
    $("video-new-banner").addEventListener("click", () => { if (pending) applyData(pending); });
    document.addEventListener("cf:donechanged", () => { if (loaded) renderGrid(); });
    document.addEventListener("cf:viewchange", (e) => {
      if (e.detail.view === "videos") { load(); startPolling(); }
      else { stopPolling(); const box = $("video-player"); if (box && !box.hidden) { box.replaceChildren(); box.hidden = true; } }  // stop playback on leave
    });
    if (document.documentElement.getAttribute("data-view") === "videos") { load(); startPolling(); }
    else renderGrid();
  }
  init();
})();
