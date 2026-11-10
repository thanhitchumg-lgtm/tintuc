// Trang chủ và trang chuyên mục: hiện ngay bản dựng sẵn, rồi đọc mục lục mới nhất để cập nhật bài vừa đăng.
import { loadIndex } from '/js/index-client.js';
import { buildCtx, renderHome, renderCategory } from '/js/live-lib.js';

const html = document.documentElement;
const page = html.dataset.page;

if (page === 'home' || page === 'category') {
  loadIndex().then((idx) => {
    if (!idx) return;
    if ((idx.rev || '') === (html.dataset.rev || '')) return; // bản dựng sẵn đã là mới nhất
    const ctx = buildCtx(idx);
    if (page === 'home') renderHome(ctx, idx);
    else renderCategory(ctx, idx, html.dataset.menu, Number(html.dataset.pageno || 1));
  }).catch((e) => console.error('Không cập nhật được nội dung mới:', e));
}
