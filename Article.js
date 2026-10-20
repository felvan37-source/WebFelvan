// api/article.js: merender halaman artikel di server agar Google langsung melihat judul, deskripsi, dan isi artikel.
const SITE = "https://www.felvancourse.online", GAS = "https://script.google.com/macros/s/AKfycbyMH2Tqm_eGNDB-V-EB6x9wMT1L59tOevuOICUpc-l-bu8bSw7BufMT1oJZrDK3hRe3kQ/exec", BRAND = "Felvan Course";
function slugify(t){var s=String(t==null?"":t);try{s=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"")}catch(e){}s=s.toLowerCase().replace(/&/g," dan ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");if(s.length>80){s=s.slice(0,80);var k=s.lastIndexOf("-");if(k>30)s=s.slice(0,k);s=s.replace(/-+$/,"")}return s}
const cleanText = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function clean(h) {
  return String(h || "").replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|noscript)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\/?(script|style|iframe|object|embed|form|noscript)\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "");
}
let shell, shellAt = 0;
async function getShell() {
  if (shell && Date.now() - shellAt < 60000) return shell;
  const r = await fetch(SITE + "/index.html");
  if (!r.ok) throw new Error("index.html " + r.status);
  shell = await r.text(); shellAt = Date.now();
  return shell;
}
function swap(h, tag, inner) {
  const re = new RegExp("<!--FV-SEO-" + tag + ":START-->[\\s\\S]*?<!--FV-SEO-" + tag + ":END-->");
  return re.test(h) ? h.replace(re, () => "<!--FV-SEO-" + tag + ":START-->\n" + inner + "\n<!--FV-SEO-" + tag + ":END-->") : h;
}
module.exports = async (req, res) => {
  const send = (code, html, cache, robots) => {
    res.statusCode = code; res.setHeader("Content-Type", "text/html; charset=utf-8"); res.setHeader("Cache-Control", cache);
    if (robots) res.setHeader("X-Robots-Tag", robots);
    res.end(html);
  };
  let raw = String((req.query && req.query.slug) || "");
  try { raw = decodeURIComponent(raw); } catch (e) {}
  let html;
  try { html = await getShell(); } catch (e) { res.statusCode = 302; res.setHeader("Location", "/"); return res.end(); }
  const noindex = h => h.replace("</head>", () => '<meta name="robots" content="noindex, nofollow"></head>');
  const m = raw.match(/(?:^|-)([A-Za-z]{2,5}\d{1,20})$/), id = m && m[1];
  if (!id) return send(200, noindex(html), "public, s-maxage=300", "noindex");

  let d;
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(GAS + "?api=getArticle&id=" + encodeURIComponent(id), { signal: ctl.signal });
    clearTimeout(t); d = await r.json();
  } catch (e) { return send(200, html, "no-store"); }   // Apps Script lambat: tampilkan aplikasi biasa
  if (!d || d.error || !d.title) return send(200, noindex(html), "public, s-maxage=120", "noindex");

  const title = cleanText(d.title, 120), canon = (slugify(title) || "artikel") + "-" + d.id;
  if (raw !== canon) {   // satu artikel = satu URL
    res.statusCode = 301; res.setHeader("Location", SITE + "/article/" + canon); res.setHeader("Cache-Control", "public, s-maxage=300");
    return res.end();
  }
  const url = SITE + "/article/" + canon, desc = cleanText(d.description, 160) || BRAND, full = title + " | " + BRAND;
  const img = d.coverUrl || SITE + "/logo-512.png", org = !d.author || /^admin$/i.test(d.author);
  const ld = {
    "@context": "https://schema.org", "@type": "Article", headline: title.slice(0, 110), description: desc, image: [img], inLanguage: "id",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": org ? "Organization" : "Person", name: org ? BRAND : d.author },
    publisher: { "@type": "Organization", name: BRAND, logo: { "@type": "ImageObject", url: SITE + "/logo-512.png" } }
  };
  if (d.ts) { ld.datePublished = ld.dateModified = new Date(d.ts).toISOString(); }
  const head = [
    `<title>${esc(full)}</title>`, `<meta name="description" content="${esc(desc)}">`,
    '<meta name="robots" content="index, follow, max-image-preview:large">', `<link id="canonicalLink" rel="canonical" href="${url}">`,
    '<meta name="felvan-ssr" content="1">',
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}<\/script>`,
    '<meta property="og:type" content="article">', `<meta property="og:site_name" content="${BRAND}">`,
    `<meta property="og:title" content="${esc(full)}">`, `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${url}">`, `<meta property="og:image" content="${esc(img)}">`, '<meta name="twitter:card" content="summary">'
  ].join("\n");
  const body = `<div class="sr-only"><article><h1 id="seoTitle">${esc(title)}</h1><p id="seoDesc">${esc(desc)}</p><div id="seoBody">${clean(d.content)}</div></article></div>`;
  send(200, swap(swap(html, "HEAD", head), "BODY", body), "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
};
