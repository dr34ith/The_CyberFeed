#!/usr/bin/env python3
"""Fetch cybersecurity news RSS/Atom feeds and write feeds.json.

Stdlib only (urllib, xml.etree, json) so it runs with plain `python fetch_feeds.py`,
no pip installs required.
"""
import json
import re
import sys
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape

OUTPUT_FILE = "feeds.json"
CVE_CACHE_FILE = "cve_cache.json"
TIMEOUT = 15
USER_AGENT = "CyberFeedBot/1.0 (+https://github.com/; personal RSS aggregator)"
MAX_ITEMS_PER_SOURCE = 40
MAX_VIDEOS_PER_CHANNEL = 12
VIDEOS_FILE = "videos.json"
# YouTube channels whose public Atom feeds (no API key) feed the app's Videos tab.
# Channels are listed by @handle; the UC... channel id is resolved at run time and cached in
# channel_ids.json, so a typo or a temporary YouTube hiccup never breaks the run (the channel is
# just skipped, and the cached id is reused on later runs). To add a channel, add one line here
# (or give "channel_id" directly if you already know it).
CHANNEL_IDS_FILE = "channel_ids.json"
VIDEO_CHANNELS = [
    {"name": "The Hacker News", "handle": "TheHackersNews", "topic": "News"},
    {"name": "BleepingComputer", "handle": "BleepingComputer", "topic": "News"},
    {"name": "Cisco Talos", "handle": "CiscoTalos", "topic": "Threat research"},
    {"name": "CrowdStrike", "handle": "CrowdStrike", "topic": "Threat research"},
    {"name": "Mandiant (Google Cloud)", "handle": "Mandiant", "topic": "Threat research"},
    {"name": "Malwarebytes", "handle": "Malwarebytes", "topic": "Threat research"},
    {"name": "ESET", "handle": "ESET", "topic": "Threat research"},
    {"name": "Kaspersky", "handle": "Kaspersky", "topic": "Threat research"},
    {"name": "CISA", "handle": "CISAgov", "topic": "News"},
    {"name": "SANS Institute", "handle": "SANSInstitute", "topic": "Forensics & DFIR"},
    {"name": "Security Weekly", "handle": "securityweekly", "topic": "News"},
    {"name": "Black Hat", "handle": "BlackHatOfficialYT", "topic": "Conference talks"},
    {"name": "DEFCONConference", "handle": "DEFCONConference", "topic": "Conference talks"},
    {"name": "13Cubed", "handle": "13cubed", "topic": "Forensics & DFIR"},
    {"name": "John Hammond", "handle": "_JohnHammond", "channel_id": "UCVeW9qkBjo3zosnqUbG7CFw", "topic": "Hacking"},
    {"name": "NetworkChuck", "handle": "NetworkChuck", "topic": "Networking"},
    {"name": "David Bombal", "handle": "davidbombal", "channel_id": "UCZTIRrENWr_rjVoA7BcUE_A", "topic": "Networking"},
    {"name": "Seytonic", "handle": "Seytonic", "topic": "News"},
    {"name": "The PC Security Channel", "handle": "ThePCSecurityChannel", "topic": "News"},
    {"name": "Computerphile", "handle": "Computerphile", "topic": "Computing"},
]
VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
NVD_URL_TMPL = "https://services.nvd.nih.gov/rest/json/cves/2.0?cveId={}"
NVD_SLEEP_SECONDS = 6
# Mirrors app.js's CRITICAL_KEYWORDS list so the deterministic severity score agrees
# with the client-side keyword check used as a fallback when enrichment is absent.
CRITICAL_KEYWORDS = ["critical", "actively exploited", "zero-day", "0-day", "emergency patch", "widespread exploitation"]
# Clustering: title tokens are compared after dropping these common stopwords.
TITLE_STOPWORDS = {
    "the", "a", "an", "of", "in", "on", "for", "to", "with", "and", "or", "is", "are",
    "as", "at", "by", "from", "after", "amid", "over", "new", "says", "its", "into",
    "than", "that", "this", "has", "have", "be", "been", "will", "can",
}
CLUSTER_WINDOW_SECONDS = 72 * 3600
CLUSTER_JACCARD_THRESHOLD = 0.5

SOURCES = [
    {"id": "thehackernews", "name": "The Hacker News", "url": "https://feeds.feedburner.com/TheHackersNews", "category": "News"},
    {"id": "bleepingcomputer", "name": "BleepingComputer", "url": "https://www.bleepingcomputer.com/feed/", "category": "News"},
    {"id": "krebsonsecurity", "name": "Krebs on Security", "url": "https://krebsonsecurity.com/feed/", "category": "News"},
    {"id": "darkreading", "name": "Dark Reading", "url": "https://www.darkreading.com/rss.xml", "category": "News"},
    {"id": "securityweek", "name": "SecurityWeek", "url": "https://www.securityweek.com/feed/", "category": "News"},
    {"id": "schneier", "name": "Schneier on Security", "url": "https://www.schneier.com/feed/atom/", "category": "Analysis"},
    {"id": "sophosnews", "name": "Sophos News", "url": "https://news.sophos.com/en-us/feed", "category": "Vendor"},
    {"id": "cisa", "name": "CISA Advisories", "url": "https://www.cisa.gov/cybersecurity-advisories/all.xml", "category": "Advisory"},
    {"id": "msrc", "name": "Microsoft Security Blog", "url": "https://www.microsoft.com/en-us/security/blog/feed/", "category": "Vendor"},
    {"id": "talos", "name": "Cisco Talos", "url": "https://blog.talosintelligence.com/rss/", "category": "Research"},
    {"id": "unit42", "name": "Unit 42 (Palo Alto)", "url": "https://unit42.paloaltonetworks.com/feed/", "category": "Research"},
    {"id": "crowdstrike", "name": "CrowdStrike Blog", "url": "https://www.crowdstrike.com/blog/feed/", "category": "Vendor"},
    {"id": "therecord", "name": "The Record", "url": "https://therecord.media/feed/", "category": "News"},
    {"id": "sans_isc", "name": "SANS Internet Storm Center", "url": "https://isc.sans.edu/rssfeed_full.xml", "category": "Research"},
    {"id": "theregister", "name": "The Register Security", "url": "https://www.theregister.com/security/headlines.atom", "category": "News"},
    {"id": "projectzero", "name": "Google Project Zero", "url": "https://projectzero.google/feed.xml", "category": "Research"},
    {"id": "malwarebytes", "name": "Malwarebytes Labs", "url": "https://www.malwarebytes.com/blog/feed/index.xml", "category": "Vendor"},
    {"id": "securityaffairs", "name": "Security Affairs", "url": "https://securityaffairs.com/feed", "category": "News"},
]

TAG_RULES = {
    "ransomware": ["ransomware", "lockbit", "ransom "],
    "malware": ["malware", "trojan", "backdoor"],
    "phishing": ["phishing", "smishing"],
    "vulnerability": ["vulnerability", "cve-", "exploit", "zero-day", "0-day"],
    "data breach": ["data breach", "breach", "leaked data"],
    "nation-state": ["nation-state", "apt", "state-sponsored"],
    "cloud": ["aws", "azure", "google cloud", "cloud security"],
    "critical infrastructure": ["critical infrastructure", "ics", "scada", "ot security"],
}

CVE_RE = re.compile(r"CVE-\d{4}-\d{4,7}", re.IGNORECASE)
IMG_SRC_RE = re.compile(r'<img[^>]+src="([^"]+)"', re.IGNORECASE)


def strip_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def is_valid_https_url(url):
    """Stricter check for images: the page's CSP only allows img-src https:."""
    if not url:
        return False
    try:
        from urllib.parse import urlparse
        return urlparse(url).scheme == "https"
    except ValueError:
        return False


def extract_image(element, raw_html_for_fallback=""):
    """Find an item/entry image via media:thumbnail, enclosure, itunes:image,
    or the first <img> in the raw description HTML, in that priority order."""
    for child in element:
        name = local_name(child.tag)
        if name == "thumbnail":
            url = child.get("url")
            if is_valid_https_url(url):
                return url
    for child in element:
        if local_name(child.tag) == "enclosure" and (child.get("type") or "").startswith("image/"):
            url = child.get("url")
            if is_valid_https_url(url):
                return url
    for child in element:
        if local_name(child.tag) == "image" and child.get("href"):
            url = child.get("href")
            if is_valid_https_url(url):
                return url
    match = IMG_SRC_RE.search(raw_html_for_fallback or "")
    if match and is_valid_https_url(match.group(1)):
        return match.group(1)
    return None


def parse_date(raw):
    if not raw:
        return None
    raw = raw.strip()
    try:
        return parsedate_to_datetime(raw).astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError):
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat()
        except ValueError:
            continue
    return None


def auto_tag(title, summary):
    haystack = f"{title} {summary}".lower()
    tags = [tag for tag, keywords in TAG_RULES.items() if any(kw in haystack for kw in keywords)]
    cves = sorted(set(m.upper() for m in CVE_RE.findall(f"{title} {summary}")))
    return tags, cves


def fetch_raw(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


def fetch_with_retry(url, retries=2, backoff=2):
    last_err = None
    for attempt in range(retries + 1):
        try:
            return fetch_raw(url)
        except (urllib.error.URLError, TimeoutError) as e:
            last_err = e
            if attempt < retries:
                time.sleep(backoff * (attempt + 1))
    raise last_err


def local_name(tag):
    return tag.split("}")[-1] if "}" in tag else tag


def parse_rss(root):
    items = []
    for item in root.iter():
        if local_name(item.tag) != "item":
            continue
        fields = {local_name(c.tag): (c.text or "") for c in item}
        link = fields.get("link", "").strip()
        guid_el = item.find("guid")
        if not link and guid_el is not None and (guid_el.text or "").startswith("http"):
            link = guid_el.text.strip()
        raw_description = fields.get("description", "") or fields.get("encoded", "")
        items.append({
            "title": strip_html(fields.get("title", "")),
            "link": link,
            "summary": strip_html(raw_description)[:320],
            "published": parse_date(fields.get("pubDate", "")),
            "image": extract_image(item, raw_description),
        })
    return items


def parse_atom(root):
    items = []
    for entry in root.iter():
        if local_name(entry.tag) != "entry":
            continue
        title = ""
        summary = ""
        link = ""
        published = None
        for c in entry:
            name = local_name(c.tag)
            if name == "title":
                title = c.text or ""
            elif name in ("summary", "content"):
                summary = c.text or summary
            elif name == "link":
                href = c.get("href")
                rel = c.get("rel", "alternate")
                if href and (not link or rel == "alternate"):
                    link = href
            elif name in ("published", "updated") and not published:
                published = c.text
        items.append({
            "title": strip_html(title),
            "link": link.strip(),
            "summary": strip_html(summary)[:320],
            "published": parse_date(published),
            "image": extract_image(entry, summary),
        })
    return items


def parse_feed(raw_bytes):
    root = ET.fromstring(raw_bytes)
    tag = local_name(root.tag)
    if tag == "feed":
        return parse_atom(root)
    return parse_rss(root)


def normalize_url(url):
    if not url:
        return url
    url = url.split("#")[0]
    if "?" in url:
        base, query = url.split("?", 1)
        kept = [p for p in query.split("&") if p and not p.split("=")[0].startswith("utm_")]
        url = base + ("?" + "&".join(kept) if kept else "")
    return url.rstrip("/")


def fetch_source(source):
    report = {"id": source["id"], "name": source["name"], "ok": False, "count": 0, "error": None, "fetched_at": datetime.now(timezone.utc).isoformat()}
    try:
        raw = fetch_with_retry(source["url"])
        items = parse_feed(raw)[:MAX_ITEMS_PER_SOURCE]
        for it in items:
            it["link"] = normalize_url(it["link"])
            it["source"] = source["name"]
            it["source_id"] = source["id"]
            it["category"] = source["category"]
            tags, cves = auto_tag(it["title"], it["summary"])
            it["tags"] = tags
            it["cves"] = cves
        report["ok"] = True
        report["count"] = len(items)
        return items, report
    except Exception as e:
        report["error"] = f"{type(e).__name__}: {e}"
        return [], report


def fetch_kev():
    """Fetch the CISA Known Exploited Vulnerabilities catalog, returning a set of
    uppercased CVE IDs. Tolerates failure like the regular source fetches: on any
    error, logs a warning and returns an empty set rather than raising."""
    try:
        raw = fetch_with_retry(KEV_URL)
        data = json.loads(raw)
        vulns = data.get("vulnerabilities", []) or []
        return set(v["cveID"].strip().upper() for v in vulns if v.get("cveID"))
    except Exception as e:
        print(f"[kev] WARNING: failed to fetch KEV catalog: {type(e).__name__}: {e}")
        return set()


def load_cve_cache():
    try:
        with open(CVE_CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_cve_cache(cache):
    try:
        with open(CVE_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2, sort_keys=True)
    except Exception as e:
        print(f"[cve_cache] WARNING: failed to write {CVE_CACHE_FILE}: {type(e).__name__}: {e}")


def fetch_nvd_cvss(cve_id):
    """Fetch the CVSS v3 base score for a single CVE from the NVD API (no API key).
    Prefers cvssMetricV31, falls back to cvssMetricV30. Returns None on any
    network/parse failure or if no v3 score is present."""
    try:
        req = urllib.request.Request(
            NVD_URL_TMPL.format(cve_id),
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read())
        vulns = data.get("vulnerabilities", []) or []
        if not vulns:
            return None
        metrics = (vulns[0].get("cve") or {}).get("metrics") or {}
        for key in ("cvssMetricV31", "cvssMetricV30"):
            arr = metrics.get(key)
            if arr:
                score = (arr[0].get("cvssData") or {}).get("baseScore")
                if score is not None:
                    return float(score)
        return None
    except Exception as e:
        print(f"[nvd] WARNING: failed to fetch CVSS for {cve_id}: {type(e).__name__}: {e}")
        return None


def enrich_cvss_cache(cve_ids, cache):
    """Fetch CVSS scores for any CVE IDs not already in the cache, sleeping between
    NVD calls to respect the no-API-key rate limit. Mutates and returns cache."""
    missing = [c for c in cve_ids if c not in cache]
    for i, cve in enumerate(missing):
        cache[cve] = fetch_nvd_cvss(cve)
        if i < len(missing) - 1:
            time.sleep(NVD_SLEEP_SECONDS)
    return cache


def normalize_title_tokens(title):
    t = re.sub(r"[^a-z0-9\s]", " ", (title or "").lower())
    return set(w for w in t.split() if w and w not in TITLE_STOPWORDS)


def cluster_items(items):
    """Greedy O(n^2) clustering: items within a 72h window whose normalized title
    tokens have Jaccard overlap > 0.5, OR that share a CVE ID, land in the same
    cluster (union-find). Assigns item['cluster_id'] to every item (None for
    singletons) and returns the list of multi-member clusters."""
    n = len(items)
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    token_sets = [normalize_title_tokens(it.get("title", "")) for it in items]
    cve_sets = [set(it.get("cves") or []) for it in items]
    pub_times = []
    for it in items:
        dt = None
        raw = it.get("published")
        if raw:
            try:
                dt = datetime.fromisoformat(raw)
            except ValueError:
                dt = None
        pub_times.append(dt)

    for i in range(n):
        for j in range(i + 1, n):
            shared_cve = bool(cve_sets[i] & cve_sets[j])
            jaccard_hit = False
            if pub_times[i] and pub_times[j]:
                within_window = abs((pub_times[i] - pub_times[j]).total_seconds()) <= CLUSTER_WINDOW_SECONDS
                if within_window:
                    union_tokens = token_sets[i] | token_sets[j]
                    if union_tokens:
                        jac = len(token_sets[i] & token_sets[j]) / len(union_tokens)
                        jaccard_hit = jac > CLUSTER_JACCARD_THRESHOLD
            if shared_cve or jaccard_hit:
                union(i, j)

    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)

    clusters = []
    next_id = 0
    for members in groups.values():
        if len(members) > 1:
            cid = next_id
            next_id += 1
            source_count = len(set(items[m].get("source_id") for m in members))
            clusters.append({
                "id": cid,
                "item_links": [items[m]["link"] for m in members],
                "source_count": source_count,
            })
            for m in members:
                items[m]["cluster_id"] = cid
        else:
            items[members[0]]["cluster_id"] = None
    return clusters


def is_critical_keyword_match(item):
    hay = f"{item.get('title', '')} {item.get('summary', '')}".lower()
    return any(kw in hay for kw in CRITICAL_KEYWORDS)


def score_item(item, cluster_source_count, kev_set, cvss_cache):
    """Deterministic additive severity score. Returns (score, bucket, kev_bool, cvss_or_none)."""
    score = 0
    cves = item.get("cves") or []

    kev_hit = any(c in kev_set for c in cves)
    if kev_hit:
        score += 40

    max_cvss = None
    for c in cves:
        v = cvss_cache.get(c)
        if isinstance(v, (int, float)) and (max_cvss is None or v > max_cvss):
            max_cvss = v
    if max_cvss is not None:
        score += min(30, round(max_cvss * 3))

    if is_critical_keyword_match(item):
        score += 15

    if cluster_source_count and cluster_source_count >= 3:
        score += 10

    tags = item.get("tags") or []
    for t in ("malware", "ransomware"):
        if t in tags:
            score += 5

    if score >= 60:
        bucket = "critical"
    elif score >= 35:
        bucket = "high"
    elif score >= 15:
        bucket = "medium"
    else:
        bucket = "low"

    return score, bucket, kev_hit, max_cvss


def parse_youtube_atom(raw_bytes):
    """Parse a YouTube channel Atom feed into [{id, title, published, thumb, views}]."""
    root = ET.fromstring(raw_bytes)
    channel_title = ""
    for c in root:
        if local_name(c.tag) == "title":
            channel_title = (c.text or "").strip()
            break
    videos = []
    for entry in root.iter():
        if local_name(entry.tag) != "entry":
            continue
        vid, title, published, thumb, views = "", "", None, "", None
        for c in entry.iter():
            name = local_name(c.tag)
            if name == "videoId":
                vid = (c.text or "").strip()
            elif name == "title" and not title:
                title = c.text or ""
            elif name == "published" and not published:
                published = parse_date(c.text)
            elif name == "thumbnail" and not thumb:
                thumb = c.get("url", "")
            elif name == "statistics":
                try:
                    views = int(c.get("views", ""))
                except ValueError:
                    views = None
        if VIDEO_ID_RE.match(vid) and title:
            videos.append({"id": vid, "title": strip_html(title), "published": published,
                           "thumb": thumb if thumb.startswith("https://") else f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                           "views": views})
    return channel_title, videos


CHANNEL_ID_RES = [
    re.compile(r'<link rel="canonical" href="https://www\.youtube\.com/channel/(UC[\w-]{22})"'),
    re.compile(r'"externalId":"(UC[\w-]{22})"'),
    re.compile(r'<meta itemprop="(?:identifier|channelId)" content="(UC[\w-]{22})"'),
]


def load_channel_ids():
    try:
        with open(CHANNEL_IDS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_channel_ids(ids):
    try:
        with open(CHANNEL_IDS_FILE, "w", encoding="utf-8") as f:
            json.dump(ids, f, indent=2, sort_keys=True)
    except OSError as e:
        print(f"[videos] WARNING: could not write {CHANNEL_IDS_FILE}: {e}")


def resolve_channel_id(handle):
    """Look up a channel's UC... id from its @handle page. Returns None if it can't be found."""
    req = urllib.request.Request(
        "https://www.youtube.com/@" + handle,
        headers={"User-Agent": "Mozilla/5.0 (compatible; CyberFeedBot/1.0)", "Accept-Language": "en-US,en;q=0.9", "Cookie": "CONSENT=YES+1"},
    )
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                page = resp.read().decode("utf-8", "replace")
            for rx in CHANNEL_ID_RES:
                m = rx.search(page)
                if m:
                    return m.group(1)
            return None
        except (urllib.error.URLError, TimeoutError) as e:
            last = e
            time.sleep(2 * (attempt + 1))
    print(f"[yt:@{handle}] resolve failed ({type(last).__name__}: {last})")
    return None


def title_matches(ch, feed_title):
    """Guard against a resolved id pointing at the wrong channel: the feed title must share a
    meaningful word with the expected name or handle (or match an explicit 'match' keyword)."""
    t = re.sub(r"[^a-z0-9]+", "", (feed_title or "").lower())
    keys = [ch.get("match", "")] + [ch["name"], ch.get("handle", "")]
    for k in keys:
        k = re.sub(r"[^a-z0-9]+", "", k.lower())
        if k and (k in t or t in k and len(t) >= 4):
            return True
    words = [w for w in re.split(r"[^a-z0-9]+", ch["name"].lower()) if len(w) >= 5]
    return any(w in t for w in words)


def fetch_videos():
    items, health = [], []
    ids = load_channel_ids()
    for ch in VIDEO_CHANNELS:
        name = ch["name"]
        cid = ids.get(ch.get("handle", "")) or ch.get("channel_id")
        try:
            if not cid and ch.get("handle"):
                cid = resolve_channel_id(ch["handle"])
                time.sleep(1.5)
            if not cid:
                raise ValueError("channel id could not be resolved")
            try:
                title, videos = parse_youtube_atom(fetch_with_retry("https://www.youtube.com/feeds/videos.xml?channel_id=" + cid))
            except urllib.error.HTTPError as e:
                # A cached/pinned id that now 404s may be stale: re-resolve once from the handle.
                fresh = resolve_channel_id(ch["handle"]) if e.code == 404 and ch.get("handle") else None
                if not fresh or fresh == cid:
                    raise
                cid = fresh
                title, videos = parse_youtube_atom(fetch_with_retry("https://www.youtube.com/feeds/videos.xml?channel_id=" + cid))
            if not title_matches(ch, title):
                ids.pop(ch.get("handle", ""), None)
                raise ValueError(f"feed belongs to '{title}', not '{name}' (rejected)")
            if not videos:
                raise ValueError("feed has no videos")
            if ch.get("handle"):
                ids[ch["handle"]] = cid
            videos.sort(key=lambda v: v.get("published") or "", reverse=True)
            for v in videos[:MAX_VIDEOS_PER_CHANNEL]:
                items.append({**v, "channel": name, "channel_id": cid, "topic": ch["topic"]})
            health.append({"channel": name, "ok": True, "count": len(videos), "feed_title": title})
            print(f"[yt:{name}] OK - {len(videos)} videos")
        except Exception as e:  # network errors, bad id, malformed XML
            health.append({"channel": name, "ok": False, "count": 0, "error": f"{type(e).__name__}: {e}"})
            print(f"[yt:{name}] FAILED ({type(e).__name__}: {e})")
        time.sleep(1)
    save_channel_ids(ids)
    seen, deduped = set(), []
    for it in sorted(items, key=lambda v: v.get("published") or "", reverse=True):
        if it["id"] in seen:
            continue
        seen.add(it["id"])
        deduped.append(it)
    return deduped, health


def write_videos():
    items, health = fetch_videos()
    # Keep what we already had for any channel that failed this run (YouTube feeds are flaky),
    # so one bad run never empties the Videos tab. Fresh data always wins over old data.
    try:
        with open(VIDEOS_FILE, "r", encoding="utf-8") as f:
            old = json.load(f)
    except (OSError, ValueError):
        old = {}
    ok_channels = {h["channel"] for h in health if h["ok"]}
    have = {it["id"] for it in items}
    kept = 0
    for it in old.get("items", []):
        if it.get("channel") not in ok_channels and it.get("id") not in have and VIDEO_ID_RE.match(it.get("id", "")):
            items.append(it)
            have.add(it["id"])
            kept += 1
    for h in health:
        if not h["ok"] and any(it.get("channel") == h["channel"] for it in items):
            h["stale"] = True
    items.sort(key=lambda v: v.get("published") or "", reverse=True)
    if not items:
        print("[videos] no videos fetched, leaving existing videos.json untouched")
        return
    out = {"generated_at": datetime.now(timezone.utc).isoformat(), "items": items, "health": health}
    with open(VIDEOS_FILE, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"[videos] wrote {len(items)} videos ({kept} kept from earlier runs) from {len(ok_channels)}/{len(VIDEO_CHANNELS)} channels to {VIDEOS_FILE}")


def main():
    all_items = []
    health = []
    for source in SOURCES:
        items, report = fetch_source(source)
        all_items.extend(items)
        health.append(report)
        status = "OK" if report["ok"] else f"FAILED ({report['error']})"
        print(f"[{source['id']}] {status} - {report['count']} items")

    all_items = [it for it in all_items if it.get("link") and it.get("title")]
    seen = set()
    deduped = []
    for it in all_items:
        if it["link"] in seen:
            continue
        seen.add(it["link"])
        deduped.append(it)

    deduped.sort(key=lambda x: x.get("published") or "", reverse=True)

    print("\nFetching CISA KEV catalog...")
    kev_set = fetch_kev()
    print(f"[kev] {len(kev_set)} known-exploited CVEs loaded")

    cve_cache = load_cve_cache()
    all_cves = sorted(set(c for it in deduped for c in (it.get("cves") or [])))
    missing_count = len([c for c in all_cves if c not in cve_cache])
    print(f"[nvd] {len(all_cves)} distinct CVEs seen across this run, {missing_count} not yet cached")
    enrich_cvss_cache(all_cves, cve_cache)
    save_cve_cache(cve_cache)

    clusters = cluster_items(deduped)
    source_count_by_link = {link: c["source_count"] for c in clusters for link in c["item_links"]}

    for it in deduped:
        sc, bucket, kev_hit, max_cvss = score_item(it, source_count_by_link.get(it["link"]), kev_set, cve_cache)
        it["severity_score"] = sc
        it["severity_bucket"] = bucket
        it["kev"] = kev_hit
        it["cvss"] = max_cvss

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "items": deduped,
        "health": health,
        "clusters": clusters,
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print("\nFetching YouTube channel feeds...")
    try:
        write_videos()
    except Exception as e:  # never let the video side-feed break the article run
        print(f"[videos] WARNING: {type(e).__name__}: {e}")

    ok_count = sum(1 for h in health if h["ok"])
    print(f"\nWrote {len(deduped)} items ({len(clusters)} clusters) from {ok_count}/{len(SOURCES)} sources to {OUTPUT_FILE}")
    return 0 if ok_count > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
