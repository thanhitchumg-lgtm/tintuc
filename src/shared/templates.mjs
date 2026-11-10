// Khuôn HTML dùng chung cho Node (dựng trang tĩnh) và trình duyệt (trang xem bài dự phòng).
import { escapeHtml as h, cld, formatDate, articlePath, truncate, stripTags } from './util.mjs';
import { sanitizeHtml } from './sanitize.mjs';
import { buildMenuTree } from './home-layout.mjs';

export function makeContext({ site, menus, banners = [], articles = [] }) {
  const menusById = new Map(menus.map((m) => [m.id, m]));
  return {
    site, menus, menusById, banners, articles,
    tree: buildMenuTree(menus),
    url: (a) => articlePath(a, menusById),
  };
}

const img = (src, alt, preset, cls = '') =>
  src ? `<img class="${cls}" src="${h(cld(src, preset))}" alt="${h(alt || '')}" loading="lazy" decoding="async">` : `<span class="noimg ${cls}"></span>`;

/* ---------- Khung trang ---------- */

export function navHtml(ctx, activeId) {
  const MAX_INLINE = 6;
  const inline = ctx.tree.slice(0, MAX_INLINE);
  const more = ctx.tree.slice(MAX_INLINE);
  const item = (m) => {
    const active = m.id === activeId || m.children.some((c) => c.id === activeId);
    const sub = m.children.length
      ? `<ul class="nav__sub">${m.children.map((c) => `<li><a href="/${h(c.slug)}/">${h(c.name)}</a></li>`).join('')}</ul>`
      : '';
    return `<li class="nav__item${active ? ' is-active' : ''}${sub ? ' has-sub' : ''}"><a href="/${h(m.slug)}/">${h(m.name)}</a>${sub}</li>`;
  };
  const moreHtml = more.length
    ? `<li class="nav__item has-sub nav__more"><a href="#" aria-label="Thêm chuyên mục">•••</a><ul class="nav__sub nav__sub--right">${more
        .map((m) => `<li><a href="/${h(m.slug)}/">${h(m.name)}</a></li>`).join('')}</ul></li>`
    : '';
  return `<nav class="nav" aria-label="Chuyên mục">
  <div class="container nav__inner">
    <a class="nav__home" href="/" aria-label="Trang chủ"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg></a>
    <button class="nav__toggle" type="button" aria-label="Mở menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <ul class="nav__list">${inline.map(item).join('')}${moreHtml}</ul>
    <form class="nav__searchform" action="/tim-kiem/" role="search"><input type="search" name="q" placeholder="Tìm theo tiêu đề..." aria-label="Tìm kiếm" autocomplete="off"><button type="submit" aria-label="Tìm"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button></form>
  </div>
</nav>`;
}

export function footerHtml(ctx) {
  const links = ctx.tree.map((m) => `<a href="/${h(m.slug)}/">${h(m.name)}</a>`).join('');
  return `<footer class="footer"><div class="container">
  <div class="footer__brand">${h(ctx.site.siteName)}</div>
  <div class="footer__links">${links}</div>
  <p class="footer__copy">© ${new Date().getFullYear()} ${h(ctx.site.siteName)}. Bảo lưu mọi quyền.</p>
</div></footer>`;
}

export function layout(ctx, { title, description, path = '/', image = '', body, activeId = null, type = 'website', jsonLd = null, noindex = false, bodyClass = '', scripts = [], htmlAttrs = '' }) {
  const s = ctx.site;
  const fullTitle = title ? `${title} - ${s.siteName}` : `${s.siteName} - ${s.tagline}`;
  const canonical = s.siteUrl.replace(/\/$/, '') + path;
  const desc = truncate(description || s.tagline, 200);
  const ogImage = image ? cld(image, 'hero') : '';
  return `<!doctype html>
<html lang="vi"${htmlAttrs ? ' ' + htmlAttrs : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(fullTitle)}</title>
<meta name="description" content="${h(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}<link rel="canonical" href="${h(canonical)}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${h(s.siteName)}">
<meta property="og:title" content="${h(title || s.siteName)}">
<meta property="og:description" content="${h(desc)}">
<meta property="og:url" content="${h(canonical)}">
${ogImage ? `<meta property="og:image" content="${h(ogImage)}">\n<meta name="twitter:card" content="summary_large_image">` : ''}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/site.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="${h(bodyClass)}">
<div class="topbar"><div class="container topbar__inner">
  <a class="brand" href="/"><span class="brand__mark">${h(s.siteName.charAt(0))}</span><span class="brand__name">${h(s.siteName)}</span></a>
  <span class="topbar__tag">${h(s.tagline)}</span>
</div></div>
${navHtml(ctx, activeId)}
<main id="app">${body}</main>
${footerHtml(ctx)}
<script type="module" src="/js/site.js"></script>
${scripts.map((x) => `<script type="module" src="${h(x)}"></script>`).join('')}
</body>
</html>`;
}

/* ---------- Thành phần ---------- */

const meta = (a, ctx) => {
  const m = ctx.menusById.get(a.primaryMenuId) || ctx.menusById.get(a.menuIds?.[0]);
  return `<div class="meta">${m ? `<span class="meta__menu">${h(m.name)}</span>` : ''}<time datetime="${h(a.publishedAt || '')}">${h(formatDate(a.publishedAt))}</time></div>`;
};

export function card(a, ctx, { preset = 'card', cls = '' } = {}) {
  if (!a) return '';
  return `<article class="card ${cls}"><a class="card__link" href="${h(ctx.url(a))}">
  <span class="card__img">${img(a.heroImage?.url, a.heroImage?.alt || a.title, preset)}</span>
  <h3 class="card__title">${h(a.title)}</h3></a></article>`;
}

export function item(a, ctx) {
  if (!a) return '';
  return `<article class="item"><a class="item__link" href="${h(ctx.url(a))}">
  <span class="item__img">${img(a.heroImage?.url, a.heroImage?.alt || a.title, 'thumb')}</span>
  <h3 class="item__title">${h(a.title)}</h3></a></article>`;
}

export function row(a, ctx) {
  return `<article class="row"><a class="row__img" href="${h(ctx.url(a))}" tabindex="-1" aria-hidden="true">${img(a.heroImage?.url, a.heroImage?.alt || a.title, 'card')}</a>
  <div class="row__body"><h3 class="row__title"><a href="${h(ctx.url(a))}">${h(a.title)}</a></h3>
  ${meta(a, ctx)}
  ${a.summary ? `<p class="row__sum">${h(truncate(a.summary, 180))}</p>` : ''}</div></article>`;
}

export function bannerList(ctx, position, limit = 3) {
  const list = ctx.banners
    .filter((b) => b.active !== false && b.position === position && b.imageUrl)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, limit);
  if (!list.length) return '';
  return `<div class="banners">${list.map((b) => {
    const inner = `${img(b.imageUrl, b.title, 'banner')}<span class="banner__tag">Quảng cáo</span>`;
    return b.linkUrl
      ? `<a class="banner" href="${h(b.linkUrl)}" target="_blank" rel="nofollow sponsored noopener noreferrer">${inner}</a>`
      : `<div class="banner">${inner}</div>`;
  }).join('')}</div>`;
}

/* ---------- Trang chủ ---------- */

export function homeBody(ctx, { slots, rest, sections }) {
  const s = slots;
  const latest = rest.slice(0, 10);
  if (!s.some(Boolean)) {
    return `<div class="container"><div class="empty-home"><h1 class="page-title">Website đang cập nhật nội dung</h1><p>Chưa có bài viết nào được đăng. Vui lòng quay lại sau.</p></div></div>`;
  }
  return `<div class="container">
  <div class="home-top">
    <div class="home-main">
      ${card(s[0], ctx, { preset: 'lead', cls: 'card--lead' })}
      <div class="grid2">${card(s[6], ctx)}${card(s[7], ctx)}</div>
    </div>
    <div class="home-col2">
      ${card(s[1], ctx, { cls: 'card--col' })}
      <div class="items">${[s[2], s[3], s[4], s[5]].map((a) => item(a, ctx)).join('')}</div>
    </div>
    <aside class="home-banners">${bannerList(ctx, 'home-right', 3)}</aside>
  </div>
  ${latest.length ? `<section class="section"><div class="section__head"><h2 class="section__title">Tin mới nhất</h2></div>
    <div class="layout-2"><div class="rows">${latest.map((a) => row(a, ctx)).join('')}</div>
    <aside class="sidebar">${bannerList(ctx, 'sidebar', 2)}</aside></div></section>` : ''}
  ${sections.map(({ menu, articles }) => `<section class="section"><div class="section__head">
    <h2 class="section__title"><a href="/${h(menu.slug)}/">${h(menu.name)}</a></h2>
    ${menu.children?.length ? `<div class="section__subs">${menu.children.map((c) => `<a href="/${h(c.slug)}/">${h(c.name)}</a>`).join('')}</div>` : ''}
    <a class="section__more" href="/${h(menu.slug)}/">Xem thêm</a></div>
    <div class="grid4">${articles.map((a) => card(a, ctx)).join('')}</div></section>`).join('')}
</div>`;
}

/* ---------- Chuyên mục ---------- */

export function categoryBody(ctx, { menu, parent, articles, page, pages }) {
  const base = `/${menu.slug}/`;
  const pageLink = (n) => (n === 1 ? base : `${base}p/${n}/`);
  let pager = '';
  if (pages > 1) {
    const nums = [];
    for (let n = 1; n <= pages; n++) nums.push(n === page ? `<span class="is-current">${n}</span>` : `<a href="${pageLink(n)}">${n}</a>`);
    pager = `<nav class="pager" aria-label="Phân trang">${page > 1 ? `<a href="${pageLink(page - 1)}">‹ Trước</a>` : ''}${nums.join('')}${page < pages ? `<a href="${pageLink(page + 1)}">Sau ›</a>` : ''}</nav>`;
  }
  const subs = ctx.menus.filter((m) => m.parentId === menu.id && m.visible !== false);
  return `<div class="container">
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Trang chủ</a>${parent ? ` › <a href="/${h(parent.slug)}/">${h(parent.name)}</a>` : ''} › <span>${h(menu.name)}</span></nav>
  <div class="section__head"><h1 class="page-title">${h(menu.name)}</h1>${subs.length ? `<div class="section__subs">${subs.map((c) => `<a href="/${h(c.slug)}/">${h(c.name)}</a>`).join('')}</div>` : ''}</div>
  <div class="layout-2"><div class="rows">${articles.length ? articles.map((a) => row(a, ctx)).join('') : '<p class="empty">Chưa có bài viết trong chuyên mục này.</p>'}${pager}</div>
  <aside class="sidebar">${bannerList(ctx, 'sidebar', 3)}</aside></div>
</div>`;
}

/* ---------- Bài viết ---------- */

export function articleMain(ctx, a, related = []) {
  const m = ctx.menusById.get(a.primaryMenuId) || ctx.menusById.get(a.menuIds?.[0]);
  const parent = m?.parentId ? ctx.menusById.get(m.parentId) : null;
  const chips = (a.menuIds || []).map((id) => ctx.menusById.get(id)).filter(Boolean)
    .map((x) => `<a href="/${h(x.slug)}/">${h(x.name)}</a>`).join('');
  const hero = a.heroImage?.url
    ? `<figure class="article__hero"><img src="${h(cld(a.heroImage.url, 'hero'))}" alt="${h(a.heroImage.alt || a.title)}">${a.heroImage.alt ? `<figcaption>${h(a.heroImage.alt)}</figcaption>` : ''}</figure>`
    : '';
  const body = sanitizeHtml(a.contentHtml || '').replace(
    /(<img src=")(https:\/\/res\.cloudinary\.com\/[^"]+)(")/g,
    (_, p1, url, p3) => `${p1}${h(cld(url.replace(/&amp;/g, '&'), 'body'))}${p3}`,
  );
  return `<div class="container">
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Trang chủ</a>${parent ? ` › <a href="/${h(parent.slug)}/">${h(parent.name)}</a>` : ''}${m ? ` › <a href="/${h(m.slug)}/">${h(m.name)}</a>` : ''}</nav>
  <div class="layout-2 layout-2--article">
    <article class="article">
      <h1 class="article__title">${h(a.title)}</h1>
      <div class="article__meta">${a.authorName ? `<span>${h(a.authorName)}</span> · ` : ''}<time datetime="${h(a.publishedAt || '')}">${h(formatDate(a.publishedAt))}</time></div>
      ${a.summary ? `<p class="article__sapo">${h(a.summary)}</p>` : ''}
      ${hero}
      <div class="article__body">${body}</div>
      ${chips ? `<div class="chips"><span>Chuyên mục:</span>${chips}</div>` : ''}
    </article>
    <aside class="sidebar">${bannerList(ctx, 'sidebar', 3)}</aside>
  </div>
  ${related.length ? `<section class="section"><div class="section__head"><h2 class="section__title">Bài liên quan</h2></div><div class="grid4">${related.map((r) => card(r, ctx)).join('')}</div></section>` : ''}
</div>`;
}

export function articleJsonLd(ctx, a, path) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: a.title,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt || a.publishedAt,
    author: a.authorName ? [{ '@type': 'Person', name: a.authorName }] : undefined,
    image: a.heroImage?.url ? [a.heroImage.url] : undefined,
    publisher: { '@type': 'Organization', name: ctx.site.siteName },
    mainEntityOfPage: ctx.site.siteUrl.replace(/\/$/, '') + path,
  };
}

export function articleDescription(a) {
  return a.seoDescription || a.summary || truncate(stripTags(a.contentHtml), 160);
}

/* ---------- Tìm kiếm / 404 ---------- */

export function searchBody() {
  return `<div class="container">
  <nav class="breadcrumb"><a href="/">Trang chủ</a> › <span>Tìm kiếm</span></nav>
  <h1 class="page-title">Tìm kiếm</h1>
  <form class="searchbox" action="/tim-kiem/" role="search"><input id="q" type="search" name="q" placeholder="Nhập từ khóa trong tiêu đề (gõ không dấu cũng được)" autocomplete="off" autofocus><button type="submit">Tìm</button></form>
  <p id="search-status" class="search-status"></p>
  <div id="search-results" class="rows"></div>
</div>`;
}

export function notFoundBody() {
  return `<div class="container notfound"><h1 class="page-title">Không tìm thấy trang</h1>
  <p>Đường dẫn bạn truy cập không tồn tại hoặc bài viết đã được gỡ.</p><p><a class="btn" href="/">Về trang chủ</a></p></div>`;
}
