// Quản lý menu, banner, người dùng (chỉ Admin).
import { h, $, $$, toast, modal, confirmBox } from '/admin/ui.js';
import { slugify, RESERVED_SLUGS } from '/shared/util.mjs';
import { pickImage, uploadImage } from '/admin/upload.js';
import { orderedMenus } from '/admin/views-articles.js';

/* ================= Menu ================= */
export async function menusView(ctx, root) {
  root.innerHTML = '<p class="muted">Đang tải…</p>';
  let menus = await ctx.getMenus(true);

  const siblings = (m) => menus.filter((x) => (x.parentId || null) === (m.parentId || null))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));

  function draw() {
    const rows = orderedMenus(menus);
    root.innerHTML = `<div class="page-top"><h1 class="page-h">Menu / Chuyên mục</h1><button type="button" class="btn btn--primary" id="add">+ Thêm menu</button></div>
    <p class="muted">Menu cấp 1 hiển thị trên thanh menu của website; menu cấp 2 nằm trong danh sách thả xuống. Từ menu thứ 7 trở đi sẽ gom vào nút "•••".</p>
    <div class="panel panel--flush"><table class="table"><thead><tr><th>Tên</th><th>Đường dẫn</th><th>Hiển thị</th><th>Thứ tự</th><th></th></tr></thead><tbody>
    ${rows.length ? rows.map((m) => `<tr data-id="${h(m.id)}"><td style="padding-left:${14 + m.depth * 24}px"><b>${m.depth ? '└ ' : ''}${h(m.name)}</b></td>
      <td class="muted">/${h(m.slug)}/</td><td>${m.visible === false ? '<span class="badge badge--gray">Ẩn</span>' : '<span class="badge badge--green">Hiện</span>'}</td>
      <td class="nowrap"><button class="icon-btn" data-act="up" title="Lên">▲</button><button class="icon-btn" data-act="down" title="Xuống">▼</button></td>
      <td class="actions"><button type="button" class="link" data-act="edit">Sửa</button><button type="button" class="link link--danger" data-act="delete">Xóa</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="muted center">Chưa có menu nào. Bấm "Thêm menu" để tạo.</td></tr>'}
    </tbody></table></div>`;
    $('#add', root).onclick = () => edit();
    $('tbody', root).onclick = async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const m = menus.find((x) => x.id === b.closest('tr').dataset.id);
      try {
        if (b.dataset.act === 'edit') edit(m);
        else if (b.dataset.act === 'delete') await remove(m);
        else await move(m, b.dataset.act === 'up' ? -1 : 1);
      } catch (err) { toast(err.message, 'err'); }
    };
  }

  async function reload() { menus = await ctx.getMenus(true); draw(); }

  async function move(m, dir) {
    const sib = siblings(m);
    const i = sib.findIndex((x) => x.id === m.id);
    const j = i + dir;
    if (j < 0 || j >= sib.length) return;
    // gán lại thứ tự theo vị trí mới để tránh trùng số
    const arr = sib.slice();
    [arr[i], arr[j]] = [arr[j], arr[i]];
    await Promise.all(arr.map((x, k) => (x.order !== k + 1 ? ctx.store.saveMenu({ ...x, order: k + 1 }) : null)));
    await reload();
  }

  async function remove(m) {
    if (menus.some((x) => x.parentId === m.id)) { toast('Menu này còn menu con. Hãy xóa hoặc chuyển menu con trước.', 'err'); return; }
    const articles = await ctx.store.listArticles(ctx.profile);
    const used = articles.filter((a) => a.menuIds?.includes(m.id)).length;
    if (used) { toast(`Còn ${used} bài viết thuộc menu này. Hãy chuyển các bài sang menu khác trước khi xóa.`, 'err'); return; }
    if (!(await confirmBox(`Xóa menu "${m.name}"?`, { okLabel: 'Xóa', danger: true }))) return;
    await ctx.store.deleteMenu(m.id);
    toast('Đã xóa menu.');
    await reload();
  }

  function edit(m) {
    const tops = menus.filter((x) => !x.parentId && x.id !== m?.id);
    const hasChildren = m && menus.some((x) => x.parentId === m.id);
    const dlg = modal({
      title: m ? 'Sửa menu' : 'Thêm menu', width: 480,
      body: `<label class="field"><span>Tên menu *</span><input id="mn-name" maxlength="60" value="${h(m?.name || '')}"></label>
        <label class="field"><span>Đường dẫn</span><input id="mn-slug" maxlength="60" value="${h(m?.slug || '')}"><small class="muted">Chữ thường không dấu, ví dụ: kinh-doanh</small></label>
        <label class="field"><span>Thuộc menu cha</span><select id="mn-parent" ${hasChildren ? 'disabled' : ''}><option value="">— Không (menu cấp 1) —</option>${tops.map((t) => `<option value="${h(t.id)}"${m?.parentId === t.id ? ' selected' : ''}>${h(t.name)}</option>`).join('')}</select>${hasChildren ? '<small class="muted">Menu đang có menu con nên giữ ở cấp 1.</small>' : ''}</label>
        <label class="check"><input type="checkbox" id="mn-visible"${m?.visible === false ? '' : ' checked'}> Hiển thị trên website</label>`,
      actions: [
        { label: 'Hủy' },
        { label: 'Lưu', kind: 'primary', onClick: async (d) => {
          const name = d.$('#mn-name').value.trim();
          const slug = slugify(d.$('#mn-slug').value || name);
          if (!name) { toast('Chưa nhập tên menu.', 'err'); return false; }
          if (!slug) { toast('Đường dẫn không hợp lệ.', 'err'); return false; }
          if (RESERVED_SLUGS.includes(slug)) { toast('Đường dẫn này là từ khóa hệ thống, hãy đổi.', 'err'); return false; }
          if (menus.some((x) => x.slug === slug && x.id !== m?.id)) { toast('Đường dẫn đã được menu khác dùng.', 'err'); return false; }
          const parentId = d.$('#mn-parent').value || null;
          const order = m && (m.parentId || null) === parentId ? m.order : Math.max(0, ...menus.filter((x) => (x.parentId || null) === parentId).map((x) => x.order ?? 0)) + 1;
          await ctx.store.saveMenu({ ...(m || {}), name, slug, parentId, order, visible: d.$('#mn-visible').checked });
          toast('Đã lưu menu.');
          await reload();
        } },
      ],
    });
    const name = dlg.$('#mn-name'); const slug = dlg.$('#mn-slug');
    let touched = !!m;
    name.oninput = () => { if (!touched) slug.value = slugify(name.value); };
    slug.oninput = () => { touched = true; };
  }

  draw();
}

/* ================= Banner ================= */
const POSITIONS = {
  'home-right': 'Trang chủ - cột bên phải (tối đa 3)',
  sidebar: 'Cột bên của trang chuyên mục / bài viết (tối đa 3)',
};

export async function bannersView(ctx, root) {
  root.innerHTML = '<p class="muted">Đang tải…</p>';
  let banners = await ctx.store.listBanners();
  const sorted = () => [...banners].sort((a, b) => (a.position || '').localeCompare(b.position || '') || (a.order ?? 0) - (b.order ?? 0));

  function draw() {
    root.innerHTML = `<div class="page-top"><h1 class="page-h">Banner quảng cáo</h1><button type="button" class="btn btn--primary" id="add">+ Thêm banner</button></div>
    <p class="muted">Banner là ảnh kèm đường dẫn. Ảnh nên rộng khoảng 600px (tỉ lệ 300×250 hoặc 300×600 là đẹp nhất ở cột phải).</p>
    <div class="cards">${sorted().map((b) => `<div class="bcard" data-id="${h(b.id)}"><img src="${h(b.imageUrl)}" alt="">
      <div class="bcard__body"><b>${h(b.title || '(không có tên)')}</b>
      <div class="muted small">${h(POSITIONS[b.position] || b.position)} · thứ tự ${Number(b.order) || 0}</div>
      <div class="muted small ellipsis">${h(b.linkUrl || 'Không có liên kết')}</div>
      <div>${b.active === false ? '<span class="badge badge--gray">Đang tắt</span>' : '<span class="badge badge--green">Đang bật</span>'}</div>
      <div class="actions"><button type="button" class="link" data-act="edit">Sửa</button><button type="button" class="link link--danger" data-act="delete">Xóa</button></div></div></div>`).join('')
      || '<p class="muted">Chưa có banner nào.</p>'}</div>`;
    $('#add', root).onclick = () => edit();
    root.onclick = async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const b = banners.find((x) => x.id === btn.closest('.bcard').dataset.id);
      if (btn.dataset.act === 'edit') edit(b);
      else if (await confirmBox(`Xóa banner "${b.title || ''}"?`, { okLabel: 'Xóa', danger: true })) {
        try { await ctx.store.deleteBanner(b.id); toast('Đã xóa banner.'); await reload(); } catch (err) { toast(err.message, 'err'); }
      }
    };
  }
  async function reload() { banners = await ctx.store.listBanners(); draw(); }

  function edit(b) {
    let imageUrl = b?.imageUrl || '';
    const dlg = modal({
      title: b ? 'Sửa banner' : 'Thêm banner', width: 520,
      body: `<div id="bn-img"></div>
        <label class="field"><span>Tên (mô tả ảnh)</span><input id="bn-title" maxlength="100" value="${h(b?.title || '')}"></label>
        <label class="field"><span>Đường dẫn khi bấm vào (https://…)</span><input id="bn-link" value="${h(b?.linkUrl || '')}" placeholder="https://"></label>
        <label class="field"><span>Vị trí</span><select id="bn-pos">${Object.entries(POSITIONS).map(([k, v]) => `<option value="${k}"${b?.position === k ? ' selected' : ''}>${h(v)}</option>`).join('')}</select></label>
        <label class="field"><span>Thứ tự (số nhỏ hiện trước)</span><input id="bn-order" type="number" min="0" value="${Number(b?.order) || 1}"></label>
        <label class="check"><input type="checkbox" id="bn-active"${b?.active === false ? '' : ' checked'}> Đang bật</label>`,
      actions: [
        { label: 'Hủy' },
        { label: 'Lưu', kind: 'primary', onClick: async (d) => {
          const link = d.$('#bn-link').value.trim();
          if (!imageUrl) { toast('Chưa chọn ảnh banner.', 'err'); return false; }
          if (link && !/^https?:\/\//i.test(link)) { toast('Đường dẫn phải bắt đầu bằng http:// hoặc https://', 'err'); return false; }
          await ctx.store.saveBanner({ ...(b || {}), imageUrl, title: d.$('#bn-title').value.trim(), linkUrl: link, position: d.$('#bn-pos').value, order: Number(d.$('#bn-order').value) || 0, active: d.$('#bn-active').checked });
          toast('Đã lưu banner.');
          await reload();
        } },
      ],
    });
    const drawImg = () => {
      dlg.$('#bn-img').innerHTML = `${imageUrl ? `<img class="hero-prev" src="${h(imageUrl)}" alt="">` : ''}<div class="btn-row"><button type="button" class="btn" id="bn-pick">${imageUrl ? 'Đổi ảnh' : 'Chọn ảnh banner…'}</button></div>`;
      dlg.$('#bn-pick').onclick = async () => {
        const f = await pickImage();
        if (!f) return;
        dlg.$('#bn-pick').textContent = 'Đang tải ảnh lên…';
        try { imageUrl = (await uploadImage(f)).url; } catch (e) { toast(e.message, 'err'); }
        drawImg();
      };
    };
    drawImg();
  }
  draw();
}

/* ================= Người dùng ================= */
const ROLES = { admin: 'Admin (toàn quyền)', editor: 'Biên tập viên', disabled: 'Đã khóa' };

export async function usersView(ctx, root) {
  root.innerHTML = '<p class="muted">Đang tải…</p>';
  let users = await ctx.store.listUsers();

  function draw() {
    root.innerHTML = `<div class="page-top"><h1 class="page-h">Người dùng</h1><button type="button" class="btn btn--primary" id="add">+ Thêm người dùng</button></div>
    <div class="notice"><b>Admin</b> làm được mọi thứ trên website như bạn: bài viết, menu, banner, người dùng. <b>Biên tập viên</b> chỉ viết bài của mình và gửi duyệt. Người dùng quên mật khẩu có thể bấm "Quên mật khẩu" ở trang đăng nhập, hoặc bạn gửi email đặt lại tại đây.</div>
    <div class="panel panel--flush"><table class="table"><thead><tr><th>Tên</th><th>Email</th><th>Vai trò</th><th></th></tr></thead><tbody>
    ${users.map((u) => `<tr data-uid="${h(u.uid)}"><td><b>${h(u.displayName || '')}</b>${u.isOwner ? ' <span class="badge badge--blue">Chủ web</span>' : ''}</td><td>${h(u.email)}</td>
      <td>${u.isOwner ? h(ROLES.admin) : `<select data-role>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}"${u.role === k ? ' selected' : ''}>${h(v)}</option>`).join('')}</select>`}</td>
      <td class="actions"><button type="button" class="link" data-act="reset">Gửi email đặt lại mật khẩu</button></td></tr>`).join('')}
    </tbody></table></div>`;
    $('#add', root).onclick = add;
    root.onchange = async (e) => {
      const sel = e.target.closest('[data-role]');
      if (!sel) return;
      const uid = sel.closest('tr').dataset.uid;
      try { await ctx.store.updateUser(uid, { role: sel.value }); toast('Đã cập nhật vai trò.'); users = await ctx.store.listUsers(); }
      catch (err) { toast(err.message, 'err'); users = await ctx.store.listUsers(); draw(); }
    };
    root.onclick = async (e) => {
      const b = e.target.closest('[data-act="reset"]');
      if (!b) return;
      const u = users.find((x) => x.uid === b.closest('tr').dataset.uid);
      try { await ctx.store.resetPassword(u.email); toast(`Đã gửi email đặt lại mật khẩu tới ${u.email}`); } catch (err) { toast(err.message, 'err'); }
    };
  }

  function add() {
    modal({
      title: 'Thêm người dùng', width: 480,
      body: `<label class="field"><span>Email đăng nhập *</span><input id="us-email" type="email" autocomplete="off"></label>
        <label class="field"><span>Tên hiển thị</span><input id="us-name" maxlength="60"></label>
        <label class="field"><span>Mật khẩu tạm * (tối thiểu 6 ký tự)</span><input id="us-pass" type="text" autocomplete="off"><small class="muted">Gửi mật khẩu này cho người dùng; họ nên đổi sau khi đăng nhập (bấm "Quên mật khẩu").</small></label>
        <label class="field"><span>Vai trò</span><select id="us-role"><option value="editor">Biên tập viên</option><option value="admin">Admin (toàn quyền)</option></select></label>`,
      actions: [
        { label: 'Hủy' },
        { label: 'Tạo tài khoản', kind: 'primary', onClick: async (d) => {
          const email = d.$('#us-email').value.trim();
          const password = d.$('#us-pass').value;
          if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Email không hợp lệ.', 'err'); return false; }
          if (password.length < 6) { toast('Mật khẩu tạm tối thiểu 6 ký tự.', 'err'); return false; }
          await ctx.store.createUser({ email, password, displayName: d.$('#us-name').value.trim(), role: d.$('#us-role').value });
          toast('Đã tạo tài khoản.');
          users = await ctx.store.listUsers(); draw();
        } },
      ],
    });
  }
  draw();
}
