// Lớp dữ liệu thật: Firebase Authentication + Firestore.
import config from '/js/config.js';
import { fbAuth, normDoc } from '/js/fb.js';
import { applyChange } from '/admin/index-sync.js';

const MESSAGES = {
  'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
  'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
  'auth/user-not-found': 'Email hoặc mật khẩu không đúng.',
  'auth/invalid-email': 'Email không hợp lệ.',
  'auth/too-many-requests': 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.',
  'auth/user-disabled': 'Tài khoản đã bị vô hiệu hóa.',
  'auth/network-request-failed': 'Không kết nối được mạng. Vui lòng kiểm tra lại.',
  'auth/weak-password': 'Mật khẩu quá yếu (tối thiểu 6 ký tự).',
  'auth/operation-not-allowed': 'Chưa bật đăng nhập Email/Password trong Firebase Authentication.',
  'permission-denied': 'Bạn không có quyền thực hiện thao tác này.',
};
const friendly = (e) => {
  const err = new Error(MESSAGES[e?.code] || MESSAGES[(e?.code || '').replace('firestore/', '')] || e?.message || 'Có lỗi xảy ra.');
  err.code = e?.code;
  return err;
};
const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw friendly(e); } };

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function createStore() {
  // Cập nhật "mục lục" công khai. Chỉ Admin ghi được; Biên tập viên chỉ làm việc với bài chưa đăng nên bỏ qua.
  let isAdminUser = false;
  const syncIndex = async (change) => {
    if (!isAdminUser) return;
    const { db, fsM } = await fbAuth();
    const ref = fsM.doc(db, 'meta', 'index');
    try {
      await fsM.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        tx.set(ref, applyChange(snap.exists() ? snap.data() : null, change));
      });
      try { sessionStorage.removeItem('tintuc-index-cache'); } catch { /* bỏ qua */ }
    } catch (e) {
      throw Object.assign(new Error('Đã lưu, nhưng chưa cập nhật được mục lục trang chủ (' + (e.message || e.code) + '). Vào Tổng quan bấm "Đồng bộ lại mục lục".'), { code: 'index-sync' });
    }
  };
  const publishedDoc = async (id) => {
    const { db, fsM } = await fbAuth();
    const s = await fsM.getDoc(fsM.doc(db, 'articles', id));
    return s.exists() ? normDoc(s) : null;
  };

  const store = {
    mode: 'firebase',

    onAuth(cb) {
      let unsub = () => {};
      fbAuth().then(({ auth, authM }) => {
        unsub = authM.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
      }).catch((e) => { console.error(e); cb(null, e); });
      return () => unsub();
    },

    signIn: wrap(async (email, password) => {
      const { auth, authM } = await fbAuth();
      await authM.signInWithEmailAndPassword(auth, email, password);
    }),
    signOut: wrap(async () => { const { auth, authM } = await fbAuth(); await authM.signOut(auth); }),
    resetPassword: wrap(async (email) => { const { auth, authM } = await fbAuth(); await authM.sendPasswordResetEmail(auth, email); }),

    // Lấy vai trò của người đăng nhập. Chủ web (ownerEmail) lần đầu đăng nhập sẽ được tự tạo hồ sơ Admin.
    getProfile: wrap(async (user) => {
      const { db, fsM } = await fbAuth();
      const ref = fsM.doc(db, 'users', user.uid);
      let snap;
      try { snap = await fsM.getDoc(ref); } catch (e) { if (e.code !== 'permission-denied') throw e; }
      if (snap?.exists()) {
        const p = snap.data();
        isAdminUser = p.role === 'admin';
        return { uid: user.uid, email: user.email, displayName: p.displayName || user.email, role: p.role, isOwner: !!p.isOwner };
      }
      if (user.email && user.email.toLowerCase() === config.ownerEmail.toLowerCase()) {
        const profile = { email: user.email, displayName: 'Quản trị', role: 'admin', isOwner: true, createdAt: fsM.serverTimestamp() };
        await fsM.setDoc(ref, profile);
        isAdminUser = true;
        return { uid: user.uid, email: user.email, displayName: 'Quản trị', role: 'admin', isOwner: true };
      }
      return null;
    }),

    /* ---- Menu ---- */
    listMenus: wrap(async () => {
      const { db, fsM } = await fbAuth();
      const s = await fsM.getDocs(fsM.collection(db, 'menus'));
      return s.docs.map(normDoc);
    }),
    saveMenu: wrap(async (m) => {
      const { db, fsM } = await fbAuth();
      const { id, ...data } = m;
      const body = clean({ name: data.name, slug: data.slug, parentId: data.parentId || null, order: Number(data.order) || 0, visible: data.visible !== false });
      let rid = id;
      if (id) await fsM.setDoc(fsM.doc(db, 'menus', id), body);
      else rid = (await fsM.addDoc(fsM.collection(db, 'menus'), body)).id;
      await syncIndex({ menus: await store.listMenus() });
      return rid;
    }),
    deleteMenu: wrap(async (id) => {
      const { db, fsM } = await fbAuth();
      await fsM.deleteDoc(fsM.doc(db, 'menus', id));
      await syncIndex({ menus: await store.listMenus() });
    }),

    /* ---- Bài viết ---- */
    listArticles: wrap(async (profile) => {
      const { db, fsM } = await fbAuth();
      const col = fsM.collection(db, 'articles');
      const q = profile.role === 'admin' ? fsM.query(col) : fsM.query(col, fsM.where('authorUid', '==', profile.uid));
      const s = await fsM.getDocs(q);
      return s.docs.map(normDoc).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    }),
    getArticle: wrap(async (id) => {
      const { db, fsM } = await fbAuth();
      const s = await fsM.getDoc(fsM.doc(db, 'articles', id));
      return s.exists() ? normDoc(s) : null;
    }),
    saveArticle: wrap(async (a, profile) => {
      const { db, fsM } = await fbAuth();
      const ts = (iso) => (iso ? fsM.Timestamp.fromDate(new Date(iso)) : null);
      const body = clean({
        title: a.title, slug: a.slug, summary: a.summary || '', contentHtml: a.contentHtml || '',
        heroImage: a.heroImage?.url ? { url: a.heroImage.url, alt: a.heroImage.alt || '' } : null,
        menuIds: a.menuIds || [], primaryMenuId: a.primaryMenuId || null,
        status: a.status, featuredSlot: a.featuredSlot ?? null,
        authorUid: a.authorUid || profile.uid, authorName: a.authorName || profile.displayName,
        seoTitle: a.seoTitle || '', seoDescription: a.seoDescription || '',
        publishedAt: ts(a.publishedAt),
        updatedAt: fsM.serverTimestamp(),
      });
      let rid = a.id;
      if (a.id) await fsM.updateDoc(fsM.doc(db, 'articles', a.id), body);
      else { body.createdAt = fsM.serverTimestamp(); rid = (await fsM.addDoc(fsM.collection(db, 'articles'), body)).id; }
      if (isAdminUser) await syncIndex({ upsert: await publishedDoc(rid) });
      return rid;
    }),
    patchArticle: wrap(async (id, patch) => {
      const { db, fsM } = await fbAuth();
      const body = { ...patch, updatedAt: fsM.serverTimestamp() };
      if ('publishedAt' in patch) body.publishedAt = patch.publishedAt ? fsM.Timestamp.fromDate(new Date(patch.publishedAt)) : null;
      await fsM.updateDoc(fsM.doc(db, 'articles', id), body);
      if (isAdminUser) await syncIndex({ upsert: await publishedDoc(id) });
    }),
    deleteArticle: wrap(async (id) => {
      const { db, fsM } = await fbAuth();
      await fsM.deleteDoc(fsM.doc(db, 'articles', id));
      await syncIndex({ remove: id });
    }),

    // Đặt vị trí nổi bật cho bài; bài khác đang giữ vị trí đó sẽ về xếp theo thời gian
    setFeatured: wrap(async (id, slot) => {
      const { db, fsM } = await fbAuth();
      const batch = fsM.writeBatch(db);
      if (slot) {
        const s = await fsM.getDocs(fsM.query(fsM.collection(db, 'articles'), fsM.where('featuredSlot', '==', slot)));
        s.docs.filter((d) => d.id !== id).forEach((d) => batch.update(d.ref, { featuredSlot: null }));
      }
      batch.update(fsM.doc(db, 'articles', id), { featuredSlot: slot || null });
      await batch.commit();
      await syncIndex({ featured: { id, slot: slot || null } });
    }),

    /* ---- Banner ---- */
    listBanners: wrap(async () => {
      const { db, fsM } = await fbAuth();
      return (await fsM.getDocs(fsM.collection(db, 'banners'))).docs.map(normDoc);
    }),
    saveBanner: wrap(async (b) => {
      const { db, fsM } = await fbAuth();
      const { id, ...d } = b;
      const body = clean({ title: d.title || '', imageUrl: d.imageUrl, linkUrl: d.linkUrl || '', position: d.position, order: Number(d.order) || 0, active: d.active !== false });
      let rid = id;
      if (id) await fsM.setDoc(fsM.doc(db, 'banners', id), body);
      else rid = (await fsM.addDoc(fsM.collection(db, 'banners'), body)).id;
      await syncIndex({ banners: await store.listBanners() });
      return rid;
    }),
    deleteBanner: wrap(async (id) => {
      const { db, fsM } = await fbAuth();
      await fsM.deleteDoc(fsM.doc(db, 'banners', id));
      await syncIndex({ banners: await store.listBanners() });
    }),

    /* ---- Mục lục công khai ---- */
    getIndexInfo: wrap(async () => {
      const { db, fsM } = await fbAuth();
      const s = await fsM.getDoc(fsM.doc(db, 'meta', 'index'));
      if (!s.exists()) return null;
      const d = s.data();
      return { rev: d.rev, count: (d.articles || []).length, total: d.total ?? (d.articles || []).length, updatedAt: d.updatedAt };
    }),
    // Dựng lại toàn bộ mục lục từ các bài đã đăng (dùng lần đầu hoặc khi nghi ngờ lệch dữ liệu)
    rebuildIndex: wrap(async () => {
      const { db, fsM } = await fbAuth();
      const [menus, banners, arts] = await Promise.all([
        store.listMenus(), store.listBanners(),
        fsM.getDocs(fsM.query(fsM.collection(db, 'articles'), fsM.where('status', '==', 'published'))),
      ]);
      const articles = arts.docs.map(normDoc).filter((a) => a.title).map((a) => ({ ...a, status: 'published' }));
      await fsM.setDoc(fsM.doc(db, 'meta', 'index'), applyChange(null, { menus, banners, articles }));
      try { sessionStorage.removeItem('tintuc-index-cache'); } catch { /* bỏ qua */ }
      return articles.length;
    }),

    /* ---- Người dùng ---- */
    listUsers: wrap(async () => {
      const { db, fsM } = await fbAuth();
      return (await fsM.getDocs(fsM.collection(db, 'users'))).docs.map((d) => ({ uid: d.id, ...normDoc(d) }));
    }),

    // Tạo tài khoản đăng nhập bằng một "ứng dụng phụ" để Admin hiện tại không bị đăng xuất.
    createUser: wrap(async ({ email, password, displayName, role }) => {
      const { appM, authM, db, fsM } = await fbAuth();
      const sec = appM.initializeApp(config.firebase, `secondary-${Date.now()}`);
      const secAuth = authM.getAuth(sec);
      let uid;
      try {
        try {
          uid = (await authM.createUserWithEmailAndPassword(secAuth, email, password)).user.uid;
        } catch (e) {
          if (e.code !== 'auth/email-already-in-use') throw e;
          // Email đã có tài khoản (ví dụ người từng bị gỡ quyền): nếu mật khẩu khớp thì cấp lại quyền
          try {
            uid = (await authM.signInWithEmailAndPassword(secAuth, email, password)).user.uid;
          } catch {
            throw Object.assign(new Error('Email này đã có tài khoản với mật khẩu khác. Hãy nhập đúng mật khẩu hiện tại của tài khoản đó, hoặc xóa tài khoản trong Firebase Console rồi thêm lại.'), { code: 'custom' });
          }
        }
        await authM.signOut(secAuth);
      } finally {
        await appM.deleteApp(sec).catch(() => {});
      }
      await fsM.setDoc(fsM.doc(db, 'users', uid), { email, displayName: displayName || email, role, isOwner: false, createdAt: fsM.serverTimestamp() });
      return uid;
    }),
    updateUser: wrap(async (uid, patch) => {
      const { db, fsM } = await fbAuth();
      await fsM.updateDoc(fsM.doc(db, 'users', uid), patch);
    }),
  };
  return store;
}
