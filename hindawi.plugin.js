// Harbor eBook source: مؤسسة هنداوي (safahat.org) — free Arabic books published by the foundation.
const BASE = "https://www.safahat.org";
const PAGE_SIZE = 20;

async function getDoc(path) {
  const res = await harbor.http(BASE + path, { responseType: "text" });
  if (!res.ok) throw new Error("http " + res.status + " for " + path);
  return harbor.parseHtml(res.body);
}

function cover(id) {
  return "https://downloads.hindawi.org/covers/svg/270x360/" + id + ".svg";
}

function bookId(href) {
  const m = /\/books\/(\d{5,})\/?$/.exec(href || "");
  return m ? m[1] : null;
}

function cardToSummary(li) {
  const a = li.querySelector("a");
  const id = bookId(a && a.attr("href"));
  if (!id) return null;
  const alt = (li.querySelector("img") && li.querySelector("img").attr("alt")) || "";
  return { id, title: alt.replace(/^كتاب بعنوان\s*/, "").trim() || id, cover: cover(id) };
}

const CATEGORIES = [
  ["literature", "أدب"], ["novels", "روايات"], ["history", "تاريخ"], ["philosophy", "فلسفة"],
  ["science", "علوم"], ["religions", "أديان"], ["biographies", "سير وتراجم"], ["poetry", "شعر"],
  ["plays", "مسرحيات"], ["psychology", "علم نفس"], ["politics", "سياسة"], ["economics", "اقتصاد"],
  ["social.sciences", "علوم اجتماعية"], ["science.fiction", "خيال علمي"], ["detective.fiction", "روايات بوليسية"],
  ["children.stories", "قصص أطفال"], ["arts", "فنون"], ["travel.literature", "أدب الرحلات"],
  ["literary.criticism", "نقد أدبي"], ["linguistics", "لغويات"], ["health", "صحة"],
  ["technology", "تكنولوجيا"], ["geography", "جغرافيا"], ["business", "أعمال"],
  ["environmental.sciences", "علوم بيئية"],
];

const plugin = {
  id: "hindawi",
  name: "مؤسسة هنداوي",

  async popular(offset, tagId) {
    const page = Math.floor((offset || 0) / PAGE_SIZE) + 1;
    let path;
    if (tagId && tagId.startsWith("cat:")) {
      path = "/books/categories/" + tagId.slice(4) + "/" + (page > 1 ? page + "/" : "");
    } else {
      path = "/books/" + (page > 1 ? page + "/" : "");
    }
    const doc = await getDoc(path);
    return doc.querySelectorAll("li.bookCover").map(cardToSummary).filter(Boolean);
  },

  async search(query, offset, tagId) {
    const doc = await getDoc("/search/keyword/" + encodeURIComponent(query.trim()) + "/");
    const seen = new Set();
    const out = [];
    for (const li of doc.querySelectorAll(".searchResults ul.list li")) {
      const links = li.querySelectorAll("a");
      const id = bookId(links[0] && links[0].attr("href"));
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, title: links[0].text().trim(), cover: cover(id) });
    }
    const start = offset || 0;
    return out.slice(start, start + 48);
  },

  async detail(id) {
    const doc = await getDoc("/books/" + id + "/");
    const root = doc.querySelector("div.details");
    if (!root) return null;
    const authors = root.querySelectorAll(".meta li a").map((a) => a.text().trim()).filter(Boolean);
    const desc = root.querySelectorAll(".content > div:first-child p").map((p) => p.text().trim()).filter(Boolean);
    const chapterCount = doc
      .querySelectorAll("a")
      .filter((a) => new RegExp("^/books/" + id + "/\\d+/$").test(a.attr("href") || "")).length;
    return {
      id,
      title: (root.querySelector("h2") && root.querySelector("h2").text().trim()) || id,
      author: authors.join("، ") || undefined,
      cover: cover(id),
      description: desc.join("\n\n") || undefined,
      genres: root.querySelectorAll("ul.tags a").map((a) => a.text().trim()).filter(Boolean),
      originalLanguage: "ar",
      status: "completed",
      chapters: chapterCount || undefined,
    };
  },

  async chapters(id) {
    const doc = await getDoc("/books/" + id + "/");
    const re = new RegExp("^/books/" + id + "/(\\d+)/$");
    const seen = new Set();
    const out = [];
    for (const a of doc.querySelectorAll("a")) {
      const m = re.exec(a.attr("href") || "");
      if (!m || seen.has(m[1])) continue;
      seen.add(m[1]);
      out.push({ id: id + "/" + m[1], chapter: m[1], title: a.text().trim() || undefined, pages: 0, language: "ar" });
    }
    out.sort((x, y) => Number(x.chapter) - Number(y.chapter));
    return out.map((c, position) => Object.assign(c, { position }));
  },

  async content(chapterId) {
    const doc = await getDoc("/books/" + chapterId + "/");
    const blocks = doc.querySelectorAll(
      "article.chapterContent h1.title, article.chapterContent h4.title, article.chapterContent p, article.chapterContent div.phrase",
    );
    return blocks.map((n) => n.text().replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
  },

  async tags() {
    return CATEGORIES.map(([id, name]) => ({ id: "cat:" + id, name, group: "التصنيف" }));
  },
};

return plugin;
