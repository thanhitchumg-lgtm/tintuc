// Làm sạch HTML bài viết: chỉ cho phép một số thẻ/thuộc tính an toàn.
// Chạy giống nhau ở Node (khi dựng web) và trình duyệt (khi lưu bài / xem bài).

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'blockquote',
  'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'hr', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);
const VOID_TAGS = new Set(['br', 'img', 'hr']);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math', 'form', 'textarea', 'select', 'button']);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) || 32))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(parseInt(d, 10) || 32))
    .replace(/&colon;/gi, ':').replace(/&tab;/gi, '').replace(/&newline;/gi, '');
}

function safeUrl(raw, { allowMail = false, imageOnly = false } = {}) {
  // bỏ ký tự điều khiển/khoảng trắng để chặn "java\nscript:"
  const v = decodeEntities(String(raw)).replace(/[\u0000- \u007f-\u009f]+/g, '');
  if (!v) return '';
  if (imageOnly) return /^https:\/\//i.test(v) || /^\/[^/]/.test(v) ? String(raw).trim() : '';
  if (/^(https?:|\/(?!\/)|#)/i.test(v)) return String(raw).trim();
  if (allowMail && /^mailto:/i.test(v)) return String(raw).trim();
  return '';
}

function parseAttrs(str) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(str))) {
    const name = m[1].toLowerCase();
    const val = m[2] ?? m[3] ?? m[4] ?? '';
    if (!(name in attrs)) attrs[name] = val;
  }
  return attrs;
}

export function sanitizeHtml(html) {
  const input = String(html ?? '');
  const out = [];
  const stack = [];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|<|[^<]+/g;
  let m;
  let skipUntil = null;
  while ((m = re.exec(input))) {
    const tok = m[0];
    if (!m[1]) {
      if (skipUntil) continue;
      if (tok.startsWith('<!--')) continue;
      if (tok === '<') { out.push('&lt;'); continue; }
      out.push(tok.replace(/>/g, '&gt;'));
      continue;
    }
    const name = m[1].toLowerCase();
    const closing = tok.startsWith('</');
    if (skipUntil) {
      if (closing && name === skipUntil) skipUntil = null;
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      if (!closing && !tok.endsWith('/>')) skipUntil = name;
      continue;
    }
    if (!ALLOWED_TAGS.has(name)) continue; // bỏ thẻ, giữ chữ bên trong
    if (closing) {
      if (VOID_TAGS.has(name)) continue;
      const idx = stack.lastIndexOf(name);
      if (idx === -1) continue;
      while (stack.length > idx) out.push(`</${stack.pop()}>`);
      continue;
    }
    const attrs = parseAttrs(m[2]);
    let a = '';
    if (name === 'a') {
      const href = safeUrl(attrs.href || '', { allowMail: true });
      if (href) a += ` href="${esc(href)}"`;
      if (/^https?:/i.test(href)) a += ' target="_blank" rel="noopener noreferrer nofollow"';
    } else if (name === 'img') {
      const src = safeUrl(attrs.src || '', { imageOnly: true });
      if (!src) continue;
      a += ` src="${esc(src)}" alt="${esc(attrs.alt || '')}" loading="lazy"`;
    } else if (name === 'td' || name === 'th') {
      for (const k of ['colspan', 'rowspan']) if (/^\d{1,2}$/.test(attrs[k] || '')) a += ` ${k}="${attrs[k]}"`;
    } else if (name === 'div' || name === 'span' || name === 'p' || name === 'figure' || name === 'h2' || name === 'h3' || name === 'h4') {
      const al = /^(left|center|right|justify)$/.exec((attrs['data-align'] || '').toLowerCase());
      if (al) a += ` data-align="${al[1]}"`;
    }
    out.push(`<${name}${a}>`);
    if (!VOID_TAGS.has(name) && !tok.endsWith('/>')) stack.push(name);
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('');
}
