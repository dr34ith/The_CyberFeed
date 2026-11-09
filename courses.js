/* Courses mode for the Library: YouTube courses that play inside the app (youtube-nocookie iframe).
   IDs are validated before use; DOM is built with CF.el (no innerHTML). */
(function () {
  "use strict";
  const el = window.CF && window.CF.el;
  if (!el) return;
  const COURSES = (window.CF_COURSES || []).slice();
  const TOPICS = window.CF_COURSE_TOPICS || [];
  const CUSTOM_KEY = "cf_courses_custom";
  const VIDEO_RE = /^[\w-]{11}$/, LIST_RE = /^[\w-]{10,64}$/;
  let topic = "All";

  const $ = (id) => document.getElementById(id);
  const keyOf = (c) => "c:" + c.kind + ":" + c.ref;
  const valid = (c) => !!c && (c.kind === "video" ? VIDEO_RE.test(c.ref) : c.kind === "playlist" && LIST_RE.test(c.ref));

  function loadCustom() { try { const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]"); return Array.isArray(v) ? v.filter(valid) : []; } catch (e) { return []; } }
  function saveCustom(list) { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch (e) {} }
  const all = () => COURSES.filter(valid).concat(loadCustom());
  const isDone = (k) => !!(window.CFDone && window.CFDone.isDone(k));

  function parseLink(text) {
    let u; try { u = new URL(text.trim()); } catch (e) { return null; }
    if (!/(^|\.)youtube\.com$|^youtu\.be$/.test(u.hostname)) return null;
    const list = u.searchParams.get("list");
    let v = u.searchParams.get("v");
    if (!v && u.hostname === "youtu.be") v = u.pathname.slice(1);
    if (!v) { const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/); if (m) v = m[1]; }
    if (v && VIDEO_RE.test(v)) return { kind: "video", ref: v };
    if (list && LIST_RE.test(list)) return { kind: "playlist", ref: list };
    return null;
  }

  const embedUrl = (c) => c.kind === "video"
    ? "https://www.youtube-nocookie.com/embed/" + c.ref + "?rel=0"
    : "https://www.youtube-nocookie.com/embed/videoseries?list=" + c.ref + "&rel=0";
  const watchUrl = (c) => c.kind === "video" ? "https://www.youtube.com/watch?v=" + c.ref : "https://www.youtube.com/playlist?list=" + c.ref;

  function renderFilters() {
    const wrap = $("course-filters"); if (!wrap) return;
    wrap.replaceChildren();
    ["All"].concat(TOPICS, ["Finished"]).forEach((t) => wrap.appendChild(el("button", {
      class: "chip-btn" + (t === topic ? " active" : ""), type: "button", text: t,
      onclick: () => { topic = t; renderFilters(); renderGrid(); },
    })));
  }

  function card(c) {
    const media = c.kind === "video"
      ? el("img", { class: "course-thumb", src: "https://i.ytimg.com/vi/" + c.ref + "/hqdefault.jpg", alt: "", loading: "lazy" })
      : el("div", { class: "course-thumb course-thumb-list", text: "PLAYLIST" });
    return el("button", { class: "course-card" + (isDone(keyOf(c)) ? " is-done" : ""), type: "button", onclick: () => play(c) }, [
      el("div", { class: "course-media" }, [media, el("span", { class: "course-play", text: "▶" })]),
      el("div", { class: "course-body" }, [
        el("div", { class: "shelf-detail-cat", text: (c.topic || "Custom") + (c.kind === "playlist" ? " · series" : "") }),
        el("div", { class: "course-title", text: c.title }),
        el("div", { class: "course-channel", text: c.channel || "YouTube" }),
      ]),
    ]);
  }

  function renderGrid() {
    const grid = $("course-grid"); if (!grid) return;
    grid.replaceChildren();
    const list = all().filter((c) => topic === "All" || (topic === "Finished" ? isDone(keyOf(c)) : c.topic === topic));
    if (!list.length) grid.appendChild(el("p", { class: "shelf-empty", text: topic === "Finished" ? "No finished courses yet." : "No courses here yet." }));
    if (topic !== "All") { list.forEach((c) => grid.appendChild(card(c))); return; }
    // "All" is organised into one titled group per topic (custom courses go last).
    const groups = TOPICS.concat([""]);
    groups.forEach((t) => {
      const items = list.filter((c) => (c.topic || "") === t);
      if (!items.length) return;
      grid.appendChild(el("h4", { class: "course-group", text: (t || "My courses") + " · " + items.length }));
      items.forEach((c) => grid.appendChild(card(c)));
    });
  }

  function play(c) {
    const box = $("course-player"); if (!box || !valid(c)) return;
    const key = keyOf(c);
    box.replaceChildren();
    box.hidden = false;
    const frame = el("iframe", {
      class: "course-frame", src: embedUrl(c), title: c.title, loading: "lazy",
      allow: "encrypted-media; picture-in-picture; fullscreen", referrerpolicy: "strict-origin-when-cross-origin",
    });
    box.append(
      el("div", { class: "course-frame-wrap" }, [frame]),
      el("div", { class: "course-player-bar" }, [
        el("strong", { text: c.title }),
        el("div", { class: "course-player-actions" }, [
          window.CFDone ? window.CFDone.button(key) : null,
          el("a", { class: "btn", href: watchUrl(c), target: "_blank", rel: "noopener noreferrer", text: "Open on YouTube ↗" }),
          el("button", { class: "btn", type: "button", text: "Close", onclick: () => { box.replaceChildren(); box.hidden = true; } }),
        ]),
      ])
    );
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setMode(mode) {
    const courses = mode === "courses";
    $("courses-panel").hidden = !courses;
    $("books-panel").hidden = courses;
    $("mode-books").classList.toggle("active", !courses);
    $("mode-courses").classList.toggle("active", courses);
    if (courses) { renderFilters(); renderGrid(); }
  }

  function init() {
    if (!$("courses-panel")) return;
    $("mode-books").addEventListener("click", () => setMode("books"));
    $("mode-courses").addEventListener("click", () => setMode("courses"));
    $("course-add").addEventListener("submit", (e) => {
      e.preventDefault();
      const msg = $("course-msg"), input = $("course-url");
      const parsed = parseLink(input.value);
      if (!parsed) { msg.textContent = "That doesn't look like a YouTube video or playlist link."; return; }
      if (all().some((c) => c.kind === parsed.kind && c.ref === parsed.ref)) { msg.textContent = "Already in your list."; return; }
      const list = loadCustom();
      list.push({ title: "My course (" + parsed.ref.slice(0, 11) + ")", channel: "Added by you", topic: "", kind: parsed.kind, ref: parsed.ref });
      saveCustom(list);
      input.value = ""; msg.textContent = "Added.";
      topic = "All"; renderFilters(); renderGrid();
    });
    document.addEventListener("cf:donechanged", () => { if (!$("courses-panel").hidden) renderGrid(); });
  }
  init();
})();
