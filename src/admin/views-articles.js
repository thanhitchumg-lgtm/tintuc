import { h, $, $$, toast, modal, confirmBox, formatDateTime, statusBadge, STATUS } from '/admin/ui.js';
import { slugify, RESERVED_SLUGS } from '/shared/util.mjs';
import { createEditor } from '/admin/editor.js';
import { pickImage, uploadImage } from '/admin/upload.js';

const SLOT_LABELS = {
  1: '1 · Bài lớn nhất (bên trái)',
  2: '2 · Bài ảnh lớn (cột giữa, trên cùng)',
  3: '3 · Danh sách cột giữa (1)',
  4: '4 · Danh sách cột giữa (2)',
  5: '5 · Danh sách cột giữa (3)',
  6: '6 · Danh sách cột giữa (4)',
  7: '7 · Dưới bài lớn (trái)',
  8: '8 · Dưới bài lớn (phải)',
};

export const orderedMenus = (menus) => {
  const sorted = [...menus].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));
  const top = sorted.filter((m) => !m.parentId || !sorted.some((x) => x.id === m.parentId));
  return top.flatMap((m) => [{ ...m, depth: 0 }, ...sorted.filter((c) => c.parentId === m.id).map((c) => ({ ...c, depth: 1 }))]);
};

const publicUrl = (a, menus) => {
  const m = menus.find((x) => x.id === a.primaryMenuId) || menus.find((x) => x.id === a.menuIds?.[0]);
  return `/${m ? m.slug : 'tin-khac'}/${a.slug}/`;
};

const rebuildNote = () => '<div class="notice">Bài <b>đã đăng</b> hiện ngay trên trang chủ, chuyên mục và tìm kiếm. Hệ thống vẫn dựng lại bản tĩnh định kỳ để web tải nhanh và tốt cho Google.</div>';

/* ================= Tổng quan ================= */
export async function dashboardView(ctx, root) {
  root.innerHTML = '<p class="muted">Đang tải…</p>';
  const [articles, menus, banners] = await Promise.all([
    ctx.store.listArticles(ctx.profile), ctx.getMenus(), ctx.isAdmin ? ctx.store.listBanners() : Promise.resolve([]),
  ]);
  ctx.refreshBadges?.(articles);
  const count = (s) => articles.filter((a) => a.status === s).length;
  const pending = articles.filter((a) => a.status === 'pending');
  const cards = [
    ['Tổng số bài', articles.length], ['Đã đăng', count('published')], ['Chờ duyệt', count('pending')], ['Nháp', count('draft')],
    ...(ctx.isAdmin ? [['Chuyên mục', menus.length], ['Banner', banners.length]] : []),
  ];
  root.innerHTML = `<h1 class="page-h">Tổng quan</h1>
  <div class="stats">${cards.map(([l, n]) => `<div class="stat"><div class="stat__n">${n}</div><div class="stat__l">${h(l)}</div></div>`).join('')}</div>
  <div class="panel"><div class="panel__head"><h2>${ctx.isAdmin ? 'Bài đang chờ duyệt' : 'Bài đang chờ duyệt của bạn'}</h2></div>
  ${pending.length ? `<ul class="plain">${pending.slice(0, 10).map((a) => `<li><a href="#/bai-viet/${h(a.id)}">${h(a.title)}</a><span class="muted"> · ${h(a.authorName || '')} · ${h(formatDateTime(a.updatedAt))}</span></li>`).join('')}</ul>` : '<p class="muted">Không có bài nào đang chờ duyệt.</p>'}</div>
  <p><a class="btn btn--primary" href="#/bai-viet/moi">+ Viết bài mới</a></p>
  ${rebuildNote(ctx)}
  ${ctx.isAdmin ? `<div class="panel"><div class="panel__head"><h2>Mục lục trang chủ</h2></div>
    <p class="muted" id="idx-info">Đang kiểm tra…</p>
    <p class="muted">Mục lục là bản tóm tắt bài đã đăng để người đọc thấy bài mới ngay. Bình thường tự cập nhật; chỉ bấm đồng bộ lại khi lần đầu cài đặt hoặc thấy trang chủ không khớp.</p>
    <button type="button" class="btn" id="idx-sync">Đồng bộ lại mục lục</button></div>` : ''}`;
  if (ctx.isAdmin) {
    const info = $('#idx-info', root);
    const showInfo = async () => {
      try {
        const i = await ctx.store.getIndexInfo();
        info.textContent = i ? `Đang có ${i.count}${i.total > i.count ? `/${i.total}` : ''} bài trong mục lục · cập nhật ${formatDateTime(i.updatedAt)}.` : 'Chưa có mục lục. Hãy bấm "Đồng bộ lại mục lục" để tạo.';
      } catch (e) { info.textContent = 'Không đọc được mục lục: ' + e.message; }
    };
    showInfo();
    $('#idx-sync', root).onclick = async (e) => {
      e.target.disabled = true;
      try { const n = await ctx.store.rebuildIndex(); toast(`Đã đồng bộ ${n} bài đã đăng.`); await showInfo(); }
      catch (err) { toast(err.message, 'err'); }
      e.target.disabled = false;
    };
  }
}

/* ================= Danh sách bài ================= */
export async function articleListView(ctx, root) {
  root.innerHTML = '<p class="muted">Đang tải…</p>';
  let [articles, menus] = await Promise.all([ctx.store.listArticles(ctx.profile), ctx.getMenus()]);
  ctx.refreshBadges?.(articles);
  const state = { status: 'all', q: '', menu: '' };
  const menuName = (id) => menus.find((m) => m.id === id)?.name || '—';

  const filtered = () => articles.filter((a) =>
    (state.status === 'all' || a.status === state.status)
    && (!state.menu || a.menuIds?.includes(state.menu))
    && (!state.q || a.title.toLowerCase().includes(state.q.toLowerCase())));

  function draw() {
    const list = filtered();
    const counts = (s) => (s === 'all' ? articles.length : articles.filter((a) => a.status === s).length);
    $('#tabs', root).innerHTML = ['all', 'published', 'pending', 'draft'].map((s) =>
      `<button type="button" class="tab${state.status === s ? ' is-on' : ''}" data-status="${s}">${s === 'all' ? 'Tất cả' : STATUS[s].label} <span>${counts(s)}</span></button>`).join('');
    $('#tbody', root).innerHTML = list.length ? list.map((a) => {
      const own = a.authorUid === ctx.profile.uid;
      const canEdit = ctx.isAdmin || (own && a.status !== 'published');
      const canDelete = ctx.isAdmin || (own && a.status === 'draft');
      return `<tr data-id="${h(a.id)}">
        <td class="col-thumb">${a.heroImage?.url ? `<img src="${h(a.heroImage.url)}" alt="">` : '<span class="thumb-empty"></span>'}</td>
        <td><a class="title-link" href="#/bai-viet/${h(a.id)}">${h(a.title)}</a>
          <div class="muted small">${h(menuName(a.primaryMenuId))}${a.featuredSlot ? ` · <b>Nổi bật vị trí ${a.featuredSlot}</b>` : ''}</div></td>
        <td class="nowrap">${h(a.authorName || '')}</td>
        <td>${statusBadge(a.status)}</td>
        <td class="nowrap small">${h(formatDateTime(a.updatedAt))}</td>
        <td class="actions">
          ${a.status === 'published' ? `<a class="link" href="${h(publicUrl(a, menus))}" target="_blank" rel="noopener">Xem</a>` : ''}
          ${canEdit ? `<a class="link" href="#/bai-viet/${h(a.id)}">Sửa</a>` : ''}
          ${ctx.isAdmin && a.status === 'pending' ? '<button type="button" class="link link--ok" data-act="approve">Duyệt đăng</button>' : ''}
          ${ctx.isAdmin && a.status === 'published' ? '<button type="button" class="link" data-act="unpublish">Gỡ xuống</button>' : ''}
          ${canDelete ? '<button type="button" class="link link--danger" data-act="delete">Xóa</button>' : ''}
        </td></tr>`;
    }).join('') : '<tr><td colspan="6" class="muted center">Không có bài viết nào.</td></tr>';
  }

  root.innerHTML = `<div class="page-top"><h1 class="page-h">Bài viết</h1><a class="btn btn--primary" href="#/bai-viet/moi">+ Viết bài mới</a></div>
  <div class="tabs" id="tabs"></div>
  <div class="filters"><input id="q" type="search" placeholder="Tìm theo tiêu đề…">
    <select id="menu"><option value="">Tất cả chuyên mục</option>${orderedMenus(menus).map((m) => `<option value="${h(m.id)}">${m.depth ? '— ' : ''}${h(m.name)}</option>`).join('')}</select></div>
  <div class="panel panel--flush"><table class="table"><thead><tr><th></th><th>Tiêu đề</th><th>Tác giả</th><th>Trạng thái</th><th>Cập nhật</th><th></th></tr></thead><tbody id="tbody"></tbody></table></div>
  ${ctx.isAdmin ? rebuildNote(ctx) : ''}`;
  draw();

  $('#tabs', root).onclick = (e) => { const b = e.target.closest('[data-status]'); if (b) { state.status = b.dataset.status; draw(); } };
  $('#q', root).oninput = (e) => { state.q = e.target.value; draw(); };
  $('#menu', root).onchange = (e) => { state.menu = e.target.value; draw(); };
  $('#tbody', root).onclick = async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const a = articles.find((x) => x.id === id);
    try {
      if (btn.dataset.act === 'approve') {
        await ctx.store.patchArticle(id, { status: 'published', publishedAt: a.publishedAt || new Date().toISOString() });
        toast('Đã duyệt và đăng bài.');
      } else if (btn.dataset.act === 'unpublish') {
        if (!(await confirmBox('Gỡ bài này xuống (chuyển về Nháp)? Bài sẽ biến mất khỏi website ngay.', { okLabel: 'Gỡ xuống' }))) return;
        await ctx.store.patchArticle(id, { status: 'draft' });
        toast('Đã gỡ bài xuống.');
      } else if (btn.dataset.act === 'delete') {
        if (!(await confirmBox(`Xóa vĩnh viễn bài "${a.title}"?`, { okLabel: 'Xóa', danger: true }))) return;
        await ctx.store.deleteArticle(id);
        toast('Đã xóa bài.');
      }
      articles = await ctx.store.listArticles(ctx.profile);
      draw();
      ctx.refreshBadges?.(articles);
    } catch (err) { toast(err.message, 'err'); }
  };
}

/* ================= Soạn / sửa bài ================= */
export async function articleFormView(ctx, root, id) {
  root.innerHTML = '<p class="muted">Đang tải…</p>';
  const isNew = !id || id === 'moi';
  const [menus, existing, all] = await Promise.all([
    ctx.getMenus(),
    isNew ? Promise.resolve(null) : ctx.store.getArticle(id),
    ctx.isAdmin ? ctx.store.listArticles(ctx.profile) : Promise.resolve([]),
  ]);
  if (!isNew && !existing) { root.innerHTML = '<p>Không tìm thấy bài viết.</p>'; return; }
  const a = existing || { title: '', slug: '', summary: '', contentHtml: '', heroImage: null, menuIds: [], primaryMenuId: null, status: 'draft', featuredSlot: null, seoTitle: '', seoDescription: '' };

  const locked = !ctx.isAdmin && existing && (existing.authorUid !== ctx.profile.uid || existing.status === 'published');
  if (locked) {
    root.innerHTML = `<h1 class="page-h">${h(a.title)}</h1><div class="notice">Bài này đã đăng hoặc không phải của bạn nên bạn không thể sửa. Liên hệ quản trị viên nếu cần chỉnh sửa.</div><p><a class="btn" href="#/bai-viet">← Về danh sách</a></p>`;
    return;
  }
  if (menus.length === 0) {
    root.innerHTML = '<h1 class="page-h">Viết bài mới</h1><div class="notice">Chưa có chuyên mục nào. Admin cần tạo chuyên mục (mục "Menu") trước khi đăng bài.</div>';
    return;
  }

  const statuses = ctx.isAdmin ? ['draft', 'pending', 'published'] : ['draft', 'pending'];
  const statusLabel = (s) => (s === 'pending' && !ctx.isAdmin ? 'Gửi duyệt' : STATUS[s].label);
  const om = orderedMenus(menus);
  let slugEdited = !isNew;
  let hero = a.heroImage ? { ...a.heroImage } : null;

  root.innerHTML = `<div class="page-top"><h1 class="page-h">${isNew ? 'Viết bài mới' : 'Sửa bài viết'}</h1><a class="link" href="#/bai-viet">← Về danh sách</a></div>
  <form id="form" class="two-col" novalidate>
    <div class="main-col">
      <label class="field"><span>Tiêu đề *</span><input id="title" maxlength="200" value="${h(a.title)}" placeholder="Tiêu đề bài viết"></label>
      <label class="field"><span>Đường dẫn (slug)</span><input id="slug" maxlength="100" value="${h(a.slug)}"><small class="muted" id="slug-url"></small></label>
      <label class="field"><span>Tóm tắt (sapo) <em class="muted" id="sum-count"></em></span><textarea id="summary" rows="3" maxlength="400" placeholder="Vài câu tóm tắt hiển thị ở danh sách và đầu bài">${h(a.summary)}</textarea></label>
      <div class="field"><span>Nội dung *</span><div id="editor"></div></div>
    </div>
    <aside class="side-col">
      <div class="panel"><div class="panel__head"><h2>Đăng bài</h2></div>
        <label class="field"><span>Trạng thái</span><select id="status">${statuses.map((s) => `<option value="${s}"${a.status === s ? ' selected' : ''}>${h(statusLabel(s))}</option>`).join('')}</select></label>
        ${ctx.isAdmin ? '' : '<p class="muted small">Biên tập viên lưu Nháp hoặc Gửi duyệt; quản trị viên sẽ duyệt và đăng.</p>'}
        <div class="btn-row"><button type="submit" class="btn btn--primary" id="save">Lưu bài</button></div>
      </div>
      <div class="panel"><div class="panel__head"><h2>Chuyên mục *</h2></div><div id="menus" class="menu-pick">
        ${om.map((m) => `<div class="menu-pick__row" style="padding-left:${m.depth * 18}px"><label><input type="checkbox" data-menu="${h(m.id)}"${a.menuIds?.includes(m.id) ? ' checked' : ''}> ${h(m.name)}</label>
          <label class="primary"><input type="radio" name="primary" value="${h(m.id)}"${a.primaryMenuId === m.id ? ' checked' : ''}> chính</label></div>`).join('')}
        <p class="muted small">Chọn một hoặc nhiều chuyên mục. "Chính" quyết định đường dẫn của bài.</p></div></div>
      <div class="panel"><div class="panel__head"><h2>Ảnh chính</h2></div>
        <div id="hero-box"></div>
        <label class="field"><span>Mô tả ảnh</span><input id="hero-alt" maxlength="200" value="${h(a.heroImage?.alt || '')}"></label>
        <p class="muted small">Ảnh hiển thị ở trang chủ và danh sách bài, không hiện trong trang chi tiết. Muốn có ảnh trong bài, hãy chèn bằng nút "Chèn ảnh" (JPG/PNG/WebP, tối đa 10 MB).</p></div>
      ${ctx.isAdmin ? `<div class="panel"><div class="panel__head"><h2>Vị trí nổi bật trang chủ</h2></div>
        <select id="slot"><option value="">Tự động (bài mới nhất xếp trước)</option>${Object.entries(SLOT_LABELS).map(([n, l]) => `<option value="${n}"${Number(a.featuredSlot) === Number(n) ? ' selected' : ''}>${h(l)}</option>`).join('')}</select>
        <p class="muted small" id="slot-note">Không chọn thì bài được xếp theo thời gian đăng, mới nhất trước.</p></div>` : ''}
      <div class="panel"><div class="panel__head"><h2>SEO</h2></div>
        <label class="field"><span>Tiêu đề SEO</span><input id="seoTitle" maxlength="120" value="${h(a.seoTitle || '')}" placeholder="Mặc định dùng tiêu đề bài"></label>
        <label class="field"><span>Mô tả SEO</span><textarea id="seoDescription" rows="3" maxlength="200" placeholder="Mặc định dùng tóm tắt">${h(a.seoDescription || '')}</textarea></label></div>
    </aside>
  </form>`;

  const editor = createEditor($('#editor', root), a.contentHtml);
  const titleEl = $('#title', root); const slugEl = $('#slug', root);
  const updateSlugUrl = () => {
    const pm = om.find((m) => m.id === primaryId());
    $('#slug-url', root).textContent = `Địa chỉ: /${pm ? pm.slug : '…'}/${slugEl.value || '…'}/`;
  };
  const checked = () => $$('[data-menu]', root).filter((c) => c.checked).map((c) => c.dataset.menu);
  const primaryId = () => $('input[name=primary]:checked', root)?.value || null;
  const syncPrimary = () => {
    const ids = checked();
    $$('input[name=primary]', root).forEach((r) => { r.disabled = !ids.includes(r.value); if (r.disabled) r.checked = false; });
    if (!primaryId() && ids.length) $(`input[name=primary][value="${CSS.escape(ids[0])}"]`, root).checked = true;
    updateSlugUrl();
  };
  syncPrimary();
  $('#menus', root).addEventListener('change', syncPrimary);

  titleEl.oninput = () => { if (!slugEdited) { slugEl.value = slugify(titleEl.value); updateSlugUrl(); } };
  slugEl.oninput = () => { slugEdited = true; updateSlugUrl(); };
  slugEl.onblur = () => { slugEl.value = slugify(slugEl.value); updateSlugUrl(); };
  const sumCount = () => { $('#sum-count', root).textContent = `(${$('#summary', root).value.length}/400)`; };
  $('#summary', root).oninput = sumCount; sumCount();

  function drawHero() {
    $('#hero-box', root).innerHTML = hero?.url
      ? `<img class="hero-prev" src="${h(hero.url)}" alt=""><div class="btn-row"><button type="button" class="btn" id="hero-pick">Đổi ảnh</button><button type="button" class="btn btn--danger-o" id="hero-del">Xóa ảnh</button></div>`
      : '<button type="button" class="btn" id="hero-pick">Chọn ảnh chính…</button>';
    $('#hero-pick', root).onclick = async () => {
      const f = await pickImage();
      if (!f) return;
      const btn = $('#hero-pick', root); btn.disabled = true; btn.textContent = 'Đang tải ảnh lên…';
      try { const up = await uploadImage(f); hero = { url: up.url, alt: $('#hero-alt', root).value }; toast('Đã tải ảnh lên.'); }
      catch (e) { toast(e.message, 'err'); }
      drawHero();
    };
    $('#hero-del', root)?.addEventListener('click', () => { hero = null; drawHero(); });
  }
  drawHero();

  if (ctx.isAdmin) {
    const note = () => {
      const n = Number($('#slot', root).value);
      const holder = n ? all.find((x) => Number(x.featuredSlot) === n && x.id !== existing?.id) : null;
      $('#slot-note', root).textContent = holder
        ? `Vị trí ${n} đang là bài "${holder.title}". Nếu lưu, bài đó sẽ quay về xếp theo thời gian.`
        : 'Không chọn thì bài được xếp theo thời gian đăng, mới nhất trước.';
    };
    $('#slot', root).onchange = note; note();
  }

  $('#form', root).onsubmit = async (e) => {
    e.preventDefault();
    const title = titleEl.value.trim();
    const slug = slugify(slugEl.value || title);
    const status = $('#status', root).value;
    const menuIds = checked();
    const problems = [];
    if (!title) problems.push('Chưa nhập tiêu đề.');
    if (!slug) problems.push('Đường dẫn không hợp lệ.');
    if (RESERVED_SLUGS.includes(slug)) problems.push('Đường dẫn này là từ khóa hệ thống, hãy đổi.');
    if (!menuIds.length) problems.push('Chọn ít nhất một chuyên mục.');
    if (status !== 'draft') {
      if (editor.isEmpty()) problems.push('Nội dung đang trống.');
      if (!hero?.url) problems.push('Bài cần có ảnh chính trước khi gửi duyệt/đăng.');
    }
    if (ctx.isAdmin && all.some((x) => x.id !== existing?.id && x.slug === slug && x.primaryMenuId === primaryId())) problems.push('Đã có bài khác dùng đường dẫn này trong cùng chuyên mục, hãy đổi slug.');
    if (problems.length) { toast(problems[0], 'err'); return; }

    const slotVal = ctx.isAdmin ? Number($('#slot', root).value) || null : null;
    const data = {
      ...(existing || {}),
      title, slug, summary: $('#summary', root).value.trim(), contentHtml: editor.getHtml(),
      heroImage: hero ? { url: hero.url, alt: $('#hero-alt', root).value.trim() } : null,
      menuIds, primaryMenuId: primaryId(), status,
      featuredSlot: ctx.isAdmin ? slotVal : null,
      seoTitle: $('#seoTitle', root).value.trim(), seoDescription: $('#seoDescription', root).value.trim(),
      publishedAt: existing?.publishedAt || null,
    };
    if (status === 'published' && !data.publishedAt) data.publishedAt = new Date().toISOString();

    const btn = $('#save', root); btn.disabled = true; btn.textContent = 'Đang lưu…';
    try {
      const newId = await ctx.store.saveArticle(data, ctx.profile);
      if (ctx.isAdmin && (slotVal || existing?.featuredSlot)) await ctx.store.setFeatured(newId, slotVal);
      toast(status === 'published' ? 'Đã lưu và đăng bài.' : status === 'pending' ? 'Đã gửi duyệt.' : 'Đã lưu nháp.');
      editor.destroy();
      ctx.go('#/bai-viet');
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false; btn.textContent = 'Lưu bài';
    }
  };
  return () => editor.destroy();
}
