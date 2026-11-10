// Dữ liệu mẫu để xem giao diện (chỉ dùng cho bản xem thử, KHÔNG đưa lên web thật).
// Nội dung và hình ảnh đều do hệ thống tự tạo, không lấy từ trang báo nào.
import fs from 'node:fs';
import path from 'node:path';

const BASE = new Date('2026-11-10T07:00:00Z').getTime();
const iso = (minAgo) => new Date(BASE - minAgo * 60000).toISOString();

export const sampleMenus = [
  { id: 'm-xh', name: 'Xã hội', slug: 'xa-hoi', parentId: null, order: 1, visible: true },
  { id: 'm-vm', name: 'Kinh tế vĩ mô', slug: 'kinh-te-vi-mo', parentId: null, order: 2, visible: true },
  { id: 'm-kd', name: 'Kinh doanh', slug: 'kinh-doanh', parentId: null, order: 3, visible: true },
  { id: 'm-dn', name: 'Doanh nghiệp', slug: 'doanh-nghiep', parentId: 'm-kd', order: 1, visible: true },
  { id: 'm-tt', name: 'Thị trường', slug: 'thi-truong', parentId: 'm-kd', order: 2, visible: true },
  { id: 'm-cn', name: 'Công nghệ', slug: 'cong-nghe', parentId: null, order: 4, visible: true },
  { id: 'm-song', name: 'Sống', slug: 'song', parentId: null, order: 5, visible: true },
  { id: 'm-tth', name: 'Thể thao', slug: 'the-thao', parentId: null, order: 6, visible: true },
  { id: 'm-gt', name: 'Giải trí', slug: 'giai-tri', parentId: null, order: 7, visible: true },
  { id: 'm-gd', name: 'Giáo dục', slug: 'giao-duc', parentId: null, order: 8, visible: true },
];

const T = [
  ['Doanh nghiệp nội địa tăng tốc chuyển đổi số trong quý cuối năm', 'm-dn', ['m-kd', 'm-cn']],
  ['Thị trường lao động khởi sắc, nhiều ngành tăng tuyển dụng', 'm-xh', ['m-vm']],
  ['Chỉ số giá tiêu dùng ổn định, kỳ vọng tăng trưởng được duy trì', 'm-vm', []],
  ['Ba xu hướng công nghệ doanh nghiệp vừa và nhỏ cần quan tâm', 'm-cn', ['m-kd']],
  ['Giá vàng trong nước biến động nhẹ sau phiên giao dịch đầu tuần', 'm-tt', ['m-kd']],
  ['Cách sắp xếp thời gian giúp người đi làm cân bằng cuộc sống', 'm-song', []],
  ['Đội tuyển trẻ giành chiến thắng thuyết phục ở vòng bảng', 'm-tth', []],
  ['Chương trình hòa nhạc cuối năm công bố danh sách nghệ sĩ tham gia', 'm-gt', []],
  ['Trường đại học mở thêm ngành đào tạo về dữ liệu và trí tuệ nhân tạo', 'm-gd', ['m-cn']],
  ['Xuất khẩu nông sản đạt kết quả tích cực trong mười tháng', 'm-vm', ['m-kd']],
  ['Những lưu ý khi chọn mua thiết bị thông minh cho gia đình', 'm-cn', ['m-song']],
  ['Giao thông dịp cuối tuần: khuyến cáo người dân chủ động lịch trình', 'm-xh', []],
  ['Startup công nghệ gọi vốn vòng mới để mở rộng thị trường khu vực', 'm-dn', ['m-cn']],
  ['Thực đơn lành mạnh cho người bận rộn trong mùa lạnh', 'm-song', []],
  ['Giải chạy cộng đồng thu hút hàng nghìn người tham gia', 'm-tth', ['m-song']],
  ['Phim Việt mới ra rạp nhận nhiều phản hồi tích cực từ khán giả', 'm-gt', []],
  ['Kỳ thi học kỳ: mẹo ôn tập hiệu quả cho học sinh cuối cấp', 'm-gd', []],
  ['Lãi suất tiền gửi có xu hướng ổn định trong những tuần tới', 'm-tt', ['m-vm']],
  ['Ngành logistics đẩy mạnh ứng dụng tự động hóa kho bãi', 'm-dn', []],
  ['Giải pháp tiết kiệm điện cho hộ gia đình mùa cao điểm', 'm-song', ['m-xh']],
  ['Tuyển sinh đầu cấp: phụ huynh cần chuẩn bị gì', 'm-gd', ['m-xh']],
  ['Ứng dụng di động mới giúp quản lý chi tiêu cá nhân', 'm-cn', []],
  ['Thị trường bất động sản nhà ở: nguồn cung dần cải thiện', 'm-tt', ['m-kd']],
  ['Lễ hội văn hóa địa phương trở thành điểm đến mới của du khách', 'm-xh', ['m-song']],
  ['Bóng đá phong trào: mô hình giải đấu doanh nghiệp lan rộng', 'm-tth', []],
  ['Triển lãm ảnh về đời sống đô thị mở cửa miễn phí', 'm-gt', ['m-xh']],
];

const PARAS = [
  'Theo thông tin ghi nhận từ nhiều nguồn, tình hình chung trong thời gian qua có nhiều điểm đáng chú ý. Các chuyên gia cho rằng đây là tín hiệu tích cực nhưng vẫn cần theo dõi thêm trong các tháng tới.',
  'Đại diện đơn vị liên quan cho biết kế hoạch triển khai sẽ được thực hiện theo từng giai đoạn, ưu tiên những hạng mục có tác động trực tiếp tới người dân và doanh nghiệp.',
  'Bên cạnh đó, một số ý kiến đề xuất cần có thêm hướng dẫn cụ thể để quá trình thực hiện thuận lợi hơn, đồng thời tăng cường công khai thông tin để người dân dễ theo dõi.',
  'Trong thời gian tới, các bên sẽ tiếp tục phối hợp, rà soát và điều chỉnh để bảo đảm mục tiêu đề ra. Thông tin chi tiết sẽ được cập nhật khi có kết quả mới.',
];

function content(i) {
  return `<p>${PARAS[i % 4]}</p><h2>Những điểm đáng chú ý</h2><ul><li>Diễn biến chung được đánh giá theo chiều hướng tích cực.</li><li>Các đơn vị liên quan đang chuẩn bị phương án cho giai đoạn tiếp theo.</li><li>Người dân và doanh nghiệp được khuyến khích theo dõi thông tin chính thức.</li></ul><p>${PARAS[(i + 1) % 4]}</p><blockquote>Đây là bài viết mẫu dùng để xem thử giao diện trang web.</blockquote><p>${PARAS[(i + 2) % 4]}</p>`;
}

const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');

export const sampleArticles = T.map(([title, primary, extra], i) => {
  const status = i === 22 ? 'draft' : i === 23 ? 'pending' : 'published';
  return {
    id: `a${i + 1}`,
    title,
    slug: slugify(title),
    summary: 'Nội dung tóm tắt ngắn gọn của bài viết giúp người đọc nắm nhanh thông tin chính trước khi bấm vào đọc chi tiết.',
    contentHtml: content(i),
    heroImage: { url: `/sample/img-${(i % 12) + 1}.svg`, alt: 'Ảnh minh họa' },
    menuIds: [primary, ...extra],
    primaryMenuId: primary,
    status,
    featuredSlot: i === 4 ? 1 : i === 9 ? 3 : null,
    authorUid: i % 3 === 0 ? 'u-editor' : 'u-admin',
    authorName: i % 3 === 0 ? 'Biên tập viên' : 'Ban biên tập',
    createdAt: iso(i * 95 + 20),
    updatedAt: iso(i * 95 + 10),
    publishedAt: status === 'published' ? iso(i * 95 + 10) : null,
    seoTitle: '',
    seoDescription: '',
  };
});

export const sampleBanners = [
  { id: 'b1', title: 'Quảng cáo mẫu 1', imageUrl: '/sample/banner-1.svg', linkUrl: 'https://example.com/', position: 'home-right', order: 1, active: true },
  { id: 'b2', title: 'Quảng cáo mẫu 2', imageUrl: '/sample/banner-2.svg', linkUrl: 'https://example.com/', position: 'home-right', order: 2, active: true },
  { id: 'b3', title: 'Quảng cáo cột bên', imageUrl: '/sample/banner-3.svg', linkUrl: 'https://example.com/', position: 'sidebar', order: 1, active: true },
];

export const sampleUsers = [
  { uid: 'u-admin', email: 'thanhitc.humg@gmail.com', displayName: 'Ban biên tập', role: 'admin', isOwner: true },
  { uid: 'u-editor', email: 'editor@example.com', displayName: 'Biên tập viên', role: 'editor' },
];

/* ---- Ảnh SVG tự tạo (trừu tượng, không có người/thương hiệu) ---- */
const PALETTES = [
  ['#0f766e', '#f59e0b'], ['#1d4ed8', '#22d3ee'], ['#9333ea', '#f472b6'], ['#b45309', '#fde68a'],
  ['#be123c', '#fb923c'], ['#166534', '#a3e635'], ['#0e7490', '#a5f3fc'], ['#4338ca', '#fbbf24'],
  ['#7c2d12', '#fdba74'], ['#115e59', '#5eead4'], ['#831843', '#fda4af'], ['#1e3a8a', '#93c5fd'],
];

function artSvg(i, w = 1200, h = 750) {
  const [a, b] = PALETTES[i % PALETTES.length];
  const k = i + 1;
  const circles = [0, 1, 2].map((n) => {
    const cx = ((k * 137 + n * 311) % 100) / 100 * w;
    const cy = ((k * 71 + n * 197) % 100) / 100 * h;
    const r = 120 + ((k * 53 + n * 89) % 200);
    return `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r}" fill="#fff" opacity="${(0.08 + n * 0.05).toFixed(2)}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${circles}<path d="M0 ${h * 0.78} C ${w * 0.25} ${h * 0.62}, ${w * 0.55} ${h * 0.95}, ${w} ${h * 0.7} L ${w} ${h} L 0 ${h} Z" fill="#000" opacity="0.18"/></svg>`;
}

function bannerSvg(i, label, w = 600, h = 500) {
  const [a, b] = PALETTES[(i * 3 + 1) % PALETTES.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><circle cx="${w * 0.8}" cy="${h * 0.25}" r="${h * 0.3}" fill="#fff" opacity="0.12"/><text x="50%" y="48%" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="700" fill="#fff">${label}</text><text x="50%" y="60%" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#fff" opacity="0.85">${w / 2}×${h / 2} · banner mẫu</text></svg>`;
}

export function writeSampleAssets(distDir) {
  const dir = path.join(distDir, 'sample');
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 12; i++) fs.writeFileSync(path.join(dir, `img-${i + 1}.svg`), artSvg(i));
  fs.writeFileSync(path.join(dir, 'banner-1.svg'), bannerSvg(1, 'Vị trí quảng cáo'));
  fs.writeFileSync(path.join(dir, 'banner-2.svg'), bannerSvg(2, 'Vị trí quảng cáo'));
  fs.writeFileSync(path.join(dir, 'banner-3.svg'), bannerSvg(3, 'Quảng cáo cột bên'));
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({
    menus: sampleMenus, articles: sampleArticles, banners: sampleBanners, users: sampleUsers,
  }));
}
