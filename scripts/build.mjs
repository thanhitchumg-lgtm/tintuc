// Dựng website tĩnh vào thư mục dist/.
//   node scripts/build.mjs            -> lấy dữ liệu thật từ Firestore (cần biến môi trường FIREBASE_SERVICE_ACCOUNT)
//   node scripts/build.mjs --sample   -> dùng dữ liệu mẫu để xem thử giao diện (admin chạy chế độ demo)
//   node scripts/build.mjs --empty    -> dựng web trống (kiểm tra nhanh, không cần Firebase)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, layout, homeBody, categoryBody, articleMain, articleJsonLd, articleDescription, searchBody, notFoundBody } from '../src/shared/templates.mjs';
import { assignSlots, byNewest, homeSections, categoryArticles } from '../src/shared/home-layout.mjs';
import { normalize, cld, articlePath, escapeHtml as h, slugify, RESERVED_SLUGS } from '../src/shared/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const SAMPLE = args.includes('--sample');
const EMPTY = args.includes('--empty');
const OUT = path.resolve(ROOT, args.find((a) => a.startsWith('--out='))?.slice(6) || 'dist');

const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/site.json'), 'utf8'));

/* ---------- 1. Lấy dữ liệu ---------- */
let data;
if (EMPTY) {
  data = { menus: [], banners: [], articles: [] };
} else if (SAMPLE) {
  const m = await import('./sample-data.mjs');
  data = { menus: m.sampleMenus, banners: m.sampleBanners, articles: m.sampleArticles.filter((a) => a.status === 'published') };
} else {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) {
    console.error('Thiếu biến môi trường FIREBASE_SERVICE_ACCOUNT (nội dung file khóa JSON của tài khoản dịch vụ).');
    process.exit(1);
  }
  const { fetchContent } = await import('./firestore-rest.mjs');
  data = await fetchContent(sa);
}

/* ---------- 2. Chuẩn hóa dữ liệu ---------- */
const menus = data.menus.map((m) => ({ ...m, slug: RESERVED_SLUGS.includes(m.slug) ? `${m.slug}-muc` : m.slug }));
const menuIds = new Set(menus.map((m) => m.id));

const used = new Set();
const articles = data.articles
  .filter((a) => a.status === 'published' && a.title)
  .sort(byNewest)
  .reverse() // cũ nhất xử lý trước để bài cũ giữ slug gốc
  .map((a) => {
    const menuList = (a.menuIds || []).filter((id) => menuIds.has(id));
    const primary = menuIds.has(a.primaryMenuId) ? a.primaryMenuId : menuList[0] || null;
    let base = slugify(a.slug || a.title) || a.id;
    if (RESERVED_SLUGS.includes(base)) base += '-bai-viet';
    let slug = base;
    let n = 2;
    while (used.has(`${primary}/${slug}`)) slug = `${base}-${n++}`;
    used.add(`${primary}/${slug}`);
    return { ...a, slug, menuIds: menuList, primaryMenuId: primary };
  })
  .sort(byNewest);

const ctx = makeContext({ site, menus, banners: data.banners, articles });
const REV = data.rev || '';
const attrs = (page, extra = '') => `data-page="${page}" data-rev="${h(REV)}"${extra ? ' ' + extra : ''}`;
const LIVE = ['/js/live.js'];

/* ---------- 3. Chuẩn bị thư mục ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const copyDir = (from, to) => fs.cpSync(path.join(ROOT, from), path.join(OUT, to), { recursive: true });
copyDir('src/css', 'css');
copyDir('src/js', 'js');
copyDir('src/shared', 'shared');
copyDir('src/admin', 'admin');

const publicConfig = {
  mode: SAMPLE ? 'demo' : 'firebase',
  siteName: site.siteName,
  tagline: site.tagline,
  siteUrl: site.siteUrl,
  ownerEmail: site.ownerEmail,
  firebase: site.firebase,
  cloudinary: site.cloudinary,
  homeSlots: site.homeSlots,
  githubRepo: site.githubRepo,
};
fs.writeFileSync(path.join(OUT, 'js/config.js'), `export default ${JSON.stringify(publicConfig, null, 2)};\n`);

fs.writeFileSync(path.join(OUT, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#12303b"/><text x="32" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#ff7a1a">${h(site.siteName.charAt(0))}</text></svg>`);
fs.writeFileSync(path.join(OUT, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${site.siteUrl.replace(/\/$/, '')}/sitemap.xml\n`);

if (SAMPLE) {
  const { writeSampleAssets } = await import('./sample-data.mjs');
  writeSampleAssets(OUT);
}

fs.writeFileSync(path.join(OUT, 'rev.txt'), REV || 'none');

const writePage = (urlPath, html) => {
  const file = urlPath.endsWith('.html') ? path.join(OUT, urlPath) : path.join(OUT, urlPath, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
};

/* ---------- 4. Trang chủ ---------- */
const { slots, rest } = assignSlots(articles, site.homeSlots || 8);
const sections = homeSections(ctx.tree, articles);

writePage('/', layout(ctx, {
  title: '', path: '/', description: site.tagline,
  image: slots[0]?.heroImage?.url,
  body: homeBody(ctx, { slots, rest, sections }),
  htmlAttrs: attrs('home'),
  scripts: LIVE,
}));

/* ---------- 5. Chuyên mục (có phân trang) ---------- */
const pageSize = site.pageSize || 20;
for (const menu of menus) {
  const list = categoryArticles(menus, menu, articles);
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const parent = menu.parentId ? ctx.menusById.get(menu.parentId) : null;
  for (let p = 1; p <= pages; p++) {
    const urlPath = p === 1 ? `/${menu.slug}/` : `/${menu.slug}/p/${p}/`;
    writePage(urlPath, layout(ctx, {
      title: p === 1 ? menu.name : `${menu.name} - Trang ${p}`,
      description: `Tin tức chuyên mục ${menu.name}`,
      path: urlPath,
      activeId: menu.id,
      image: list[0]?.heroImage?.url,
      body: categoryBody(ctx, { menu, parent, articles: list.slice((p - 1) * pageSize, p * pageSize), page: p, pages }),
      htmlAttrs: attrs('category', `data-menu="${h(menu.slug)}" data-pageno="${p}"`),
      scripts: LIVE,
    }));
  }
}

/* ---------- 6. Bài viết ---------- */
for (const a of articles) {
  const urlPath = articlePath(a, ctx.menusById);
  const related = articles.filter((r) => r.id !== a.id && r.primaryMenuId === a.primaryMenuId).slice(0, 4);
  writePage(urlPath, layout(ctx, {
    title: a.seoTitle || a.title,
    description: articleDescription(a),
    path: urlPath,
    image: a.heroImage?.url,
    type: 'article',
    activeId: a.primaryMenuId,
    jsonLd: articleJsonLd(ctx, a, urlPath),
    body: articleMain(ctx, a, related),
  }));
}

/* ---------- 7. Tìm kiếm, 404, trang xem bài dự phòng, sitemap ---------- */
writePage('/tim-kiem/', layout(ctx, {
  title: 'Tìm kiếm', path: '/tim-kiem/', description: 'Tìm bài viết theo tiêu đề', body: searchBody(), noindex: true,
}));
fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify(articles.map((a) => ({
  t: a.title,
  n: normalize(a.title),
  u: articlePath(a, ctx.menusById),
  i: a.heroImage?.url ? cld(a.heroImage.url, 'thumb') : '',
  d: a.publishedAt,
}))));

writePage('/404.html', layout(ctx, { title: 'Không tìm thấy trang', path: '/404/', body: notFoundBody(), noindex: true }));

// Trang dự phòng: bài mới đăng nhưng web chưa kịp dựng lại sẽ được tải trực tiếp từ Firestore
const boot = JSON.stringify({ menus, banners: data.banners }).replace(/</g, '\\u003c');
writePage('/_viewer.html', layout(ctx, {
  title: 'Đang tải bài viết', path: '/', noindex: true,
  body: `<div class="container"><p class="loading" id="viewer-status">Đang tải bài viết…</p></div><script type="application/json" id="boot">${boot}</script>`,
  htmlAttrs: attrs('viewer'),
  scripts: ['/js/viewer.js'],
}));

const base = site.siteUrl.replace(/\/$/, '');
const urls = [
  { loc: '/', lastmod: slots[0]?.publishedAt },
  ...menus.map((m) => ({ loc: `/${m.slug}/` })),
  ...articles.map((a) => ({ loc: articlePath(a, ctx.menusById), lastmod: a.updatedAt || a.publishedAt })),
];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `<url><loc>${h(base + u.loc)}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`);

console.log(`Đã dựng xong → ${path.relative(process.cwd(), OUT) || '.'}: ${articles.length} bài, ${menus.length} chuyên mục${SAMPLE ? ' (DỮ LIỆU MẪU)' : ''}`);
