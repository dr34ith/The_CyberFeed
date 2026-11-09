/* Animated bookshelf for the Library view. Uploaded PDFs (from books.js) are shown on a
   "Your reads" shelf; curated trending books fill the rest. All DOM is built with CF.el
   (no innerHTML) because uploaded titles are user-controlled filenames. */
(function () {
  "use strict";
  const el = window.CF && window.CF.el;
  if (!el) return;

  const BOOKS = window.CF_TRENDING_BOOKS || [];
  const CATS = window.CF_BOOK_CATEGORIES || [];
  const PER_SHELF = 8;
  const TONES = ["tone-yellow", "tone-black", "tone-white", "tone-grey", "tone-ink", "tone-sun"];

  let filter = "All";
  let myBooks = [];
  let selectedKey = null;

  // "Done" tracking shared with courses.js (window.CFDone). Stored per browser.
  const DONE_KEY = "cf_done";
  function readDone() { try { const v = JSON.parse(localStorage.getItem(DONE_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function isDone(key) { return readDone().indexOf(key) !== -1; }
  function toggleDone(key) {
    const list = readDone(); const i = list.indexOf(key);
    if (i === -1) list.push(key); else list.splice(i, 1);
    try { localStorage.setItem(DONE_KEY, JSON.stringify(list)); } catch (e) {}
    document.dispatchEvent(new CustomEvent("cf:donechanged"));
    return i === -1;
  }
  function doneBtn(key) {
    const b = el("button", { class: "btn done-btn", type: "button" });
    const paint = () => { const d = isDone(key); b.textContent = d ? "Done \u2713 (undo)" : "Mark as done"; b.classList.toggle("is-on", d); };
    b.addEventListener("click", () => { toggleDone(key); paint(); });
    paint();
    return b;
  }
  window.CFDone = { isDone, toggleDone, list: readDone, button: doneBtn };

  // Deterministic pseudo-random so a given title always gets the same spine look.
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function spine(opts, index) {
    const h = hash(opts.title);
    const height = 170 + (h % 50);          // 170-219px
    const width = 50 + ((h >> 3) % 22);     // 50-71px
    const tone = opts.mine ? "tone-mine" : opts.builtin ? "tone-builtin" : TONES[h % TONES.length];
    const key = (opts.mine ? "mine:" : opts.builtin ? "b:" : "t:") + opts.id;
    const btn = el("button", {
      class: "shelf-spine " + tone + (selectedKey === key ? " pulled" : ""),
      type: "button",
      title: opts.title + " · " + opts.author,
      "aria-label": opts.title + " by " + opts.author,
      onclick: () => onPick(opts, key),
    }, [
      el("span", { class: "shelf-spine-title", text: opts.title }),
      el("span", { class: "shelf-spine-author", text: opts.author }),
    ]);
    if (isDone(key)) { btn.classList.add("is-done"); btn.dataset.done = "1"; }
    btn.style.height = height + "px";
    btn.style.width = width + "px";
    btn.style.setProperty("--i", String(index));
    btn.style.setProperty("--tilt", ((h % 5) - 2) * 0.4 + "deg");
    return btn;
  }

  function shelfRow(label, spines) {
    const n = spines.filter((x) => x.dataset.done).length;
    return el("div", { class: "shelf-row" }, [
      el("div", { class: "shelf-label", text: n ? label + " \u00b7 " + n + " of " + spines.length + " done" : label }),
      el("div", { class: "shelf-books" }, spines),
      el("div", { class: "shelf-plank" }),
    ]);
  }

  function onPick(opts, key) {
    selectedKey = selectedKey === key ? null : key;
    renderShelves();
    const box = document.getElementById("shelf-detail");
    if (!box) return;
    if (!selectedKey) { box.hidden = true; return; }
    box.replaceChildren();
    box.hidden = false;
    queueMicrotask(() => box.append(doneBtn(key)));
    if (opts.mine) {
      box.append(
        el("div", { class: "shelf-detail-cat", text: "Your read" }),
        el("h4", { text: opts.title }),
        el("p", { text: opts.meta }),
        el("button", { class: "btn active", type: "button", text: "Open in reader", onclick: () => window.CFBooks && window.CFBooks.openBook(opts.id) })
      );
    } else if (opts.builtin) {
      box.append(
        el("div", { class: "shelf-detail-cat", text: opts.category + " · included PDF" }),
        el("h4", { text: opts.title }),
        el("p", { text: opts.why }),
        el("button", { class: "btn active", type: "button", text: "Read now", onclick: () => window.CFBooks && window.CFBooks.openBuiltin(opts.builtin) })
      );
    } else {
      const q = encodeURIComponent(opts.title + " " + opts.author + " book");
      box.append(
        el("div", { class: "shelf-detail-cat", text: opts.category }),
        el("h4", { text: opts.title }),
        el("div", { class: "shelf-detail-author", text: "by " + opts.author }),
        el("p", { text: opts.why }),
        el("a", { class: "btn active", href: "https://www.google.com/search?q=" + q, target: "_blank", rel: "noopener noreferrer", text: "Find this book ↗" })
      );
    }
  }

  function renderFilters() {
    const wrap = document.getElementById("shelf-filters");
    if (!wrap) return;
    wrap.replaceChildren();
    ["All"].concat(CATS, ["Finished"]).forEach((c) => {
      wrap.appendChild(el("button", {
        class: "chip-btn" + (c === filter ? " active" : ""),
        type: "button",
        text: c,
        onclick: () => { filter = c; selectedKey = null; const d = document.getElementById("shelf-detail"); if (d) d.hidden = true; renderFilters(); renderShelves(); },
      }));
    });
  }

  function renderShelves() {
    const rows = document.getElementById("shelf-rows");
    const title = document.getElementById("shelves-title");
    if (!rows) return;
    rows.replaceChildren();
    if (title) title.textContent = myBooks.length ? "Your shelf + trending must-reads" : "Top trending must-reads";

    let idx = 0;
    if (filter === "Finished") {
      const fin = [];
      myBooks.forEach((b) => { if (isDone("mine:" + b.id)) fin.push(spine({ id: b.id, title: b.title, author: "My upload", mine: true, meta: "Finished" }, idx++)); });
      BOOKS.forEach((b) => { if (isDone("t:" + b.title)) fin.push(spine({ id: b.title, title: b.title, author: b.author, category: b.category, why: b.why }, idx++)); });
      if (!fin.length) rows.appendChild(el("p", { class: "shelf-empty", text: "Nothing finished yet. Open a book and press \u201cMark as done\u201d." }));
      for (let i = 0; i < fin.length; i += PER_SHELF) rows.appendChild(shelfRow("Finished", fin.slice(i, i + PER_SHELF)));
      return;
    }
    const builtins = (window.CF_BUILTIN_BOOKS || []).filter((b) => filter === "All" || b.category === filter);
    const builtinRow = builtins.length ? shelfRow("Start reading · included PDFs",
      builtins.map((b) => spine({ id: b.id, title: b.title, author: b.author, category: b.category, why: b.why, builtin: b }, idx++))) : null;
    if (builtinRow && !myBooks.length) rows.appendChild(builtinRow);
    if (myBooks.length && filter === "All") {
      const mine = myBooks.map((b) => spine({
        id: b.id, title: b.title, author: "My upload", mine: true,
        meta: b.pageCount ? "Page " + b.lastReadPage + " of " + b.pageCount : "Not opened yet",
      }, idx++));
      for (let i = 0; i < mine.length; i += PER_SHELF) rows.appendChild(shelfRow(i === 0 ? "Your reads" : "Your reads (cont.)", mine.slice(i, i + PER_SHELF)));
    }

    if (builtinRow && myBooks.length) rows.appendChild(builtinRow);

    const list = BOOKS.filter((b) => filter === "All" || b.category === filter);
    const groups = filter === "All" ? CATS.map((c) => [c, list.filter((b) => b.category === c)]) : [[filter, list]];
    groups.forEach(([cat, items]) => {
      for (let i = 0; i < items.length; i += PER_SHELF) {
        const spines = items.slice(i, i + PER_SHELF).map((b) => spine({ id: b.title, title: b.title, author: b.author, category: b.category, why: b.why }, idx++));
        rows.appendChild(shelfRow(cat, spines));
      }
    });
  }

  document.addEventListener("cf:donechanged", () => renderShelves());
  document.addEventListener("cf:bookschanged", (e) => { myBooks = (e.detail && e.detail.books) || []; renderShelves(); });
  renderFilters();
  renderShelves();
})();
