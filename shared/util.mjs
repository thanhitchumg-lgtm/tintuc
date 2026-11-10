// Hàm dùng chung cho cả Node (dựng web) và trình duyệt.

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Bỏ dấu tiếng Việt, về chữ thường: "Kinh tế" -> "kinh te"
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(s) {
  return normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '');
}

// Các slug không được dùng cho menu/bài viết vì trùng đường dẫn hệ thống
export const RESERVED_SLUGS = ['admin', 'tim-kiem', 'sample', 'assets', 'css', 'js', 'shared', 'p', 'api'];

const TZ = 'Asia/Ho_Chi_Minh';

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t)?.value || '';
  return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`;
}

export function formatDay(iso) {
  return formatDate(iso).slice(0, 10);
}

// Ảnh Cloudinary: chèn phép biến đổi (kích thước cố định để tiết kiệm credit)
export const IMG = {
  lead: 'c_fill,w_900,h_560,g_auto,f_auto,q_auto',
  card: 'c_fill,w_600,h_380,g_auto,f_auto,q_auto',
  thumb: 'c_fill,w_240,h_160,g_auto,f_auto,q_auto',
  hero: 'c_limit,w_1200,f_auto,q_auto',
  body: 'c_limit,w_900,f_auto,q_auto',
  banner: 'c_limit,w_600,f_auto,q_auto',
};

export function cld(url, preset) {
  if (!url) return '';
  const t = IMG[preset] || preset;
  const m = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/.exec(url);
  if (!m || !t) return url;
  // bỏ qua nếu đã có phép biến đổi
  if (/^(c_|w_|h_|f_|q_)/.test(m[2])) return url;
  return `${m[1]}${t}/${m[2]}`;
}

export function articlePath(article, menusById) {
  const m = menusById.get(article.primaryMenuId) || menusById.get(article.menuIds?.[0]);
  return `/${m ? m.slug : 'tin-khac'}/${article.slug}/`;
}

export function stripTags(html) {
  return String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function truncate(s, n) {
  s = String(s ?? '');
  return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
}
