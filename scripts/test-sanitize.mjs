import { sanitizeHtml } from '../src/shared/sanitize.mjs';

const bad = [
  '<script>alert(1)</script>ok',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="java&#x0A;script:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href=" jAvAsCrIpT:alert(1)">x</a>',
  '<img src="data:text/html,<script>alert(1)</script>">',
  '<iframe src="https://evil"></iframe>after',
  '<p onclick="x()">t</p>',
  '<svg onload=alert(1)><circle/></svg>t',
  '<div style="background:url(javascript:x)">t</div>',
  '<<script>alert(1)//<</script>',
  '<a href="//evil.com">x</a>',
];
let fail = 0;
for (const b of bad) {
  const o = sanitizeHtml(b);
  const danger = /<script|onerror|onclick|onload|javascript:|<iframe|<svg|style=|data:|href="\/\/|<<?script/i.test(o);
  if (danger) { fail++; console.log('FAIL', JSON.stringify(b), '=>', o); }
}
const good = '<h2>Tiêu đề</h2><p>Xin <strong>chào</strong> <a href="https://a.com/x?y=1&z=2">link</a></p><img src="https://res.cloudinary.com/x/image/upload/a.jpg" alt="Ảnh">';
const g = sanitizeHtml(good);
console.log('GOOD =>', g);
if (!g.includes('<strong>chào</strong>') || !g.includes('<img src="https://res.cloudinary.com') || !g.includes('href="https://a.com/x?y=1&amp;z=2"')) fail++;
console.log(fail ? `${fail} lỗi` : 'Sanitize OK');
process.exit(fail ? 1 : 0);
