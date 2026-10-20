
// api/sitemap.js: sitemap otomatis berisi beranda + semua artikel publik (diakses lewat /sitemap.xml).
const SITE = "https://www.felvancourse.online", GAS = "https://script.google.com/macros/s/AKfycbyMH2Tqm_eGNDB-V-EB6x9wMT1L59tOevuOICUpc-l-bu8bSw7BufMT1oJZrDK3hRe3kQ/exec";
function slugify(t){var s=String(t==null?"":t);try{s=s.normalize("NFD").replace(/[\u0300-\u036f]/g,"")}catch(e){}s=s.toLowerCase().replace(/&/g," dan ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");if(s.length>80){s=s.slice(0,80);var k=s.lastIndexOf("-");if(k>30)s=s.slice(0,k);s=s.replace(/-+$/,"")}return s}
const cleanText = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
const x = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
module.exports = async (req, res) => {
  let items = [], ok = false;
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(GAS + "?api=listArticles", { signal: ctl.signal });
    clearTimeout(t); const j = await r.json(); items = j.items || []; ok = Array.isArray(j.items);
  } catch (e) {}
  const day = ms => new Date(ms).toISOString().slice(0, 10);
  const newest = items.reduce((a, i) => Math.max(a, i.ts || 0), 0) || Date.now();
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    "<url><loc>" + SITE + "/</loc><lastmod>" + day(newest) + "</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n";
  items.forEach(i => {
    xml += "<url><loc>" + x(SITE + "/article/" + (slugify(cleanText(i.title, 120)) || "artikel") + "-" + i.id) + "</loc>" + (i.ts ? "<lastmod>" + day(i.ts) + "</lastmod>" : "") + "</url>\n";
  });
  res.statusCode = 200; res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", ok ? "public, max-age=0, s-maxage=600, stale-while-revalidate=86400" : "no-store");
  res.end(xml + "</urlset>\n");
};
