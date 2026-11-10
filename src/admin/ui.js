import { escapeHtml } from '/shared/util.mjs';

export const h = escapeHtml;
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(message, type = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = message;
  box.append(t);
  setTimeout(() => t.classList.add('is-out'), type === 'err' ? 5200 : 2800);
  setTimeout(() => t.remove(), type === 'err' ? 5600 : 3200);
}

// Hộp thoại. actions: [{ label, kind: 'primary'|'danger'|'', onClick(modal) -> false để giữ hộp thoại mở }]
export function modal({ title, body = '', actions = [], width = 520, onOpen }) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" style="max-width:${width}px">
    <div class="modal__head"><h3>${h(title)}</h3><button type="button" class="modal__x" aria-label="Đóng">×</button></div>
    <div class="modal__body">${body}</div>
    <div class="modal__foot"></div></div>`;
  document.body.append(back);
  const api = {
    el: back,
    $: (s) => $(s, back),
    close() { back.remove(); document.removeEventListener('keydown', onKey); },
    setBusy(on) { $$('button', $('.modal__foot', back)).forEach((b) => { b.disabled = on; }); },
  };
  const onKey = (e) => { if (e.key === 'Escape') api.close(); };
  document.addEventListener('keydown', onKey);
  $('.modal__x', back).onclick = api.close;
  back.addEventListener('mousedown', (e) => { if (e.target === back) api.close(); });
  const foot = $('.modal__foot', back);
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn ${a.kind ? `btn--${a.kind}` : ''}`;
    b.textContent = a.label;
    b.onclick = async () => {
      api.setBusy(true);
      try { const r = await a.onClick?.(api); if (r !== false) api.close(); }
      catch (e) { toast(e.message || 'Có lỗi xảy ra', 'err'); }
      finally { if (document.body.contains(back)) api.setBusy(false); }
    };
    foot.append(b);
  }
  onOpen?.(api);
  const first = $('input:not([type=hidden]), select, textarea', $('.modal__body', back));
  first?.focus();
  return api;
}

export function confirmBox(message, { okLabel = 'Đồng ý', danger = false, title = 'Xác nhận' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title, width: 440, body: `<p>${h(message)}</p>`,
      actions: [
        { label: 'Hủy', onClick: () => { done = true; resolve(false); } },
        { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: () => { done = true; resolve(true); } },
      ],
    });
    const x = m.close;
    m.close = () => { x(); if (!done) resolve(false); };
  });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const STATUS = {
  draft: { label: 'Nháp', cls: 'badge--gray' },
  pending: { label: 'Chờ duyệt', cls: 'badge--amber' },
  published: { label: 'Đã đăng', cls: 'badge--green' },
};

export const statusBadge = (s) => `<span class="badge ${STATUS[s]?.cls || ''}">${h(STATUS[s]?.label || s)}</span>`;
