// Harbor eBook source: ملوك الروايات (kolnovel.com)
const BASE = "https://kolnovel.com";
const PER_PAGE = 20;

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
  const a = item.querySelector("h3 a") || item.querySelector("a.kol-series-archive__cover");
  if (!a) return null;
  const href = a.attr("href") || "";
  const slug = extractSlug(href);
  if (!slug) return null;

  const titleEl = item.querySelector("h3 a") || item.querySelector("[data-kol-series-title-source]");
  const title = (titleEl ? titleEl.text() : slug).trim();
  const img = item.querySelector("img");
  const cover = img ? (img.attr("src") || img.attr("data-src")) : undefined;

  return {
    id: slug,
    title: title || slug,
    cover: cover,
    originalLanguage: "ar",
  };
}

const plugin = {
  id: "kolnovel",
  name: "ملوك الروايات",

  async popular(offset, tagId) {
    const page = Math.floor((offset || 0) / PER_PAGE) + 1;
    let path = "/series/?page=" + page;
    if (tagId && tagId.startsWith("order:")) {
      path += "&order=" + encodeURIComponent(tagId.slice(6));
    } else {
      path += "&order=popular";
    }
    if (tagId && tagId.startsWith("genre:")) {
      path += "&genre[]=" + encodeURIComponent(tagId.slice(6));
    }
    if (tagId && tagId.startsWith("status:")) {
      path += "&status=" + encodeURIComponent(tagId.slice(7));
    }
    const doc = await getDoc(path);
    const items = doc.querySelectorAll("article.kol-series-archive__item");
    return items.map(cardToSummary).filter(Boolean);
  },

  async search(query, offset, tagId) {
    const page = Math.floor((offset || 0) / PER_PAGE) + 1;
    let path = "/series/?title=" + encodeURIComponent(query.trim()) + "&page=" + page;
    if (tagId && tagId.startsWith("genre:")) {
      path += "&genre[]=" + encodeURIComponent(tagId.slice(6));
    }
    const doc = await getDoc(path);
    const items = doc.querySelectorAll("article.kol-series-archive__item");
    return items.map(cardToSummary).filter(Boolean);
  },

  async detail(id) {
    const doc = await getDoc("/series/" + encodeURIComponent(id) + "/");
    const titleEl = doc.querySelector("h1, h2.entry-title, .kol-series-editorial__title, [itemprop='headline']");
    const title = titleEl ? titleEl.text().trim() : id;

    const img = doc.querySelector(".kol-series-editorial__cover img, [data-kol-series-cover-link] img, meta[property='og:image']");
    const cover = img ? (img.attr("content") || img.attr("src") || img.attr("data-src")) : undefined;

    const descBlocks = doc.querySelectorAll(".kol-series-editorial__synopsis p, .kol-series-archive__excerpt, .entry-content p");
    const description = descBlocks.map(p => p.text().trim()).filter(Boolean).join("\n\n");

    const authorEl = doc.querySelector(".kol-series-editorial__author a, .kol-series-editorial__author");
    const author = authorEl ? authorEl.text().replace(/^المؤلف\s*:\s*/, "").trim() : undefined;

    const genreEls = doc.querySelectorAll(".kol-series-editorial__genres a, .kol-series-archive__genres-list span");
    const genres = genreEls.map(g => g.text().replace(/[·•]/g, "").trim()).filter(Boolean);

    const statusEl = doc.querySelector(".kol-series-editorial__status, .kol-series-archive__status");
    const statusText = statusEl ? statusEl.text().trim() : "";
    const status = statusText.includes("مكتمل") ? "completed" : "ongoing";

    return {
      id,
      title,
      author,
      cover,
      description: description || undefined,
      genres: [...new Set(genres)],
      originalLanguage: "ar",
      status,
    };
  },

  async chapters(id) {
    const doc = await getDoc("/series/" + encodeURIComponent(id) + "/");
    const links = doc.querySelectorAll("a[data-kol-chapter-id], a[data-kol-chapter-transition-link], .kol-series-editorial__volume a, .kol-series-editorial__chapter-groups a");
    const seen = new Set();
    const out = [];

    for (const a of links) {
      const href = a.attr("href") || "";
      if (!href || href.includes("chapter_page=") || href.includes("chapter_volume=")) continue;
      const slug = extractSlug(href);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);

      const numAttr = a.attr("data-kol-chapter-number") || "";
      let title = a.text().replace(/\s+/g, " ").trim();
      title = title.replace(/المشاهدات\s*\d+/g, "").replace(/\d{2}\/\d{2}\/\d{4}/g, "").trim();

      out.push({
        id: slug,
        chapter: numAttr || String(out.length + 1),
        title: title || ("فصل " + (numAttr || (out.length + 1))),
        language: "ar",
        pages: 0,
      });
    }

    out.sort((x, y) => {
      const nx = parseFloat(x.chapter) || 0;
      const ny = parseFloat(y.chapter) || 0;
      return nx - ny;
    });

    return out.map((c, position) => Object.assign(c, { position }));
  },

  async content(chapterId) {
    const doc = await getDoc("/" + encodeURIComponent(chapterId) + "/");
    const blocks = doc.querySelectorAll(".epcontent p, .entry-content p, .kol-app-text p");
    return blocks
      .map(p => p.text().replace(/\s+/g, " ").trim())
      .filter(p => p && !p.includes("ترجمة موقع ملوك الروايات") && !p.includes("لا تُلهِكُم القراءة"))
      .join("\n\n");
  },

  async tags() {
    return [
      { id: "order:popular", name: "الأكثر شعبية", group: "الترتيب" },
      { id: "order:latest", name: "أحدث الروايات", group: "الترتيب" },
      { id: "order:update", name: "آخر التحديثات", group: "الترتيب" },
      { id: "order:rating", name: "الأعلى تقييماً", group: "الترتيب" },
      { id: "status:ongoing", name: "مستمرة", group: "الحالة" },
      { id: "status:completed", name: "مكتملة", group: "الحالة" },
      { id: "genre:action", name: "أكشن", group: "التصنيف" },
      { id: "genre:fantasy", name: "فانتازيا", group: "التصنيف" },
      { id: "genre:martial-arts", name: "فنون قتالية", group: "التصنيف" },
      { id: "genre:adventure", name: "مغامرة", group: "التصنيف" },
      { id: "genre:mystery", name: "غموض", group: "التصنيف" },
      { id: "genre:comedy", name: "كوميديا", group: "التصنيف" },
      { id: "genre:drama", name: "دراما", group: "التصنيف" },
      { id: "genre:romance", name: "رومانسية", group: "التصنيف" },
      { id: "genre:sci-fi", name: "خيال علمي", group: "التصنيف" },
    ];
  },
};

return plugin;
