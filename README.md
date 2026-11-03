# Velours

Website nước hoa dùng React/Vite, Express/MongoDB, Clerk và Cloudinary.

## Chạy và kiểm tra

- Trong `client/`: chạy `npm ci`, rồi `npm run dev`.
- Trong `server/`: chạy `npm ci`, rồi `npm start`.
- Frontend: `npm run lint` và `npm run build` trong `client/`.
- Backend: `npm test` và `npm run test:tools` trong `server/`.
- `dist/` là file sinh tự động; chạy build trước `npm run preview`.
- Giữ `client/.env` và `server/.env`, không đưa chúng vào Git.

## Tiếp tục chuyển ảnh Cloudinary

Đã chuyển 9.443 URL ảnh; còn 12.651 file local cho các đợt sau trên gói Free.
Giữ `data/cloudinary-migration-2026-11-01/` và `.backups/cloudinary-migration-2026-11-01/` để tiếp tục và hoàn tác.
Ảnh trong `client/public/` vẫn phục vụ website và dữ liệu kiểm thử.
Báo cáo đợt đầu: [completion.json](data/cloudinary-migration-2026-11-01/completion.json).

Chạy trong `server/` khi quota cho phép:

    npm run media:migrate -- status
    npm run media:migrate -- upload --scope=local --concurrency=8
    npm run media:migrate -- verify --concurrency=24
    npm run media:migrate -- apply --apply --database=vouges
    npm run media:migrate -- audit

Uploader mặc định dừng ở 90% credits, không tự nâng cấp tài khoản.
Hoàn tác một nhóm: `npm run media:migrate -- rollback --apply --database=vouges --batch=<ten-backup.json>`.

## Triển khai

Backend: từ gốc dự án, chạy `node tools/deploy/prepare-backend.mjs` để đóng gói các tiện ích dùng chung bên trong function root.
Frontend: trong `client/`, chạy `npm run build:artifact -- --backend=https://vouges-backend.vercel.app`.

    vercel deploy --prod --skip-domain --yes --project vouges-backend --cwd .deploy-media-backend
    vercel deploy --prebuilt --archive=tgz --prod --skip-domain --yes --project velours --cwd .deploy-media-frontend

Kiểm tra bằng `vercel curl <deployment-url>/ --yes --scope ixi4` trước khi promote.
Dùng `--archive=tgz` để giảm số lượt upload file trên Vercel Free.

Dữ liệu vận hành nằm trong `server/data/`. Thư mục `data/` giữ các đầu vào kiểm thử, cấu hình đối chiếu, xác nhận quyền đăng lại nội dung và checkpoint xử lý/chuyển ảnh còn cần dùng. Các báo cáo giao diện, cache nhập liệu và backup của những đợt chỉnh sửa đã hoàn tất đã được dọn.

`tools/deploy/` dùng để đóng gói backend; `tools/media/` phục vụ xử lý ảnh. Các module và bài kiểm thử trong `tools/apaniche/` vẫn được `npm run test:tools`, `npm run test:library` và công cụ kiểm tra giao diện sử dụng; các script thu thập/nhập dữ liệu một lần đã được loại bỏ.
