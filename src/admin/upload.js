// Tải ảnh lên Cloudinary (không ký, dùng upload preset). Ảnh được nén trong trình duyệt trước khi tải.
import config from '/js/config.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_INPUT = 10 * 1024 * 1024; // 10 MB (khớp giới hạn gói miễn phí)
const MAX_SIDE = 1600;

async function compress(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const toBlob = (type, q) => new Promise((res) => canvas.toBlob(res, type, q));
  let blob = await toBlob('image/webp', 0.85);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.85);
  // nếu nén xong lại nặng hơn bản gốc thì giữ bản gốc
  return blob && blob.size < file.size ? blob : file;
}

export function validateImage(file) {
  if (!file) throw new Error('Chưa chọn ảnh.');
  if (!ALLOWED.includes(file.type)) throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WebP.');
  if (file.size > MAX_INPUT) throw new Error('Ảnh quá lớn (tối đa 10 MB).');
}

// Trả về { url, width, height }
export async function uploadImage(file) {
  validateImage(file);

  if (config.mode === 'demo') {
    const n = 1 + Math.floor(Math.random() * 12);
    return { url: `/sample/img-${n}.svg`, width: 1200, height: 750 };
  }

  const blob = await compress(file);
  const fd = new FormData();
  fd.append('file', blob, file.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/webp' ? '.webp' : blob.type === 'image/jpeg' ? '.jpg' : ''));
  fd.append('upload_preset', config.cloudinary.uploadPreset);
  let res;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/image/upload`, { method: 'POST', body: fd });
  } catch {
    throw new Error('Không kết nối được tới Cloudinary. Vui lòng kiểm tra mạng.');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.secure_url) {
    throw new Error(`Tải ảnh thất bại: ${json?.error?.message || res.status}`);
  }
  return { url: json.secure_url, width: json.width, height: json.height };
}

// Chọn file từ máy
export function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ALLOWED.join(',');
    input.onchange = () => resolve(input.files[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}
