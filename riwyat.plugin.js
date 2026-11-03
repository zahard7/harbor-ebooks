// Harbor eBook source: فضاء الروايات (riwyat.com)
const BASE = "https://riwyat.com";
const PER_PAGE = 18;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en;q=0.8",
};

async function getDoc(path) {
  const url = /^https?:\/\//i.test(path) ? path : BASE + (path.startsWith("/") ? "" : "/") + path;
  const res = await harbor.http(url, { responseType: "text", headers: HEADERS, timeoutMs: 30000 });
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return harbor.parseHtml(res.body);
}

function extractSlug(url) {
  if (!url) return "";
  const clean = url.replace(BASE, "").replace(/\/+$/, "");
  const parts = clean.split("/");
  return decodeURIComponent(parts[parts.length - 1] || "");
}

function cardToSummary(item) {
  const a = item.querySelector(".post-title a, h3 a, h4 a, .item-thumb a");
  if (!a) return null;
  const href = a.attr("href") || "";
  const slug = extractSlug(href);
  if (!slug) return null;

  const title = (a.text() || slug).trim();
  const img = item.querySelector("img");
  const cover = img ? (img.attr("data-src") || img.attr("src")) : undefined;

  return {
    id: slug,
    title,
    cover,
    originalLanguage: "ar",
  };
}

const plugin = {
  id: "riwyat",
  name: "فضاء الروايات",

  async popular(offset, tagId) {
    const page = Math.floor((offset || 0) / PER_PAGE) + 1;
    let path = "/novel/";
    if (page > 1) path += "page/" + page + "/";
    path += "?m_orderby=" + (tagId && tagId.startsWith("order:") ? encodeURIComponent(tagId.slice(6)) : "views");

    if (tagId && tagId.startsWith("genre:")) {
      path = "/novel-genre/" + encodeURIComponent(tagId.slice(6)) + "/";
      if (page > 1) path += "page/" + page + "/";
    }

    const doc = await getDoc(path);
    const items = doc.querySelectorAll(".page-item-detail, .c-tabs-item__content, .badge-pos-1");
    return items.map(cardToSummary).filter(Boolean);
  },

  async search(query, offset, tagId) {
    const page = Math.floor((offset || 0) / PER_PAGE) + 1;
    let path = "/?s=" + encodeURIComponent(query.trim()) + "&post_type=wp-manga";
    if (page > 1) path += "&paged=" + page;
    const doc = await getDoc(path);
    const items = doc.querySelectorAll(".c-tabs-item__content, .row.c-tabs-item__content");
    return items.map(cardToSummary).filter(Boolean);
  },

  async detail(id) {
    const doc = await getDoc("/novel/" + encodeURIComponent(id) + "/");
    const titleEl = doc.querySelector(".post-title h1, .post-title h3, h1");
    const title = titleEl ? titleEl.text().trim() : id;

    const img = doc.querySelector(".summary_image img, meta[property='og:image']");
    const cover = img ? (img.attr("content") || img.attr("data-src") || img.attr("src")) : undefined;

    const descBlocks = doc.querySelectorAll(".description-summary p, .summary__content p");
    const description = descBlocks.map(p => p.text().trim()).filter(Boolean).join("\n\n");

    const authorEl = doc.querySelector(".author-content a, .author-content");
    const author = authorEl ? authorEl.text().trim() : undefined;

    const genreEls = doc.querySelectorAll(".genres-content a");
    const genres = genreEls.map(g => g.text().trim()).filter(Boolean);

    const statusEl = doc.querySelector(".post-status .summary-content");
    const statusText = statusEl ? statusEl.text().trim() : "";
    const status = statusText.includes("مكتمل") ? "completed" : "ongoing";

    return {
      id,
      title,
      author,
      cover,
      description: description || undefined,
      genres,
      originalLanguage: "ar",
      status,
    };
  },

  async chapters(id) {
    const doc = await getDoc("/novel/" + encodeURIComponent(id) + "/");
    const links = doc.querySelectorAll(".wp-manga-chapter a");
    const seen = new Set();
    const out = [];

    for (const a of links) {
      const href = a.attr("href") || "";
      if (!href || href.includes("#")) continue;
      const cleanPath = href.replace(BASE, "").replace(/^\/+|\/+$/g, "");
      if (!cleanPath || seen.has(cleanPath)) continue;
      seen.add(cleanPath);

      const title = a.text().replace(/\s+/g, " ").trim();
      const matchNum = /(\d+(?:\.\d+)?)/.exec(title);
      const chapterNum = matchNum ? matchNum[1] : String(out.length + 1);

      out.push({
        id: cleanPath,
        chapter: chapterNum,
        title: title || ("فصل " + chapterNum),
        language: "ar",
        pages: 0,
      });
    }

    // Usually presented latest first, reverse to order ascending
    out.reverse();
    return out.map((c, position) => Object.assign(c, { position }));
  },

  async content(chapterId) {
    const doc = await getDoc("/" + chapterId + "/");
    const blocks = doc.querySelectorAll(".reading-content p, .entry-content p, .text-left p");
    return blocks
      .map(p => p.text().replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n\n");
  },

  async tags() {
    return [
      { id: "order:views", name: "الأكثر مشاهدة", group: "الترتيب" },
      { id: "order:trending", name: "الرائج", group: "الترتيب" },
      { id: "order:latest", name: "الأحدث", group: "الترتيب" },
      { id: "order:rating", name: "الأعلى تقييماً", group: "الترتيب" },
      { id: "genre:فنون-قتالية", name: "فنون قتالية", group: "التصنيف" },
      { id: "genre:أكشن", name: "أكشن", group: "التصنيف" },
      { id: "genre:مغامرة", name: "مغامرة", group: "التصنيف" },
      { id: "genre:فانتازيا", name: "فانتازيا", group: "التصنيف" },
      { id: "genre:رومانسية", name: "رومانسية", group: "التصنيف" },
      { id: "genre:دراما", name: "دراما", group: "التصنيف" },
      { id: "genre:مكتملة", name: "مكتملة", group: "الحالة" },
    ];
  },
};

return plugin;
