// So sánh "số phiên bản" mục lục trên Firestore với bản web đang chạy.
// Giống nhau → không cần dựng lại (tiết kiệm lượt đọc miễn phí). Kết quả ghi vào GITHUB_OUTPUT: changed=true|false
import fs from 'node:fs';
import { fetchRev } from './firestore-rest.mjs';

const site = JSON.parse(fs.readFileSync(new URL('../config/site.json', import.meta.url), 'utf8'));
const out = (v) => {
  console.log(`changed=${v}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${v}\n`);
};

// Đẩy mã mới hoặc bấm chạy tay thì luôn dựng
if (process.env.GITHUB_EVENT_NAME && process.env.GITHUB_EVENT_NAME !== 'schedule') { console.log('Chạy do đẩy mã/bấm tay → dựng lại.'); out('true'); process.exit(0); }

try {
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '');
  const current = (await fetchRev(sa)) || 'none';
  const res = await fetch(`${site.siteUrl.replace(/\/$/, '')}/rev.txt?t=${Date.now()}`, { cache: 'no-store' });
  const live = res.ok ? (await res.text()).trim() : null;
  console.log(`Firestore: ${current} | Web đang chạy: ${live}`);
  out(live === current ? 'false' : 'true');
} catch (e) {
  console.log('Không so sánh được, dựng lại cho chắc:', e.message);
  out('true');
}
