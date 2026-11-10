# Website tin tức

Website tin tức gồm **trang hiển thị** (giao diện kiểu báo điện tử) và **trang quản trị** (`/admin/`).

- Hosting: **Firebase Hosting** (gói miễn phí Spark)
- Dữ liệu và đăng nhập: **Firestore** + **Firebase Authentication** (Email/Mật khẩu)
- Ảnh: **Cloudinary** (cloud `z8zq9710`, preset `webtintuc_upload`)
- Mã nguồn: GitHub, tự động dựng và đưa lên mạng bằng **GitHub Actions**
- Không dùng framework hay gói npm: chỉ cần **Node.js 20+** để dựng web.

## Cách hoạt động

```
Admin đăng bài ──► Firestore (bài viết + "mục lục" meta/index)
                        │                         │
                        │                         └──► Người đọc mở trang: tải trang dựng sẵn, rồi đọc mục lục
                        │                              (1 lượt đọc) → bài mới hiện NGAY, không chờ gì cả
                        ▼
        GitHub Actions (mỗi 30 phút, chỉ dựng khi nội dung đã đổi; hoặc khi bạn bấm chạy / đẩy mã)
              │  node scripts/build.mjs  → các trang HTML đầy đủ nội dung (nhanh, tốt cho Google)
              ▼
        Firebase Hosting (dist/)
```

- **Đăng bài là hiện ngay** trên trang chủ, chuyên mục, tìm kiếm và trang bài; gỡ bài cũng biến mất ngay.
- "Mục lục" là một tài liệu tóm tắt các bài đã đăng, **tự cập nhật mỗi khi Admin lưu/duyệt/gỡ/xóa bài, sửa menu, banner**.
  Lần đầu cài đặt (hoặc khi thấy lệch), vào **Quản trị → Tổng quan → Đồng bộ lại mục lục**.
- Mục lục giữ tối đa khoảng 1.200 bài mới nhất; bài cũ hơn vẫn xem được ở trang riêng và nằm trong bản dựng tĩnh.
- Bản dựng tĩnh chạy nền để trang tải nhanh và tốt cho Google; Actions so sánh số phiên bản của mục lục với web đang chạy,
  không đổi thì bỏ qua (tiết kiệm hạn mức miễn phí).
- Mỗi lượt mở trang chủ/chuyên mục tốn 1 lượt đọc Firestore (gói miễn phí 50.000 lượt/ngày ≈ 50.000 lượt xem trang/ngày).
  Nếu vượt, trang vẫn hiện bản dựng sẵn, chỉ chậm cập nhật bài mới.

## Xem thử trên máy (không cần Firebase)

```bash
npm run preview        # dựng dữ liệu mẫu rồi mở http://localhost:5173/
```
- Trang web: `http://localhost:5173/`
- Trang quản trị (chế độ DEMO, dữ liệu lưu trong trình duyệt): `http://localhost:5173/admin/`
  - Admin: `thanhitc.humg@gmail.com` · Biên tập viên: `editor@example.com` · mật khẩu nhập gì cũng được.

## Đưa lên mạng lần đầu (làm đúng thứ tự)

### 1. Luật bảo mật Firestore
Firebase Console → **Firestore Database → Rules** → dán toàn bộ nội dung file `firestore.rules` → **Publish**.

### 2. Tạo tài khoản chủ web (làm NGAY sau bước 1)
Firebase Console → **Authentication → Users → Add user**: nhập email chủ web (`thanhitc.humg@gmail.com`) và mật khẩu.
> Hãy tạo tài khoản này trước khi công bố web, để không ai khác đăng ký trước bằng email đó.

Lần đầu bạn đăng nhập `/admin/` bằng tài khoản này, hệ thống tự tạo hồ sơ Admin (chủ web) cho bạn.

### 3. Khóa cho GitHub Actions
1. Firebase Console → ⚙ **Project settings → Service accounts → Generate new private key** (tải file `.json`).
2. Google Cloud Console → **IAM** → tìm tài khoản dịch vụ vừa dùng (dạng `firebase-adminsdk-…`) → thêm hai vai trò:
   **Firebase Hosting Admin** và **Cloud Datastore Viewer**.
3. GitHub → kho `thanhitchumg-lgtm/tintuc` → **Settings → Secrets and variables → Actions → New repository secret**:
   tên `FIREBASE_SERVICE_ACCOUNT`, giá trị là **toàn bộ nội dung file .json**.
4. Xóa file `.json` khỏi máy sau khi dán (đây là khóa bí mật, **không bao giờ đưa vào code**).

### 4. Đẩy mã nguồn lên GitHub
Đẩy toàn bộ thư mục này lên nhánh `main`. GitHub Actions sẽ tự chạy và đưa web lên
`https://webtintuc-59437.web.app`.

### 5. Tạo nội dung
Vào `/admin/` → **Menu** (tạo chuyên mục) → **Bài viết** (viết bài) → **Banner**.

## Tùy biến

| Muốn đổi | Sửa ở |
|---|---|
| Tên web, khẩu hiệu, địa chỉ web | `config/site.json` (`siteName`, `tagline`, `siteUrl`) |
| Màu sắc | đầu file `src/css/site.css` (biến `--nav`, `--accent`) và `src/css/admin.css` |
| Chủ web (email) | `config/site.json` (`ownerEmail`) **và** dòng `isOwner()` trong `firestore.rules` (dán lại vào Rules → Publish) |
| Tần suất kiểm tra để dựng lại | `.github/workflows/deploy.yml` (dòng `cron`) |
| Số bài mỗi trang chuyên mục | `config/site.json` (`pageSize`) |

## Phân quyền

| | Admin | Biên tập viên |
|---|---|---|
| Viết bài, lưu nháp, gửi duyệt | ✔ | ✔ |
| Tự đăng bài | ✔ | ✘ (chờ Admin duyệt) |
| Sửa/xóa bài của người khác | ✔ | ✘ |
| Chọn vị trí nổi bật trang chủ | ✔ | ✘ |
| Menu, Banner, Người dùng | ✔ | ✘ |

Chủ web (`ownerEmail`) luôn là Admin và Admin khác không hạ quyền được. Admin tạo tài khoản cho người khác ngay
trong mục **Người dùng**. Khóa một người: đổi vai trò thành "Đã khóa".

## Vị trí nổi bật trên trang chủ

Trang chủ có 8 vị trí: 1 = bài lớn nhất; 2 = ảnh lớn cột giữa; 3–6 = danh sách cột giữa; 7–8 = hai bài dưới bài lớn.
Bài nào được chọn vị trí thì ở đúng chỗ đó; chỗ còn trống được lấp bằng bài mới nhất, rồi xếp theo thời gian.

## Giới hạn cần biết (gói miễn phí)

- **Tìm kiếm** theo tiêu đề, lọc ngay trong trình duyệt (gõ không dấu vẫn tìm được), phù hợp đến vài nghìn bài.
- **Cloudinary**: 25 credit/tháng dùng chung cho lưu trữ, băng thông và biến đổi ảnh. Theo dõi trong Dashboard Cloudinary.
  Ảnh được nén trong trình duyệt trước khi tải lên (tối đa 1600px).
- **Tên preset Cloudinary** không ký nên ai biết tên đều tải ảnh lên được; nếu thấy ảnh lạ, đổi tên preset
  (sửa `config/site.json` và preset trên Cloudinary).
- **Tài khoản đã xóa quyền** vẫn còn trong Firebase Authentication; muốn xóa hẳn hãy xóa ở Firebase Console.
- Tài khoản cần gói Blaze nếu sau này muốn dùng Cloud Functions hoặc Firebase Storage (hiện không cần).

## Cấu trúc thư mục

```
config/site.json        cấu hình (tên web, Firebase, Cloudinary)
src/shared/             khuôn HTML, làm sạch nội dung, xếp bài trang chủ (dùng chung Node + trình duyệt)
src/css, src/js         giao diện và mã trình duyệt của trang công khai
src/admin/              trang quản trị
scripts/build.mjs       dựng web tĩnh vào dist/ (lấy dữ liệu từ Firestore qua REST)
scripts/serve.mjs       máy chủ xem thử trên máy
firestore.rules         luật bảo mật
firebase.json           cấu hình Hosting
.github/workflows       tự động dựng + đưa lên mạng
```
