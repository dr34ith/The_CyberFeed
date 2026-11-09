/* Intelligence extras: Daily brief, CVE tracker, CVE lookup (NVD, best effort).
   Data comes from app.js via window.CFData. DOM is built with CF.el (no innerHTML). */
(function () {
  "use strict";
  const el = window.CF && window.CF.el;
  if (!el) return;
  const $ = (id) => document.getElementById(id);
  const CVE_ID = /^CVE-\d{4}-\d{4,7}$/i;
  const PAGE = 25;
  const DAY = 24 * 3600 * 1000;

  const ui = { search: "", kevOnly: false, sort: "newest", shown: PAGE, open: null };

  const ts = (d) => { const t = Date.parse(d); return Number.isFinite(t) ? t : 0; };
  const fmtDate = (d) => { const t = ts(d); return t ? new Date(t).toISOString().slice(0, 10) : "n/a"; };
  const safeHttp = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : null; } catch (e) { return null; } };
  const items = () => (window.CFData ? window.CFData.getItems() || [] : []);

  /* ---------- aggregate ---------- */
  function buildCves() {
    const map = new Map();
    items().forEach((it) => {
      (it.cves || []).forEach((raw) => {
        const id = String(raw).toUpperCase();
        let r = map.get(id);
        if (!r) { r = { cve: id, mentions: 0, sources: new Set(), latest: 0, kev: false, cvss: null, articles: [] }; map.set(id, r); }
        r.mentions += 1;
        if (it.source) r.sources.add(it.source);
        r.latest = Math.max(r.latest, ts(it.published));
        if (it.kev) r.kev = true;
        if (typeof it.cvss === "number") r.cvss = Math.max(r.cvss == null ? 0 : r.cvss, it.cvss);
        r.articles.push(it);
      });
    });
    return Array.from(map.values());
  }

  /* ---------- Daily brief ---------- */
  function briefData() {
    const all = items();
    // If the feed snapshot is stale (older than a day), anchor the "24h" window to the newest item
    // so the brief still shows the latest activity instead of zeros.
    const newest = all.reduce((m, i) => Math.max(m, ts(i.published)), 0);
    const now = newest && Date.now() - newest > DAY ? newest : Date.now();
    const last24 = all.filter((i) => now - ts(i.published) <= DAY);
    const kev24 = last24.filter((i) => i.kev);
    const top = all.slice().sort((a, b) => (b.severity_score || 0) - (a.severity_score || 0) || ts(b.published) - ts(a.published)).slice(0, 3);
    const tagCount = {};
    last24.forEach((i) => (i.tags || []).forEach((t) => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const tags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const newCves = buildCves().filter((c) => c.articles.some((a) => now - ts(a.published) <= DAY));
    return { total: all.length, last24, kev24, top, tags, newCves };
  }

  function briefText(b) {
    const lines = ["CyberFeed daily brief, " + new Date().toISOString().slice(0, 10),
      "New items (24h): " + b.last24.length + " of " + b.total,
      "KEV-flagged (24h): " + b.kev24.length,
      "CVEs seen (24h): " + b.newCves.length, "", "Top stories:"];
    b.top.forEach((i, n) => lines.push((n + 1) + ". " + i.title + " (" + (i.source || "?") + ")"));
    if (b.tags.length) lines.push("", "Trending: " + b.tags.map((t) => t[0] + " (" + t[1] + ")").join(", "));
    return lines.join("\n");
  }

  function renderBrief() {
    const body = $("brief-body"); if (!body) return;
    body.replaceChildren();
    const b = briefData();
    if (!b.total) { body.appendChild(el("p", { class: "shelf-empty", text: "Waiting for the feed to load." })); return; }
    const stat = (v, l) => el("div", { class: "brief-stat" }, [el("div", { class: "brief-val", text: String(v) }), el("div", { class: "brief-label", text: l })]);
    body.appendChild(el("div", { class: "brief-stats" }, [
      stat(b.last24.length, "New items (24h)"), stat(b.kev24.length, "KEV-flagged (24h)"),
      stat(b.newCves.length, "CVEs seen (24h)"), stat(b.total, "In feed"),
    ]));
    body.appendChild(el("div", { class: "brief-sub", text: "Top stories right now" }));
    const ol = el("ol", { class: "brief-list" });
    b.top.forEach((i) => {
      const href = safeHttp(i.link);
      ol.appendChild(el("li", {}, [
        href ? el("a", { href, target: "_blank", rel: "noopener noreferrer", text: i.title }) : el("span", { text: i.title }),
        el("span", { class: "brief-src", text: " " + (i.source || "") }),
      ]));
    });
    body.appendChild(ol);
    if (b.tags.length) body.appendChild(el("div", { class: "brief-tags" }, b.tags.map((t) => el("span", { class: "tag-chip", text: t[0] + " · " + t[1] }))));
  }

  /* ---------- CVE tracker ---------- */
  function visibleCves() {
    const q = ui.search.trim().toLowerCase();
    let list = buildCves().filter((c) => (!ui.kevOnly || c.kev) && (!q || c.cve.toLowerCase().includes(q) || Array.from(c.sources).join(" ").toLowerCase().includes(q)));
    const by = {
      newest: (a, b) => b.latest - a.latest,
      mentions: (a, b) => b.mentions - a.mentions || b.latest - a.latest,
      kev: (a, b) => Number(b.kev) - Number(a.kev) || b.latest - a.latest,
    }[ui.sort];
    return list.sort(by);
  }

  const extLink = (href, text) => el("a", { class: "btn", href, target: "_blank", rel: "noopener noreferrer", text });

  function row(c) {
    const open = ui.open === c.cve;
    const head = el("button", { class: "cve-row" + (open ? " open" : ""), type: "button", "aria-expanded": String(open), onclick: () => { ui.open = open ? null : c.cve; renderTracker(); } }, [
      el("span", { class: "cve-id mono", text: c.cve }),
      c.kev ? el("span", { class: "badge-kev", text: "KEV" }) : el("span", { class: "cve-nokev" }),
      el("span", { class: "cve-meta", text: c.mentions + (c.mentions === 1 ? " mention" : " mentions") }),
      el("span", { class: "cve-meta cve-hide-sm", text: fmtDate(c.latest) }),
      el("span", { class: "cve-meta cve-hide-sm", text: Array.from(c.sources).slice(0, 2).join(", ") }),
    ]);
    const wrap = el("div", { class: "cve-item", role: "listitem" }, [head]);
    if (open) {
      const arts = el("ul", { class: "cve-articles" });
      c.articles.slice().sort((a, b) => ts(b.published) - ts(a.published)).slice(0, 6).forEach((a) => {
        const href = safeHttp(a.link);
        arts.appendChild(el("li", {}, [
          href ? el("a", { href, target: "_blank", rel: "noopener noreferrer", text: a.title }) : el("span", { text: a.title }),
          el("span", { class: "brief-src", text: " " + (a.source || "") + " · " + fmtDate(a.published) }),
        ]));
      });
      const watched = window.CFData && window.CFData.isWatched(c.cve);
      const watch = el("button", { class: "btn" + (watched ? "" : " active"), type: "button", text: watched ? "Watching ✓" : "Watch", onclick: () => { if (window.CFData) { window.CFData.addWatch(c.cve); renderTracker(); } } });
      const reader = el("div", { class: "cve-reader" });
      loadReport(c.cve, reader);
      wrap.appendChild(el("div", { class: "cve-detail" }, [
        reader,
        el("div", { class: "rd-label", text: "Mentioned in your feeds" }),
        arts,
        el("div", { class: "cve-actions" }, [watch, ...links(c.cve)]),
      ]));
    }
    return wrap;
  }

  function links(id) {
    return [
      extLink("https://nvd.nist.gov/vuln/detail/" + id, "NVD ↗"),
      extLink("https://www.cve.org/CVERecord?id=" + id, "CVE.org ↗"),
      extLink("https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=" + id, "CISA KEV ↗"),
      extLink("https://www.exploit-db.com/search?cve=" + id.replace(/^CVE-/i, ""), "Exploit-DB ↗"),
    ];
  }

  function renderTracker() {
    const list = $("cve-list"); if (!list) return;
    const all = visibleCves();
    list.replaceChildren();
    $("cve-count").textContent = all.length + " CVE" + (all.length === 1 ? "" : "s") + " · " + all.filter((c) => c.kev).length + " KEV";
    if (!all.length) list.appendChild(el("p", { class: "shelf-empty", text: items().length ? "No CVEs match." : "Waiting for the feed to load." }));
    all.slice(0, ui.shown).forEach((c) => list.appendChild(row(c)));
    $("cve-more").hidden = all.length <= ui.shown;
  }

  /* ---------- In-app CVE reader (NVD data, best effort) ---------- */
  const cache = new Map();
  const note = (t) => el("p", { class: "cve-msg", text: t });

  async function fetchNvd(id) {
    if (cache.has(id)) return cache.get(id);
    const res = await fetch("https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=" + encodeURIComponent(id));
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    cache.set(id, data);
    return data;
  }

  function field(label, value) {
    return el("div", { class: "rd-field" }, [el("div", { class: "rd-label", text: label }), el("div", { class: "rd-value", text: value })]);
  }

  function reportNodes(id, v) {
    const desc = (v.descriptions || []).find((d) => d.lang === "en");
    const m = v.metrics || {};
    const cv = (m.cvssMetricV31 || m.cvssMetricV40 || m.cvssMetricV30 || [])[0];
    const cd = cv && cv.cvssData ? cv.cvssData : null;
    const cwes = [];
    (v.weaknesses || []).forEach((w) => (w.description || []).forEach((d) => { if (d.value && cwes.indexOf(d.value) === -1) cwes.push(d.value); }));
    const cpes = [];
    (v.configurations || []).forEach((cfg) => (cfg.nodes || []).forEach((n) => (n.cpeMatch || []).forEach((c) => {
      if (!c.vulnerable || !c.criteria) return;
      const p = c.criteria.split(":");           // cpe:2.3:a:vendor:product:version...
      const label = (p[3] || "?") + " " + (p[4] || "?") + (p[5] && p[5] !== "*" ? " " + p[5] : "");
      if (cpes.indexOf(label) === -1) cpes.push(label);
    })));
    const refs = (v.references || []).slice(0, 10);
    const seen = buildCves().find((c) => c.cve === id);
    const out = [
      el("div", { class: "lookup-head" }, [
        el("strong", { class: "mono", text: id }),
        el("span", { class: "tag-chip", text: cd ? "CVSS " + cd.baseScore + " " + (cd.baseSeverity || "") : "CVSS n/a" }),
        v.cisaExploitAdd || (seen && seen.kev) ? el("span", { class: "badge-kev", text: "KEV" }) : null,
      ]),
      el("p", { class: "lookup-desc", text: desc ? desc.value : "No description available." }),
      el("div", { class: "rd-grid" }, [
        field("Published", fmtDate(v.published)),
        field("Last modified", fmtDate(v.lastModified)),
        field("Status", v.vulnStatus || "n/a"),
        field("Weakness", cwes.length ? cwes.join(", ") : "n/a"),
      ]),
    ];
    if (cd && cd.vectorString) out.push(field("CVSS vector", cd.vectorString));
    if (v.cisaExploitAdd) out.push(field("CISA KEV", "Added " + v.cisaExploitAdd + (v.cisaRequiredAction ? ". Required action: " + v.cisaRequiredAction : "") + (v.cisaActionDue ? " (due " + v.cisaActionDue + ")" : "")));
    if (cpes.length) out.push(field("Affected (first " + Math.min(cpes.length, 8) + " of " + cpes.length + ")", cpes.slice(0, 8).join(" · ")));
    if (refs.length) {
      const ul = el("ul", { class: "cve-articles" });
      refs.forEach((r) => {
        const href = safeHttp(r.url); if (!href) return;
        ul.appendChild(el("li", {}, [el("a", { href, target: "_blank", rel: "noopener noreferrer", text: href.replace(/^https?:\/\//, "").slice(0, 80) }), el("span", { class: "brief-src", text: (r.tags && r.tags.length ? " " + r.tags.slice(0, 3).join(", ") : "") })]));
      });
      out.push(el("div", { class: "rd-label", text: "References" }), ul);
    }
    return out;
  }

  // Fills `box` with the CVE details, in place.
  async function loadReport(id, box) {
    box.replaceChildren(note("Loading " + id + " from NVD…"));
    try {
      const data = await fetchNvd(id);
      const v = data && data.vulnerabilities && data.vulnerabilities[0] && data.vulnerabilities[0].cve;
      box.replaceChildren(...(v ? reportNodes(id, v) : [note(id + " was not found in NVD (it may be reserved or too new).")]));
    } catch (e) {
      box.replaceChildren(note("Couldn't reach NVD right now (rate limit or network). The article summaries below are still available, or use the links."));
    }
  }

  function lookup(raw) {
    const id = String(raw || "").trim().toUpperCase();
    const r = $("cve-lookup-result");
    if (!CVE_ID.test(id)) { r.replaceChildren(note("Enter a CVE ID like CVE-2024-3400.")); return; }
    const seen = buildCves().find((c) => c.cve === id);
    const box = el("div", { class: "cve-reader" });
    r.replaceChildren(box,
      note(seen ? "Mentioned " + seen.mentions + "× in your feeds." : "Not mentioned in your current feeds."),
      el("div", { class: "cve-actions" }, links(id)));
    loadReport(id, box);
  }

  /* ---------- wiring ---------- */
  function renderAll() { renderBrief(); renderTracker(); }

  function init() {
    if (!$("cve-tracker")) return;
    $("cve-search").addEventListener("input", (e) => { ui.search = e.target.value; ui.shown = PAGE; renderTracker(); });
    $("cve-kev-only").addEventListener("change", (e) => { ui.kevOnly = e.target.checked; ui.shown = PAGE; renderTracker(); });
    $("cve-sort").addEventListener("change", (e) => { ui.sort = e.target.value; renderTracker(); });
    $("cve-more").addEventListener("click", () => { ui.shown += PAGE; renderTracker(); });
    $("cve-lookup-form").addEventListener("submit", (e) => { e.preventDefault(); lookup($("cve-lookup-input").value); });
    $("brief-copy").addEventListener("click", async () => {
      const btn = $("brief-copy");
      try { await navigator.clipboard.writeText(briefText(briefData())); btn.textContent = "Copied ✓"; } catch (e) { btn.textContent = "Copy failed"; }
      setTimeout(() => { btn.textContent = "Copy brief"; }, 1500);
    });
    document.addEventListener("cf:statsrendered", renderAll);
    renderAll();
  }
  init();
})();
