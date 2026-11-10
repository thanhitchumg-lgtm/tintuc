import config from '/js/config.js';
import { h, $, toast } from '/admin/ui.js';
import { dashboardView, articleListView, articleFormView } from '/admin/views-articles.js';
import { menusView, bannersView, usersView } from '/admin/views-manage.js';

const root = document.getElementById('root');
let store;
let profile = null;
let cleanup = null;
let menusCache = null;
let pendingCount = 0;

const ctx = {
  config,
  get store() { return store; },
  get profile() { return profile; },
  get isAdmin() { return profile?.role === 'admin'; },
  go: (hash) => { if (location.hash === hash) route(); else location.hash = hash; },
  async getMenus(force = false) {
    if (!menusCache || force) menusCache = await store.listMenus();
    return menusCache;
  },
  async refreshBadges(list) {
    if (!ctx.isAdmin) return;
    try {
      const articles = list || await store.listArticles(profile);
      pendingCount = articles.filter((a) => a.status === 'pending').length;
      const b = $('#nav-pending');
      if (b) { b.textContent = pendingCount; b.hidden = !pendingCount; }
    } catch { /* bỏ qua */ }
  },
};

/* ---------- Màn hình đăng nhập ---------- */
function showLogin(message = '') {
  cleanup?.(); cleanup = null; profile = null;
  root.innerHTML = `<div class="login"><form class="login__box" id="login" novalidate>
    <div class="login__brand"><span class="brand-mark">${h(config.siteName.charAt(0))}</span><div><b>${h(config.siteName)}</b><div class="muted small">Trang quản trị</div></div></div>
    ${config.mode === 'demo' ? '<div class="notice small"><b>Chế độ DEMO</b> (dữ liệu chỉ lưu trong trình duyệt này).<br>Admin: <code>' + h(config.ownerEmail) + '</code><br>Biên tập viên: <code>editor@example.com</code><br>Mật khẩu: nhập gì cũng được.</div>' : ''}
    <label class="field"><span>Email</span><input id="email" type="email" autocomplete="username" required autofocus></label>
    <label class="field"><span>Mật khẩu</span><input id="password" type="password" autocomplete="current-password" required></label>
    <div class="login__err" id="err" role="alert">${h(message)}</div>
    <button class="btn btn--primary btn--block" type="submit" id="go">Đăng nhập</button>
    <button class="link center-link" type="button" id="forgot">Quên mật khẩu?</button>
    <a class="center-link small" href="/">← Về trang web</a>
  </form></div>`;
  const err = (t) => { $('#err').textContent = t; };
  $('#login').onsubmit = async (e) => {
    e.preventDefault();
    const email = $('#email').value.trim(); const pw = $('#password').value;
    if (!email || !pw) { err('Vui lòng nhập email và mật khẩu.'); return; }
    const btn = $('#go'); btn.disabled = true; btn.textContent = 'Đang đăng nhập…'; err('');
    try { await store.signIn(email, pw); } catch (ex) { err(ex.message); btn.disabled = false; btn.textContent = 'Đăng nhập'; }
  };
  $('#forgot').onclick = async () => {
    const email = $('#email').value.trim();
    if (!email) { err('Nhập email của bạn vào ô Email rồi bấm lại "Quên mật khẩu".'); return; }
    try { await store.resetPassword(email); err(''); toast('Nếu email tồn tại, hệ thống đã gửi hướng dẫn đặt lại mật khẩu.'); }
    catch (ex) { err(ex.message); }
  };
}

function showNoAccess(user) {
  root.innerHTML = `<div class="login"><div class="login__box"><h2>Chưa có quyền truy cập</h2>
    <p>Tài khoản <b>${h(user.email)}</b> đã đăng nhập nhưng chưa được cấp quyền quản trị (hoặc đã bị khóa).</p>
    <p class="muted">Vui lòng liên hệ quản trị viên để được thêm vào danh sách người dùng.</p>
    <button class="btn btn--block" id="out">Đăng xuất</button></div></div>`;
  $('#out').onclick = () => store.signOut();
}

function showFatal(e) {
  root.innerHTML = `<div class="login"><div class="login__box"><h2>Không khởi động được trang quản trị</h2>
    <p>${h(e?.message || 'Lỗi không xác định.')}</p><p class="muted">Kiểm tra kết nối mạng và cấu hình Firebase, rồi tải lại trang.</p></div></div>`;
}

/* ---------- Khung trang quản trị ---------- */
const NAV = [
  { hash: '#/', label: 'Tổng quan', icon: '◧' },
  { hash: '#/bai-viet', label: 'Bài viết', icon: '✎', badge: true },
  { hash: '#/menu', label: 'Menu', icon: '☰', admin: true },
  { hash: '#/banner', label: 'Banner', icon: '▣', admin: true },
  { hash: '#/nguoi-dung', label: 'Người dùng', icon: '☺', admin: true },
];

function showShell() {
  root.innerHTML = `<div class="shell">
    <aside class="side" id="side">
      <div class="side__brand"><span class="brand-mark">${h(config.siteName.charAt(0))}</span><b>${h(config.siteName)}</b></div>
      <nav class="side__nav">${NAV.filter((n) => !n.admin || ctx.isAdmin).map((n) =>
        `<a href="${n.hash}" data-hash="${n.hash}"><span class="ico">${n.icon}</span>${h(n.label)}${n.badge && ctx.isAdmin ? ' <span class="count" id="nav-pending" hidden>0</span>' : ''}</a>`).join('')}</nav>
      <div class="side__foot"><a href="/" target="_blank" rel="noopener">Xem website ↗</a></div>
    </aside>
    <div class="content">
      <header class="top"><button class="burger" id="burger" aria-label="Menu">☰</button><div class="top__sp"></div>
        <div class="who"><b>${h(profile.displayName || profile.email)}</b><span class="role-tag">${profile.role === 'admin' ? 'Admin' : 'Biên tập viên'}</span></div>
        <button class="btn btn--sm" id="logout">Đăng xuất</button></header>
      ${config.mode === 'demo' ? '<div class="demo-bar">CHẾ ĐỘ DEMO · dữ liệu lưu trong trình duyệt, không ảnh hưởng website thật <button class="link" id="demo-reset" type="button">Đặt lại dữ liệu mẫu</button></div>' : ''}
      <main class="view" id="view"></main>
    </div></div>`;
  $('#logout').onclick = () => store.signOut();
  $('#burger').onclick = () => $('#side').classList.toggle('is-open');
  $('#side').onclick = (e) => { if (e.target.closest('a')) $('#side').classList.remove('is-open'); };
  $('#demo-reset')?.addEventListener('click', async () => { await store.resetDemo(); menusCache = null; location.reload(); });
  menusCache = null;
  route();
  ctx.refreshBadges();
}

/* ---------- Điều hướng ---------- */
async function route() {
  const view = $('#view');
  if (!view || !profile) return;
  cleanup?.(); cleanup = null;
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [page, arg] = parts;

  $('.side__nav').querySelectorAll('a').forEach((a) => {
    const t = a.dataset.hash.replace(/^#\/?/, '').split('/')[0] || '';
    a.classList.toggle('is-on', t === (page || ''));
  });

  const host = document.createElement('div');
  view.replaceChildren(host);
  window.scrollTo(0, 0);

  try {
    if (!page) await dashboardView(ctx, host);
    else if (page === 'bai-viet' && !arg) await articleListView(ctx, host);
    else if (page === 'bai-viet') cleanup = await articleFormView(ctx, host, decodeURIComponent(arg));
    else if (page === 'menu' && ctx.isAdmin) await menusView(ctx, host);
    else if (page === 'banner' && ctx.isAdmin) await bannersView(ctx, host);
    else if (page === 'nguoi-dung' && ctx.isAdmin) await usersView(ctx, host);
    else host.innerHTML = '<h1 class="page-h">Không có quyền hoặc không tìm thấy trang</h1><p><a class="btn" href="#/">Về tổng quan</a></p>';
  } catch (e) {
    console.error(e);
    host.innerHTML = `<div class="notice notice--err"><b>Có lỗi xảy ra:</b> ${h(e.message || e)}</div>`;
  }
}

window.addEventListener('hashchange', route);

/* ---------- Khởi động ---------- */
(async function start() {
  root.innerHTML = '<div class="boot">Đang tải…</div>';
  try {
    store = config.mode === 'demo'
      ? (await import('/admin/store-demo.js')).createStore()
      : (await import('/admin/store-firebase.js')).createStore();
  } catch (e) { showFatal(e); return; }

  let first = true;
  store.onAuth(async (user, startupError) => {
    if (startupError) { showFatal(startupError); return; }
    if (!user) { showLogin(); first = false; return; }
    try {
      profile = await store.getProfile(user);
    } catch (e) {
      console.error(e);
      showLogin(`Không đọc được quyền của tài khoản: ${e.message}`);
      return;
    }
    first = false;
    if (!profile || !['admin', 'editor'].includes(profile.role)) { showNoAccess(user); return; }
    showShell();
  });
})();
