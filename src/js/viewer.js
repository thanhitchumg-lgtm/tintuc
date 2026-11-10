// Trang xem dự phòng: bài hoặc chuyên mục mới mà bản dựng tĩnh chưa có thì dựng ngay từ Firestore.
import { fbCore, normDoc } from '/js/fb.js';
import config from '/js/config.js';
import { loadIndex } from '/js/index-client.js';
import { articleMain, articleDescription } from '/shared/templates.mjs';
import { buildCtx, renderCategory, renderNotFound, refreshChrome } from '/js/live-lib.js';

const status = document.getElementById('viewer-status');
const app = document.getElementById('app');

async function main() {
  const idx = await loadIndex();
  const boot = JSON.parse(document.getElementById('boot').textContent);
  const ctx = buildCtx(idx || { menus: boot.menus, banners: boot.banners, articles: [] });
  const segs = location.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  // /ten-chuyen-muc hoặc /ten-chuyen-muc/p/2
  if (segs.length === 1 || (segs.length === 3 && segs[1] === 'p')) {
    renderCategory(ctx, idx || { articles: [] }, segs[0], segs.length === 3 ? Number(segs[2]) || 1 : 1);
    return;
  }
  if (segs.length !== 2) return renderNotFound(ctx);

  const [menuSlug, slug] = segs;
  const menu = ctx.menus.find((m) => m.slug === menuSlug);
  let candidates;
  if (config.mode === 'demo') {
    // Chế độ xem thử: dữ liệu nằm trong trình duyệt
    let db = null;
    try { db = JSON.parse(localStorage.getItem('tintuc-demo-db-v1')); } catch { /* bỏ qua */ }
    candidates = (db?.articles || []).filter((a) => a.slug === slug && a.status === 'published');
  } else {
    const { db, fsM } = await fbCore();
    const snap = await fsM.getDocs(fsM.query(
      fsM.collection(db, 'articles'), fsM.where('slug', '==', slug), fsM.where('status', '==', 'published'), fsM.limit(5),
    ));
    candidates = snap.docs.map(normDoc);
  }
  const found = candidates.find((a) => !menu || a.primaryMenuId === menu.id || (a.menuIds || []).includes(menu.id)) || candidates[0];
  if (!found) return renderNotFound(ctx);

  const related = (idx?.articles || []).filter((r) => r.id !== found.id && r.primaryMenuId === found.primaryMenuId).slice(0, 4);
  app.innerHTML = articleMain(ctx, found, related);
  document.title = `${found.seoTitle || found.title} - ${config.siteName}`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = articleDescription(found).slice(0, 200);
  refreshChrome(ctx, found.primaryMenuId);
}

main().catch((e) => {
  console.error(e);
  if (status) status.textContent = 'Không tải được nội dung. Vui lòng thử lại sau.';
});
