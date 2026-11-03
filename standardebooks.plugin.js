// Harbor eBook source: Standard Ebooks — free, carefully produced public-domain English ebooks.
const BASE = "https://standardebooks.org";
const PER = 48;
const SKIP = /\/(titlepage|halftitlepage|imprint|colophon|uncopyright|toc|loi)$/;

async function getDoc(path) {
  const res = await harbor.http(BASE + path, { responseType: "text" });
  if (!res.ok) throw new Error("http " + res.status + " for " + path);
  return harbor.parseHtml(res.body);
}

function abs(url) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return BASE + (url.startsWith("/") ? "" : "/") + url;
}

function listQuery(tagId) {
  if (tagId && tagId.startsWith("subject:")) return "&tags[]=" + encodeURIComponent(tagId.slice(8)) + "&sort=popularity";
  if (tagId && tagId.startsWith("sort:")) return "&sort=" + encodeURIComponent(tagId.slice(5));
  return "&sort=popularity";
}

function cardToSummary(li) {
  const id = (li.attr("about") || "").replace(/^\/ebooks\//, "");
  if (!id) return null;
  const name = li.querySelector('p > a [property="schema:name"]');
  const author = li.querySelector('.author [property="schema:name"]');
  const img = li.querySelector("img");
  return {
    id,
    title: name ? name.text().trim() : id,
    author: author ? author.text().trim() : undefined,
    cover: abs(img && img.attr("src")),
    originalLanguage: "en",
  };
}

async function list(extra, offset) {
  const page = Math.floor((offset || 0) / PER) + 1;
  const doc = await getDoc("/ebooks?per-page=" + PER + "&page=" + page + extra);
  return doc.querySelectorAll("ol.ebooks-list > li").map(cardToSummary).filter(Boolean);
}

const SUBJECTS = ["adventure", "autobiography", "biography", "childrens", "comedy", "drama", "fantasy", "fiction",
  "horror", "memoir", "mystery", "nonfiction", "philosophy", "poetry", "politics", "religion", "romance",
  "satire", "science-fiction", "shorts", "spirituality", "tragedy", "travel"];

const plugin = {
  id: "standardebooks",
  name: "Standard Ebooks",

  async popular(offset, tagId) {
    return list(listQuery(tagId), offset);
  },

  async search(query, offset, tagId) {
    return list("&query=" + encodeURIComponent(query.trim()) + listQuery(tagId), offset);
  },

  async detail(id) {
    const doc = await getDoc("/ebooks/" + id);
    const h1 = doc.querySelector("h1");
    if (!h1) return null;
    const authors = doc.querySelectorAll('[property="schema:author"] [property="schema:name"]').map((n) => n.text().trim());
    const og = doc.querySelector('meta[property="og:image"]');
    return {
      id,
      title: h1.text().trim(),
      author: [...new Set(authors)].join(", ") || undefined,
      cover: abs(og && og.attr("content")),
      description: doc.querySelectorAll("section#description p").map((p) => p.text().trim()).filter(Boolean).join("\n\n") || undefined,
      genres: doc.querySelectorAll("ul.tags a").map((a) => a.text().trim()).filter(Boolean),
      originalLanguage: "en",
      status: "completed",
    };
  },

  async chapters(id) {
    const doc = await getDoc("/ebooks/" + id + "/text");
    const seen = new Set();
    const out = [];
    for (const a of doc.querySelectorAll("a")) {
      const href = a.attr("href") || "";
      if (!/^text\/[\w.-]+$/.test(href)) continue;
      const cid = id + "/" + href;
      if (SKIP.test(cid) || seen.has(cid)) continue;
      seen.add(cid);
      out.push({ id: cid, position: out.length, title: a.text().replace(/\s+/g, " ").trim() || undefined, pages: 0, language: "en" });
    }
    return out;
  },

  async content(chapterId) {
    const doc = await getDoc("/ebooks/" + chapterId);
    const blocks = doc.querySelectorAll("main h2, main h3, main h4, main p, main td");
    return blocks.map((n) => n.text().replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
  },

  async tags() {
    return SUBJECTS.map((s) => ({ id: "subject:" + s, name: s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()), group: "Subject" }))
      .concat([
        { id: "sort:popularity", name: "Popular", group: "Sort" },
        { id: "sort:newest", name: "Newest", group: "Sort" },
        { id: "sort:length", name: "Length", group: "Sort" },
      ]);
  },
};

return plugin;
