// Đọc dữ liệu Firestore bằng REST + tài khoản dịch vụ (service account). Không cần cài gói nào.
import crypto from 'node:crypto';

const b64u = (x) => Buffer.from(x).toString('base64url');

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3000,
  }));
  const sig = crypto.createSign('RSA-SHA256').update(`${header}.${claim}`).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claim}.${sig}`,
    }),
  });
  if (!res.ok) throw new Error(`Không lấy được token Google (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

function fromValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return new Date(v.timestampValue).toISOString();
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}
const fromFields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, fromValue(v)]));
const fromDoc = (d) => ({ id: d.name.split('/').pop(), ...fromFields(d.fields || {}) });

export async function fetchRev(serviceAccountJson) {
  const sa = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
  const token = await getAccessToken(sa);
  const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents/meta/index?mask.fieldPaths=rev`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 404) return '';
  if (!res.ok) throw new Error(`Đọc meta/index lỗi (${res.status}): ${await res.text()}`);
  return fromDoc(await res.json()).rev || '';
}

export async function fetchContent(serviceAccountJson) {
  const sa = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
  const projectId = sa.project_id;
  const token = await getAccessToken(sa);
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  async function listAll(collection) {
    const out = [];
    let pageToken = '';
    do {
      const url = `${base}/${collection}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Đọc ${collection} lỗi (${res.status}): ${await res.text()}`);
      const j = await res.json();
      for (const d of j.documents || []) out.push(fromDoc(d));
      pageToken = j.nextPageToken || '';
    } while (pageToken);
    return out;
  }

  async function publishedArticles() {
    const res = await fetch(`${base}:runQuery`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'articles' }],
          where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } } },
        },
      }),
    });
    if (!res.ok) throw new Error(`Đọc articles lỗi (${res.status}): ${await res.text()}`);
    const rows = await res.json();
    return rows.filter((r) => r.document).map((r) => fromDoc(r.document));
  }

  const [menus, banners, articles, rev] = await Promise.all([listAll('menus'), listAll('banners'), publishedArticles(), fetchRev(sa)]);
  return { menus, banners, articles, rev };
}
