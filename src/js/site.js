import { normalize, escapeHtml as h, formatDay, articlePath, cld } from '/shared/util.mjs';
import { loadIndex } from '/js/index-client.js';

// ---- Menu di động + ô tìm kiếm trên thanh menu (gọi lại được khi menu được vẽ lại) ----
let docListenerBound = false;
export function initNav() {
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  if (nav && toggle) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }
  const form = document.querySelector('.nav__searchform');
  if (form) {
    const input = form.querySelector('input');
    form.addEventListener('submit', (e) => {
      if (!form.classList.contains('is-open')) {
        e.preventDefault();
        form.classList.add('is-open');
        input.focus();
      } else if (!input.value.trim()) {
        e.preventDefault();
        form.classList.remove('is-open');
      }
    });
  }
  if (!docListenerBound) {
    docListenerBound = true;
    document.addEventListener('click', (e) => {
      const f = document.querySelector('.nav__searchform');
      const i = f?.querySelector('input');
      if (f && !f.contains(e.target) && !i.value) f.classList.remove('is-open');
    });
  }
}
initNav();

// ---- Trang tìm kiếm: lọc theo tiêu đề, gõ không dấu vẫn tìm được ----
const results = document.getElementById('search-results');
if (results) {
  const qInput = document.getElementById('q');
  const status = document.getElementById('search-status');
  let index = null;

  // Ưu tiên mục lục mới nhất (có cả bài vừa đăng); không đọc được thì dùng bản dựng sẵn
  async function loadSearchData() {
    try {
      const idx = await loadIndex();
      if (idx?.articles) {
        const byId = new Map((idx.menus || []).map((m) => [m.id, m]));
        return idx.articles.map((a) => ({
          t: a.title, n: normalize(a.title), u: articlePath(a, byId),
          i: a.heroImage?.url ? cld(a.heroImage.url, 'thumb') : '', d: a.publishedAt,
        }));
      }
    } catch (e) { console.warn('Dùng dữ liệu tìm kiếm dựng sẵn:', e); }
    return (await fetch('/search-index.json', { cache: 'no-cache' })).json();
  }

  const run = async () => {
    const raw = qInput.value.trim();
    if (!raw) { results.innerHTML = ''; status.textContent = 'Nhập từ khóa để tìm bài viết.'; return; }
    if (!index) {
      status.textContent = 'Đang tải dữ liệu tìm kiếm…';
      try { index = await loadSearchData(); }
      catch { status.textContent = 'Không tải được dữ liệu tìm kiếm. Vui lòng thử lại.'; return; }
    }
    const words = normalize(raw).split(' ').filter(Boolean);
    const hits = index.filter((a) => words.every((w) => a.n.includes(w)));
    status.textContent = hits.length ? `Tìm thấy ${hits.length} bài viết cho "${raw}"` : `Không có bài viết nào khớp với "${raw}".`;
    results.innerHTML = hits.slice(0, 50).map((a) => `<article class="row"><a class="row__img" href="${h(a.u)}" tabindex="-1" aria-hidden="true">${a.i ? `<img src="${h(a.i)}" alt="" loading="lazy">` : '<span class="noimg"></span>'}</a>
      <div class="row__body"><h3 class="row__title"><a href="${h(a.u)}">${h(a.t)}</a></h3><div class="meta"><time>${h(formatDay(a.d))}</time></div></div></article>`).join('');
  };

  const params = new URLSearchParams(location.search);
  qInput.value = params.get('q') || '';
  qInput.addEventListener('input', () => {
    clearTimeout(run._t);
    run._t = setTimeout(run, 150);
  });
  qInput.closest('form').addEventListener('submit', (e) => { e.preventDefault(); run(); history.replaceState(null, '', `?q=${encodeURIComponent(qInput.value)}`); });
  run();
}
