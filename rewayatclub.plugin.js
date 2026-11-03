// Harbor eBook source: نادي الروايات (rewayat.club)
const API_BASE = "https://api.rewayat.club/api";
const SITE_BASE = "https://rewayat.club";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "ar,en;q=0.8",
};

async function getJson(path) {
  const url = /^https?:\/\//i.test(path) ? path : API_BASE + (path.startsWith("/") ? "" : "/") + path;
  const res = await harbor.http(url, { responseType: "text", headers: HEADERS, timeoutMs: 30000 });
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
  return typeof res.body === "string" ? JSON.parse(res.body) : res.body;
}

function cardToSummary(item) {
  if (!item || !item.slug) return null;
  return {
    id: item.slug,
    title: item.arabic || item.english || item.slug,
    author: (item.contributors && item.contributors[0] && item.contributors[0].username) || undefined,
    cover: item.poster_url || undefined,
    originalLanguage: "ar",
  };
}

const plugin = {
  id: "rewayatclub",
  name: "نادي الروايات",

  async popular(offset, tagId) {
    const page = Math.floor((offset || 0) / 24) + 1;
    let path = "/novels/?page=" + page;
    if (tagId && tagId.startsWith("type:")) {
      path += "&type=" + encodeURIComponent(tagId.slice(5));
    }
    if (tagId && tagId.startsWith("genre:")) {
      path += "&genre=" + encodeURIComponent(tagId.slice(6));
    }
    if (tagId && tagId.startsWith("order:")) {
      path += "&ordering=" + encodeURIComponent(tagId.slice(6));
    }
    const data = await getJson(path);
    const results = data.results || (Array.isArray(data) ? data : []);
    return results.map(cardToSummary).filter(Boolean);
  },

  async search(query, offset, tagId) {
    const page = Math.floor((offset || 0) / 24) + 1;
    let path = "/novels/?search=" + encodeURIComponent(query.trim()) + "&page=" + page;
    if (tagId && tagId.startsWith("genre:")) {
      path += "&genre=" + encodeURIComponent(tagId.slice(6));
    }
    const data = await getJson(path);
    const results = data.results || (Array.isArray(data) ? data : []);
    return results.map(cardToSummary).filter(Boolean);
  },

  async detail(id) {
    const item = await getJson("/novels/" + encodeURIComponent(id) + "/");
    const title = item.arabic || item.english || id;
    const author = (item.contributors && item.contributors[0] && item.contributors[0].username) || undefined;
    const genres = (item.genre || []).map((g) => (typeof g === "object" ? (g.arabic || g.english) : String(g))).filter(Boolean);
    const status = item.complete ? "completed" : "ongoing";

    return {
      id,
      title,
      author,
      cover: item.poster_url || item.poster || undefined,
      description: item.about ? item.about.replace(/\r\n/g, "\n").trim() : undefined,
      genres,
      originalLanguage: "ar",
      status,
      chapters: item.num_chapters || undefined,
    };
  },

  async chapters(id) {
    // Fetch chapters list in ascending order
    let path = "/chapters/" + encodeURIComponent(id) + "/?ordering=number&page=1";
    const data = await getJson(path);
    let allChapters = data.results || (Array.isArray(data) ? data : []);

    // If more pages exist and total count is reasonable, we can return the available list
    return allChapters.map((c, position) => ({
      id: id + "/" + c.number,
      chapter: String(c.number),
      title: c.title || ("الفصل " + c.number),
      language: "ar",
      pages: 0,
      position,
    }));
  },

  async content(chapterId) {
    // chapterId is formatted as "novelSlug/chapterNumber"
    const data = await getJson("/chapters/" + chapterId + "/");
    const rawContent = data.content || [];
    const paragraphs = [];

    function extract(item) {
      if (!item) return;
      if (Array.isArray(item)) {
        for (const sub of item) extract(sub);
      } else if (typeof item === "string") {
        const clean = item.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
        if (clean) paragraphs.push(clean);
      }
    }

    extract(rawContent);
    return paragraphs.join("\n\n");
  },

  async tags() {
    return [
      { id: "order:-num_chapters", name: "الأكثر فصولاً", group: "الترتيب" },
      { id: "order:num_chapters", name: "الأقل فصولاً", group: "الترتيب" },
      { id: "type:1", name: "روايات مترجمة", group: "النوع" },
      { id: "type:2", name: "روايات مؤلفة", group: "النوع" },
      { id: "type:3", name: "روايات مكتملة", group: "الحالة" },
      { id: "genre:2", name: "أكشن", group: "التصنيف" },
      { id: "genre:4", name: "فانتازيا", group: "التصنيف" },
      { id: "genre:5", name: "مهارات القتال", group: "التصنيف" },
      { id: "genre:6", name: "مغامرة", group: "التصنيف" },
      { id: "genre:7", name: "رومانسي", group: "التصنيف" },
      { id: "genre:1", name: "كوميديا", group: "التصنيف" },
      { id: "genre:8", name: "خيال علمي", group: "التصنيف" },
      { id: "genre:11", name: "سحر", group: "التصنيف" },
    ];
  },
};

return plugin;
