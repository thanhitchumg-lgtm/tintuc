// Xếp bài lên các vị trí của trang chủ.
// Bài nào được chọn "vị trí nổi bật" n (1..slots) thì chiếm đúng vị trí n.
// Vị trí còn trống được lấp bằng bài mới nhất chưa được xếp, rồi đến các bài còn lại theo thời gian.

export function byNewest(a, b) {
  const ta = a.publishedAt || a.createdAt || '';
  const tb = b.publishedAt || b.createdAt || '';
  return tb.localeCompare(ta);
}

export function assignSlots(published, slotCount = 8) {
  const articles = [...published].sort(byNewest);
  const slots = new Array(slotCount).fill(null);
  const used = new Set();

  for (let n = 1; n <= slotCount; n++) {
    // nếu nhiều bài cùng chọn một vị trí: bài cập nhật gần nhất thắng
    const pick = articles
      .filter((a) => Number(a.featuredSlot) === n)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];
    if (pick) { slots[n - 1] = pick; used.add(pick.id); }
  }

  const rest = articles.filter((a) => !used.has(a.id));
  let i = 0;
  for (let k = 0; k < slotCount; k++) {
    if (!slots[k]) slots[k] = rest[i++] || null;
  }
  return { slots, rest: rest.slice(i) };
}

export function buildMenuTree(menus) {
  const visible = menus.filter((m) => m.visible !== false);
  const sorted = [...visible].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));
  const ids = new Set(sorted.map((m) => m.id));
  const top = sorted.filter((m) => !m.parentId || !ids.has(m.parentId));
  return top.map((m) => ({ ...m, children: sorted.filter((c) => c.parentId === m.id) }));
}

// Các khối chuyên mục ở cuối trang chủ (tối đa `max` khối, mỗi khối 4 bài mới nhất)
export function homeSections(tree, articles, max = 6, perSection = 4) {
  const inMenu = (a, menu) => (a.menuIds || []).includes(menu.id) || (menu.children || []).some((c) => (a.menuIds || []).includes(c.id));
  return tree
    .map((menu) => ({ menu, articles: articles.filter((a) => inMenu(a, menu)).slice(0, perSection) }))
    .filter((s) => s.articles.length)
    .slice(0, max);
}

// Bài thuộc một chuyên mục (menu cha gồm cả bài của menu con)
export function categoryArticles(menus, menu, articles) {
  const children = menus.filter((c) => c.parentId === menu.id);
  return articles.filter((a) => (a.menuIds || []).includes(menu.id) || children.some((c) => (a.menuIds || []).includes(c.id)));
}
