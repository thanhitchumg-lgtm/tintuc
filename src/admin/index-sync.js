// "Mục lục" bài viết (meta/index): bản tóm tắt các bài ĐÃ ĐĂNG + menu + banner để trang công khai
// đọc chỉ với 1 lượt đọc và hiện bài mới ngay lập tức. Chỉ Admin ghi được.
const MAX_ARTICLES = 1200;
const MAX_BYTES = 900 * 1024;

export const rev = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const entryOf = (a) => ({
  id: a.id, title: a.title, slug: a.slug || '', summary: String(a.summary || '').slice(0, 220),
  heroImage: a.heroImage?.url ? { url: a.heroImage.url, alt: a.heroImage.alt || '' } : null,
  menuIds: a.menuIds || [], primaryMenuId: a.primaryMenuId || null,
  featuredSlot: a.featuredSlot || null, publishedAt: a.publishedAt || null,
  authorName: a.authorName || '', updatedAt: a.updatedAt || a.publishedAt || null,
});

export const menuOf = (m) => ({ id: m.id, name: m.name, slug: m.slug, parentId: m.parentId || null, order: Number(m.order) || 0, visible: m.visible !== false });
export const bannerOf = (b) => ({ id: b.id, title: b.title || '', imageUrl: b.imageUrl, linkUrl: b.linkUrl || '', position: b.position, order: Number(b.order) || 0, active: b.active !== false });

const byNew = (a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || '');

// Áp thay đổi lên dữ liệu mục lục (hàm thuần, dùng chung cho Firestore và demo)
export function applyChange(data, change) {
  const d = { menus: [], banners: [], articles: [], ...(data || {}) };
  let articles = d.articles;
  if (change.menus) d.menus = change.menus.map(menuOf);
  if (change.banners) d.banners = change.banners.map(bannerOf);
  if (change.articles) articles = change.articles.map(entryOf);
  if (change.upsert) {
    const a = change.upsert;
    articles = articles.filter((x) => x.id !== a.id);
    if (a.status === 'published' && a.title) articles.push(entryOf(a));
  }
  if (change.remove) articles = articles.filter((x) => x.id !== change.remove);
  if (change.featured) {
    const { id, slot } = change.featured;
    articles = articles.map((x) => {
      if (x.id === id) return { ...x, featuredSlot: slot || null };
      if (slot && x.featuredSlot === slot) return { ...x, featuredSlot: null };
      return x;
    });
  }
  articles.sort(byNew);
  d.total = articles.length;
  articles = articles.slice(0, MAX_ARTICLES);
  while (articles.length > 20 && JSON.stringify(articles).length > MAX_BYTES) articles.pop();
  d.articles = articles;
  d.rev = rev();
  d.updatedAt = new Date().toISOString();
  return d;
}
