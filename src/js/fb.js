// Tải Firebase SDK từ CDN của Google (trình duyệt tải trực tiếp, không cần cài npm).
import config from '/js/config.js';

const V = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;

let corePromise;
let authPromise;

export function fbCore() {
  corePromise ||= (async () => {
    const [appM, fsM] = await Promise.all([import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-firestore.js`)]);
    const app = appM.initializeApp(config.firebase);
    return { appM, fsM, app, db: fsM.getFirestore(app) };
  })();
  return corePromise;
}

export function fbAuth() {
  authPromise ||= (async () => {
    const core = await fbCore();
    const authM = await import(`${CDN}/firebase-auth.js`);
    return { ...core, authM, auth: authM.getAuth(core.app) };
  })();
  return authPromise;
}

export const toIso = (v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v ?? null);

export function normDoc(d) {
  const o = { id: d.id, ...d.data() };
  for (const k of ['createdAt', 'updatedAt', 'publishedAt']) if (k in o) o[k] = toIso(o[k]);
  return o;
}
