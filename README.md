# Velours — Website thương mại điện tử nước hoa

Velours là website bán nước hoa theo mô hình B2C, kết hợp cửa hàng trực tuyến, thư viện kiến thức về hương và hệ thống quản trị. Khách hàng có thể tìm sản phẩm theo sở thích, chọn dung tích, đặt hàng, theo dõi đơn và sử dụng quyền lợi thành viên trong cùng một tài khoản.

- **Website:** [velours-jet.vercel.app](https://velours-jet.vercel.app)
- **Backend:** [vouges-backend.vercel.app](https://vouges-backend.vercel.app)

## Chức năng chính

### Cửa hàng và tài khoản khách hàng

- Tìm kiếm, lọc nhiều tiêu chí, sắp xếp và phân trang nước hoa nam, nữ, unisex.
- Xem ảnh, thuộc tính hương, đánh giá và giá theo từng dung tích.
- Quản lý giỏ hàng, thay đổi dung tích/số lượng và kiểm tra tồn kho.
- Đăng nhập qua Clerk; quản lý hồ sơ, sinh nhật và địa chỉ nhận hàng.
- Đặt hàng COD hoặc QR chuyển khoản qua SePay; áp dụng mã giảm giá và lựa chọn giao hàng.
- Theo dõi đơn cá nhân, xem chi tiết đơn và đánh giá sản phẩm sau khi mua đủ điều kiện.
- Nhận email xác nhận đơn qua SMTP.

### Kiến thức và chăm sóc khách hàng

- Thư viện **nhóm hương, kiểu mùi, note hương** với nội dung chi tiết và sản phẩm sử dụng.
- Chatbot qua Groq có thể tìm, so sánh sản phẩm và đọc giỏ/đơn của chính khách hàng.
- Đề xuất thay đổi giỏ từ chatbot chỉ được thực hiện sau khi khách xác nhận.
- Hội thoại với nhân viên, trạng thái chưa đọc và cập nhật tin nhắn qua SSE.

### Thành viên và ưu đãi

Trang thành viên chia thành hai tab **Thành viên** và **Mã giảm giá**. Chương trình loyalty có bốn hạng:

| Hạng | Doanh số xét hạng trong 12 tháng — giá trị khởi tạo | Điểm trên 1 triệu đồng hợp lệ |
|---|---:|---:|
| Signature | 0 đồng | 10 |
| Prestige | 15 triệu đồng | 12 |
| Elite | 40 triệu đồng | 15 |
| Private Circle | 100 triệu đồng | 20 |

Admin có thể cấu hình ngưỡng, tỷ lệ điểm và quyền lợi. Hệ thống hỗ trợ nâng hạng ngay khi đủ điều kiện, tái xét khi hết hạn, lịch sử thay đổi và thông báo. Điểm thưởng được quản lý riêng với doanh số: có hạn sử dụng, ledger, lô điểm theo FEFO, đổi quà và điều chỉnh khi hoàn trả. Quà tặng và đặc quyền chỉ khả dụng theo cấu hình, điều kiện và tồn kho thực tế.

### Khu vực quản trị

- Dashboard catalog, đơn hàng và doanh thu.
- Quản lý sản phẩm, biến thể, giá, tồn kho và hình ảnh.
- Quản lý danh mục, thương hiệu và thư viện hương.
- Xử lý đơn hàng, khách hàng và hội thoại hỗ trợ.
- Trang **Người dùng** xem khách hàng và Admin, tìm kiếm, lọc vai trò và chỉnh sửa hồ sơ khách. Quản trị gốc có thể cấp/thu hồi quyền Admin với lý do và nhật ký.
- Quản lý voucher, chính sách thành viên, quà, chiến dịch VIP và yêu cầu đổi quà.
- Điều chỉnh điểm/hạng với lý do và nhật ký thao tác.

## Công nghệ và kiến trúc

| Thành phần | Công nghệ |
|---|---|
| Frontend | React, Vite, React Router, Tailwind CSS và CSS riêng |
| Backend | Node.js, Express, JavaScript ES Modules |
| Cơ sở dữ liệu | MongoDB, Mongoose |
| Xác thực | Clerk, webhook xác minh bằng Svix |
| Hình ảnh | Cloudinary, tài nguyên tĩnh trong `client/public/` |
| Thanh toán | COD, QR chuyển khoản và webhook SePay |
| Email | Nodemailer, SMTP relay |
| Chatbot và hỗ trợ | Groq tool calling, REST API, SSE |
| Nội dung và thống kê | Tiptap, Recharts |
| Kiểm thử | Node Test Runner, ESLint, script QA trình duyệt |
| Triển khai | Vercel, frontend và backend riêng |

Frontend là ứng dụng SPA gọi REST API. Backend tổ chức theo route, middleware, controller, service và model. Các giao dịch cần tính nhất quán như tạo đơn, giữ hàng hoặc đổi quà sử dụng transaction; webhook và yêu cầu lặp có cơ chế chống xử lý trùng.

Quyền truy cập được kiểm tra tại backend. Khách hàng chỉ đọc và thay đổi dữ liệu của mình; khu vực quản trị yêu cầu vai trò `owner`. Các email trong `ADMIN_EMAILS` là quản trị gốc được bảo vệ; Admin được cấp trên website lưu quyền trong MongoDB và không được tự cấp quyền cho người khác. Thu hồi quyền chặn các yêu cầu quản trị tiếp theo; giao diện kiểm tra lại khi quay lại tab hoặc gặp lỗi quyền truy cập.

## Cấu trúc dự án

```text
vouges/
├── client/
│   ├── src/
│   │   ├── components/   Thành phần cửa hàng, thành viên và quản trị
│   │   ├── pages/        Các trang khách hàng và pages/owner/
│   │   ├── context/      Trạng thái ứng dụng, tài khoản và giỏ
│   │   ├── hooks/        Nạp dữ liệu và hành vi giao diện
│   │   ├── utils/        Tiện ích và quy tắc trình bày
│   │   └── data/         Dữ liệu tĩnh frontend
│   ├── public/           Ảnh, font và tài nguyên công khai
│   └── scripts/          Đóng gói frontend
├── server/
│   ├── routes/           REST API
│   ├── middleware/       Xác thực, phân quyền, upload, rate limit
│   ├── controllers/      Xử lý request/response
│   ├── services/         Nghiệp vụ bán hàng, loyalty, AI, hỗ trợ
│   ├── models/           Schema và index Mongoose
│   ├── data/             Dữ liệu tĩnh phục vụ API
│   ├── tests/            Kiểm thử core và AI
│   ├── scripts/          Kiểm tra và vận hành
│   └── server.js         Điểm khởi động backend
├── tools/                Công cụ triển khai, xử lý ảnh, module và test
├── data/                 Fixture và checkpoint còn sử dụng
├── .backups/             Backup phục vụ chuyển ảnh đang tiếp tục
├── BAO_CAO_DU_AN_VELOURS.md
└── README.md
```

Dữ liệu khách hàng, đơn hàng và giao dịch điểm nằm trong **MongoDB**. `server/data/` chứa dữ liệu tĩnh cho API; `data/` ở gốc chứa đầu vào kiểm thử, xác nhận quyền sử dụng nội dung và checkpoint vận hành. Tên thư mục kỹ thuật `vouges` được giữ ở một số cấu hình/script; thương hiệu hiển thị là **Velours**.

## Chạy dự án ở local

### Yêu cầu

- Node.js đáp ứng điều kiện của Vite: `^20.19.0 || >=22.12.0`, cùng npm tương thích.
- MongoDB hỗ trợ transaction, chẳng hạn Atlas hoặc replica set.
- Ứng dụng Clerk và cấu hình Cloudinary; cấu hình thêm SePay, Groq, SMTP để sử dụng các tích hợp tương ứng.

### Cấu hình môi trường

Trong `client/.env`:

```dotenv
VITE_BACKEND_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=<clerk-publishable-key>
```

Trong `server/.env`, cấu hình các nhóm biến:

| Nhóm | Tên biến |
|---|---|
| Server và database | `PORT`, `MONGO_URI` |
| Clerk | `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` |
| Quản trị gốc | `ADMIN_EMAILS` — các email quản trị gốc được bảo vệ, phân cách bằng dấu phẩy; quản lý Admin khác tại `/owner/users` |
| Cloudinary | `CLDN_NAME`, `CLDN_API_KEY`, `CLDN_API_SECRET` |
| SePay | `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`, `SEPAY_WEBHOOK_API_KEY` |
| AI | `GROQ_API_KEY`, `AI_MODEL`, `AI_RATE_LIMIT_PER_MINUTE`, `AI_RATE_LIMIT_PER_DAY` |
| Email | `SMTP_USER`, `SMTP_PASS`, `SMTP_SENDER_EMAIL` |
| Tác vụ định kỳ | `CRON_SECRET` |

Chi tiết từng biến và cách khởi tạo dữ liệu nằm trong Chương IV của [báo cáo](BAO_CAO_DU_AN_VELOURS.md). Giữ `.env` ngoài Git; các biến `VITE_` được công khai trong bundle nên không chứa khóa bí mật.

### Khởi động

Từ gốc dự án, mở terminal chạy backend:

```powershell
cd server
npm ci
npm run server
```

Mở terminal khác, cũng từ gốc dự án, chạy frontend:

```powershell
cd client
npm ci
npm run dev
```

Truy cập URL Vite in ra, thường là `http://localhost:5173`. Backend mặc định dùng cổng `3000`. Dùng `npm start` trong `server/` nếu muốn chạy backend không qua nodemon.

Database mới cần khởi tạo dữ liệu hoặc thêm qua Admin; cài dependency không tự phục hồi catalog đang vận hành.

## Kiểm tra và build

Trong `client/`:

```powershell
npm run lint
npm run build
npm run preview
```

Trong `server/`:

```powershell
npm test
npm run test:tools
```

Các tập kiểm tra chọn lọc gồm `npm run test:ai` và `npm run test:library`. Script QA giao diện nằm tại [server/scripts/perfumeBrowserQA.mjs](server/scripts/perfumeBrowserQA.mjs). `client/dist/` là đầu ra sinh tự động; cần build trước khi preview.

## Triển khai

Backend có sử dụng một số tiện ích chung từ frontend. Từ gốc dự án, tạo artifact để các module nằm trong function root:

```powershell
node tools/deploy/prepare-backend.mjs
```

Trong `client/`, tạo artifact frontend với API origin production:

```powershell
npm run build:artifact -- --backend=https://vouges-backend.vercel.app
```

Từ gốc dự án, với đúng tài khoản/project Vercel:

```powershell
vercel deploy --prod --skip-domain --yes --project vouges-backend --cwd .deploy-media-backend
vercel deploy --prebuilt --archive=tgz --prod --skip-domain --yes --project velours --cwd .deploy-media-frontend
```

Kiểm tra deployment bằng `vercel curl <deployment-url>/ --yes --scope ixi4` trước khi promote lên domain chính. `--archive=tgz` giúp giảm số lượt upload tệp; `--skip-domain` yêu cầu promote riêng để cập nhật alias chính. Biến môi trường cần được cấu hình riêng cho frontend/backend trên Vercel.

## Trạng thái và phần đang hoàn thiện

Các luồng catalog, giỏ, COD/QR, đơn hàng, thư viện, hỗ trợ và loyalty đã có triển khai cùng kiểm thử. Một số phần còn cần hoàn thiện:

- Form liên hệ và đăng ký bản tin chưa có quy trình gửi/đăng ký phía backend đầy đủ.
- Banner/menu chưa có màn hình cấu hình động riêng; một số liên kết footer và mạng xã hội còn chờ thông tin thực tế.
- Chưa kết nối API hãng vận chuyển hoặc hoàn tiền ngân hàng tự động.
- Chuyển ảnh lên Cloudinary tiếp tục theo từng đợt trên gói Free.

Phạm vi, giới hạn và hướng phát triển được mô tả đầy đủ trong [báo cáo dự án](BAO_CAO_DU_AN_VELOURS.md).

<details>
<summary>Vận hành chuyển ảnh Cloudinary</summary>

Theo [checkpoint ngày 01/11/2026](data/cloudinary-migration-2026-11-01/completion.json), đã ánh xạ 9.443 URL ảnh; kế hoạch còn 12.651 tệp local cho các đợt sau. Đây là số liệu checkpoint, không phải quota tài khoản hiện thời.

Giữ `data/cloudinary-migration-2026-11-01/`, `.backups/cloudinary-migration-2026-11-01/` và ảnh đang dùng trong `client/public/` để tiếp tục, kiểm tra và hoàn tác.

Chạy trong `server/` khi quota cho phép:

```powershell
npm run media:migrate -- status
npm run media:migrate -- upload --scope=local --concurrency=8
npm run media:migrate -- verify --concurrency=24
npm run media:migrate -- apply --apply --database=vouges
npm run media:migrate -- audit
```

Uploader mặc định dừng ở 90% credits, không tự nâng cấp tài khoản. Hoàn tác một nhóm theo backup:

```powershell
npm run media:migrate -- rollback --apply --database=vouges --batch=<ten-backup.json>
```

</details>
