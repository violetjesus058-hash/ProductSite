import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataPath = path.join(root, "client/src/data/products.ts");
const publicDir = path.join(root, "client/public");
const siteUrl = "https://productsite-8wf.pages.dev";
const source = fs.readFileSync(dataPath, "utf8");
const ids = [...source.matchAll(/\"id\"\s*:\s*\"([^\"]+)\"/g)].map((match) => match[1]);
const uniqueIds = [...new Set(ids)];
const urls = [
  { loc: `${siteUrl}/`, changefreq: "daily", priority: "1.0" },
  ...uniqueIds.map((id) => ({ loc: `${siteUrl}/product/${id}`, changefreq: "weekly", priority: "0.8" })),
];
const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(({ loc, changefreq, priority }) => `  <url><loc>${escapeXml(loc)}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`).join("\n")}\n</urlset>\n`;
const robots = `User-agent: *\nAllow: /\nDisallow: /__manus__/\nDisallow: /src/\nDisallow: /node_modules/\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
fs.writeFileSync(path.join(publicDir, "sitemap.xml"), sitemap);
fs.writeFileSync(path.join(publicDir, "robots.txt"), robots);
console.log(`Generated SEO files for ${uniqueIds.length} product URLs at ${siteUrl}`);
