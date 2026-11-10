// Trình soạn thảo văn bản có định dạng (không cần thư viện ngoài).
import { sanitizeHtml } from '/shared/sanitize.mjs';
import { h, modal, toast } from '/admin/ui.js';
import { pickImage, uploadImage } from '/admin/upload.js';

const BUTTONS = [
  { cmd: 'bold', label: '<b>B</b>', title: 'In đậm (Ctrl+B)' },
  { cmd: 'italic', label: '<i>I</i>', title: 'In nghiêng (Ctrl+I)' },
  { cmd: 'underline', label: '<u>U</u>', title: 'Gạch chân (Ctrl+U)' },
  { sep: true },
  { cmd: 'h2', label: 'H2', title: 'Tiêu đề lớn' },
  { cmd: 'h3', label: 'H3', title: 'Tiêu đề nhỏ' },
  { cmd: 'p', label: '¶', title: 'Đoạn văn thường' },
  { sep: true },
  { cmd: 'insertUnorderedList', label: '• Danh sách', title: 'Danh sách chấm' },
  { cmd: 'insertOrderedList', label: '1. Danh sách', title: 'Danh sách số' },
  { cmd: 'quote', label: '❝', title: 'Trích dẫn' },
  { sep: true },
  { cmd: 'link', label: 'Liên kết', title: 'Chèn liên kết' },
  { cmd: 'unlink', label: 'Bỏ link', title: 'Xóa liên kết' },
  { cmd: 'image', label: 'Chèn ảnh', title: 'Chèn ảnh vào nội dung' },
  { sep: true },
  { cmd: 'undo', label: '↶', title: 'Hoàn tác' },
  { cmd: 'redo', label: '↷', title: 'Làm lại' },
  { cmd: 'removeFormat', label: 'Xóa định dạng', title: 'Xóa định dạng của phần chọn' },
];

export function createEditor(root, initialHtml = '') {
  root.classList.add('editor');
  root.innerHTML = `<div class="editor__bar" role="toolbar">${BUTTONS.map((b) => (b.sep
    ? '<span class="editor__sep"></span>'
    : `<button type="button" data-cmd="${b.cmd}" title="${h(b.title)}">${b.label}</button>`)).join('')}</div>
    <div class="editor__area" contenteditable="true" spellcheck="true" data-placeholder="Nhập nội dung bài viết..."></div>`;
  const area = root.querySelector('.editor__area');
  area.innerHTML = sanitizeHtml(initialHtml);
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* bỏ qua */ }

  // Luôn có một đoạn văn <p> để gõ chữ đầu tiên không bị nằm trần
  area.addEventListener('focus', () => {
    if (area.firstChild) return;
    area.innerHTML = '<p><br></p>';
    const r = document.createRange();
    r.setStart(area.firstChild, 0); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  area.addEventListener('blur', () => {
    if (!area.textContent.trim() && !area.querySelector('img')) area.innerHTML = '';
  });

  let saved = null;
  const saveRange = () => {
    const s = getSelection();
    if (s.rangeCount && area.contains(s.anchorNode)) saved = s.getRangeAt(0).cloneRange();
  };
  const restoreRange = () => {
    area.focus();
    if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
  };
  document.addEventListener('selectionchange', saveRange);

  const exec = (c, v = null) => { restoreRange(); document.execCommand(c, false, v); };

  async function insertImage() {
    saveRange();
    const file = await pickImage();
    if (!file) return;
    toast('Đang tải ảnh lên…');
    let up;
    try { up = await uploadImage(file); } catch (e) { toast(e.message, 'err'); return; }
    const m = modal({
      title: 'Chèn ảnh', width: 460,
      body: `<img src="${h(up.url)}" alt="" style="max-width:100%;max-height:200px;border-radius:4px;margin-bottom:10px">
        <label class="field"><span>Mô tả / chú thích ảnh</span><input id="img-alt" placeholder="Ví dụ: Quang cảnh buổi lễ"></label>`,
      actions: [
        { label: 'Hủy' },
        { label: 'Chèn vào bài', kind: 'primary', onClick: (mm) => {
          const alt = mm.$('#img-alt').value.trim();
          restoreRange();
          document.execCommand('insertHTML', false,
            `<figure><img src="${h(up.url)}" alt="${h(alt)}">${alt ? `<figcaption>${h(alt)}</figcaption>` : ''}</figure><p><br></p>`);
        } },
      ],
    });
    return m;
  }

  function insertLink() {
    saveRange();
    const sel = getSelection();
    const hasText = sel.rangeCount && !sel.isCollapsed;
    modal({
      title: 'Chèn liên kết', width: 460,
      body: `<label class="field"><span>Địa chỉ (bắt đầu bằng https://)</span><input id="lk-url" placeholder="https://"></label>
        ${hasText ? '' : '<label class="field"><span>Chữ hiển thị</span><input id="lk-text"></label>'}`,
      actions: [
        { label: 'Hủy' },
        { label: 'Chèn', kind: 'primary', onClick: (mm) => {
          let url = mm.$('#lk-url').value.trim();
          if (!/^(https?:\/\/|mailto:|\/)/i.test(url)) {
            if (/^[\w.-]+\.[a-z]{2,}/i.test(url)) url = `https://${url}`;
            else { toast('Địa chỉ liên kết không hợp lệ.', 'err'); return false; }
          }
          restoreRange();
          if (hasText) document.execCommand('createLink', false, url);
          else {
            const t = mm.$('#lk-text')?.value.trim() || url;
            document.execCommand('insertHTML', false, `<a href="${h(url)}">${h(t)}</a>&nbsp;`);
          }
        } },
      ],
    });
  }

  root.querySelector('.editor__bar').addEventListener('mousedown', (e) => e.preventDefault());
  root.querySelector('.editor__bar').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    const c = btn.dataset.cmd;
    if (c === 'h2' || c === 'h3') exec('formatBlock', c.toUpperCase());
    else if (c === 'p') exec('formatBlock', 'P');
    else if (c === 'quote') exec('formatBlock', 'BLOCKQUOTE');
    else if (c === 'link') insertLink();
    else if (c === 'image') insertImage();
    else exec(c);
  });

  // Dán: chỉ giữ định dạng an toàn (bỏ rác từ Word, web...)
  area.addEventListener('paste', (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html) document.execCommand('insertHTML', false, sanitizeHtml(html.replace(/<(\/?)(h1)\b/gi, '<$1h2')));
    else document.execCommand('insertText', false, text);
  });

  return {
    getHtml: () => sanitizeHtml(area.innerHTML).replace(/<p><br><\/p>/g, '').trim(),
    isEmpty: () => !area.textContent.trim() && !area.querySelector('img'),
    focus: () => area.focus(),
    destroy: () => document.removeEventListener('selectionchange', saveRange),
  };
}
