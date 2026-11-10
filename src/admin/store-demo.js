import { applyChange } from '/admin/index-sync.js';

// Chế độ DEMO: dữ liệu lưu trong trình duyệt (localStorage), để xem thử trang quản trị mà không cần Firebase.
const KEY = 'tintuc-demo-db-v1';
const SESSION = 'tintuc-demo-user';
const now = () => new Date().toISOString();
const uid = () => 'x' + Math.random().toString(36).slice(2, 10);
const clone = (x) => JSON.parse(JSON.stringify(x));

async function load() {
  let db = null;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { /* bỏ qua */ }
  if (!db) {
    db = await (await fetch('/sample/data.json')).json();
    save(db);
  }
  return db;
}
const INDEX_KEY = 'tintuc-demo-index';
// Mục lục công khai (giống meta/index trên Firestore) để trang chủ demo hiện bài vừa đăng ngay
function syncIndex(db) {
  const published = db.articles.filter((a) => a.status === 'published');
  localStorage.setItem(INDEX_KEY, JSON.stringify(applyChange(null, { menus: db.menus, banners: db.banners, articles: published })));
}
const save = (db) => { localStorage.setItem(KEY, JSON.stringify(db)); syncIndex(db); };

export function createStore() {
  const listeners = new Set();
  const current = () => { try { return JSON.parse(sessionStorage.getItem(SESSION)); } catch { return null; } };

  return {
    mode: 'demo',
    onAuth(cb) {
      listeners.add(cb);
      setTimeout(() => cb(current()), 0);
      return () => listeners.delete(cb);
    },
    async signIn(email, password) {
      const db = await load();
      const u = db.users.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase());
      if (!u || !password) throw new Error('Email hoặc mật khẩu không đúng. (Demo: dùng email trong gợi ý, mật khẩu bất kỳ)');
      const user = { uid: u.uid, email: u.email };
      sessionStorage.setItem(SESSION, JSON.stringify(user));
      listeners.forEach((cb) => cb(user));
    },
    async signOut() { sessionStorage.removeItem(SESSION); listeners.forEach((cb) => cb(null)); },
    async resetPassword() { /* demo: không gửi email */ },
    async getProfile(user) {
      const db = await load();
      const u = db.users.find((x) => x.uid === user.uid);
      return u && (u.role === 'admin' || u.role === 'editor') ? { ...u } : null;
    },

    async listMenus() { return clone((await load()).menus); },
    async saveMenu(m) {
      const db = await load();
      if (m.id) db.menus = db.menus.map((x) => (x.id === m.id ? { ...x, ...m } : x));
      else { m = { ...m, id: uid() }; db.menus.push(m); }
      save(db); return m.id;
    },
    async deleteMenu(id) { const db = await load(); db.menus = db.menus.filter((m) => m.id !== id); save(db); },

    async listArticles(profile) {
      const db = await load();
      const list = profile.role === 'admin' ? db.articles : db.articles.filter((a) => a.authorUid === profile.uid);
      return clone(list).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    },
    async getArticle(id) { return clone((await load()).articles.find((a) => a.id === id) || null); },
    async saveArticle(a, profile) {
      const db = await load();
      const body = { ...a, updatedAt: now() };
      if (a.id) db.articles = db.articles.map((x) => (x.id === a.id ? { ...x, ...body } : x));
      else { body.id = uid(); body.createdAt = now(); body.authorUid = a.authorUid || profile.uid; body.authorName = a.authorName || profile.displayName; db.articles.push(body); }
      save(db); return body.id || a.id;
    },
    async patchArticle(id, patch) {
      const db = await load();
      db.articles = db.articles.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x));
      save(db);
    },
    async deleteArticle(id) { const db = await load(); db.articles = db.articles.filter((a) => a.id !== id); save(db); },
    async setFeatured(id, slot) {
      const db = await load();
      db.articles = db.articles.map((x) => {
        if (x.id === id) return { ...x, featuredSlot: slot || null };
        if (slot && x.featuredSlot === slot) return { ...x, featuredSlot: null };
        return x;
      });
      save(db);
    },

    async listBanners() { return clone((await load()).banners); },
    async saveBanner(b) {
      const db = await load();
      if (b.id) db.banners = db.banners.map((x) => (x.id === b.id ? { ...x, ...b } : x));
      else { b = { ...b, id: uid() }; db.banners.push(b); }
      save(db); return b.id;
    },
    async deleteBanner(id) { const db = await load(); db.banners = db.banners.filter((b) => b.id !== id); save(db); },

    async listUsers() { return clone((await load()).users); },
    async createUser({ email, displayName, role }) {
      const db = await load();
      if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new Error('Email này đã có trong danh sách.');
      const u = { uid: uid(), email, displayName: displayName || email, role };
      db.users.push(u); save(db); return u.uid;
    },
    async updateUser(id, patch) {
      const db = await load();
      db.users = db.users.map((u) => (u.uid === id ? { ...u, ...patch } : u));
      save(db);
    },
    async getIndexInfo() {
      const d = JSON.parse(localStorage.getItem(INDEX_KEY) || 'null');
      return d && { rev: d.rev, count: d.articles.length, total: d.total, updatedAt: d.updatedAt };
    },
    async rebuildIndex() { const db = await load(); syncIndex(db); return db.articles.filter((a) => a.status === 'published').length; },
    async resetDemo() { localStorage.removeItem(KEY); localStorage.removeItem(INDEX_KEY); },
  };
}
