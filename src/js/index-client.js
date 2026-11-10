// Đọc "mục lục" bài viết (tài liệu meta/index trong Firestore): 1 lượt đọc cho mỗi lần mở trang.
import config from '/js/config.js';
import { fbCore } from '/js/fb.js';

const TTL = 30 * 1000; // nhớ tạm 30 giây trong tab để chuyển trang không đọc lại liên tục
const KEY = 'tintuc-index-cache';

export async function loadIndex({ fresh = false } = {}) {
  if (config.mode === 'demo') {
    try { return JSON.parse(localStorage.getItem('tintuc-demo-index')); } catch { return null; }
  }
  if (!fresh) {
    try {
      const c = JSON.parse(sessionStorage.getItem(KEY));
      if (c && Date.now() - c.t < TTL) return c.v;
    } catch { /* bỏ qua */ }
  }
  const { db, fsM } = await fbCore();
  const snap = await fsM.getDoc(fsM.doc(db, 'meta', 'index'));
  const v = snap.exists() ? snap.data() : null;
  try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), v })); } catch { /* quá dung lượng: bỏ qua */ }
  return v;
}
