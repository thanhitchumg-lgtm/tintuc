// Vẽ lại trang chủ / chuyên mục từ mục lục mới nhất (dùng chung khuôn HTML với bản dựng tĩnh).
import config from '/js/config.js';
import { initNav } from '/js/site.js';
import { makeContext, homeBody, categoryBody, navHtml, footerHtml, notFoundBody } from '/shared/templates.mjs';
import { assignSlots, homeSections, categoryArticles, byNewest } from '/shared/home-layout.mjs';

const site = { siteName: config.siteName, tagline: config.tagline || '', siteUrl: config.siteUrl || location.origin };
const app = () => document.getElementById('app');

export function buildCtx(idx) {
  return makeContext({ site, menus: idx.menus || [], banners: idx.banners || [] });
}

// Cập nhật thanh menu + chân trang (phòng khi có menu mới thêm sau lần dựng web gần nhất)
export function refreshChrome(ctx, activeId = null) {
  const nav = document.querySelector('.nav');
  if (nav) { nav.outerHTML = navHtml(ctx, activeId); initNav(); }
  const footer = document.querySelector('.footer');
  if (footer) footer.outerHTML = footerHtml(ctx);
}

const sorted = (idx) => [...(idx.articles || [])].sort(byNewest);

export function renderHome(ctx, idx) {
  const articles = sorted(idx);
  const { slots, rest } = assignSlots(articles, config.homeSlots || 8);
  app().innerHTML = homeBody(ctx, { slots, rest, sections: homeSections(ctx.tree, articles) });
  refreshChrome(ctx, null);
}

export function renderCategory(ctx, idx, slug, pageNo = 1) {
  const menu = ctx.menus.find((m) => m.slug === slug);
  if (!menu) { renderNotFound(ctx); return false; }
  const list = categoryArticles(ctx.menus, menu, sorted(idx));
  const pageSize = config.pageSize || 20;
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, pageNo), pages);
  const parent = menu.parentId ? ctx.menusById.get(menu.parentId) : null;
  app().innerHTML = categoryBody(ctx, { menu, parent, articles: list.slice((page - 1) * pageSize, page * pageSize), page, pages });
  document.title = `${page === 1 ? menu.name : `${menu.name} - Trang ${page}`} - ${site.siteName}`;
  refreshChrome(ctx, menu.id);
  return true;
}

export function renderNotFound(ctx) {
  app().innerHTML = notFoundBody();
  document.title = `Không tìm thấy trang - ${site.siteName}`;
  if (ctx) refreshChrome(ctx);
}
