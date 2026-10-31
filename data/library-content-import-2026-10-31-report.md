# Thư viện hương thơm — 31/10/2026

Đã thu thập và kiểm tra 1.222 trang gốc, nhập 1.203 phần giới thiệu vào cơ sở dữ liệu `vouges` trong một giao dịch có sao lưu.

| Loại | Đã kiểm tra | Có giới thiệu | Chờ nội dung |
| --- | ---: | ---: | ---: |
| Thương hiệu | 173 | 155 | 18 |
| Nhóm hương | 31 | 31 | 0 |
| Kiểu mùi | 68 | 68 | 0 |
| Note hương | 950 | 949 | 1 |
| Tổng | 1.222 | 1.203 | 19 |

Nội dung là bản giới thiệu mới dựa trên thông tin nguồn, không phải toàn văn bài gốc. Thương hiệu/nhóm hương/kiểu mùi và các note cần xử lý riêng được biên soạn thủ công; các note còn lại được trình bày từ tên, phân nhóm, sắc thái mùi, tên thực vật và vị trí tầng hương có trong nguồn. Mỗi phần tối đa 200 từ; kiểm tra không có chuỗi 18 từ liên tiếp trùng nguồn. Những dữ kiện lịch sử có dấu hiệu không nhất quán được bỏ khỏi bản giới thiệu.

Loại toàn bộ đoạn hoặc mục quảng bá có tên cửa hàng nguồn trước khi biên soạn. Kết quả lưu có **0 phần giới thiệu chứa “Apa Niche”**. Không nhập ảnh bài viết, không thay logo, mã thư viện, quan hệ sản phẩm hoặc dữ liệu sản phẩm. Đã bổ sung tên cho 341 note có tên trống. Khi nhập, nội dung tự biên tập và phiên bản dữ liệu khác thời điểm kiểm kê được bảo vệ bằng kiểm tra trước ghi và điều kiện phiên bản trong giao dịch.

Mỗi mục có trang đọc riêng tại `/knowledge/:kind/:slug`, kể cả mục còn thiếu nội dung; các mục thiếu hiển thị thông báo đang biên soạn. Danh bạ tìm kiếm/phân trang 24 mục. Sản phẩm liên quan được đọc từ các sản phẩm đang công khai, có 15 sản phẩm/trang; không trả toàn bộ danh mục cho trình duyệt. Chủ cửa hàng tiếp tục sửa phần Giới thiệu bằng trình soạn thảo đang có.

## 19 mục nguồn chưa có mô tả

18 trang thương hiệu dưới đây chỉ có danh sách sản phẩm, không có nội dung giới thiệu để biên soạn:

- [4711](https://apaniche.vn/nuoc-hoa-4711)
- [Agatho Parfum](https://apaniche.vn/nuoc-hoa-agatho-parfum)
- [Aristino Paris](https://apaniche.vn/nuoc-hoa-aristino-paris)
- [Ex Nihilo](https://apaniche.vn/nuoc-hoa-ex-nihilo)
- [Fragrance World](https://apaniche.vn/nuoc-hoa-fragrance-world)
- [French Avenue](https://apaniche.vn/nuoc-hoa-french-avenue)
- [Glossier](https://apaniche.vn/nuoc-hoa-glossier)
- [J.U.S Parfums](https://apaniche.vn/nuoc-hoa-j-u-s-parfums)
- [Kayali](https://apaniche.vn/nuoc-hoa-kayali)
- [Lusted](https://apaniche.vn/nuoc-hoa-lusted)
- [Maison Alhambra](https://apaniche.vn/nuoc-hoa-maison-alhambra)
- [Michael Kors](https://apaniche.vn/nuoc-hoa-michael-kors)
- [Profumum Roma](https://apaniche.vn/nuoc-hoa-profumum-roma)
- [Sensxsent](https://apaniche.vn/nuoc-hoa-sensxsent)
- [Sospiro](https://apaniche.vn/nuoc-hoa-sospiro)
- [Thameen](https://apaniche.vn/nuoc-hoa-thameen)
- [The Merchant of Venice](https://apaniche.vn/nuoc-hoa-the-merchant-of-venice)
- [Velixir](https://apaniche.vn/nuoc-hoa-velixir)

[Cam Đắng](https://apaniche.vn/note-huong-cam-dang) chỉ có thông báo đang cập nhật, không có mô tả hợp lệ. Không tự thêm dữ kiện để lấp những mục thiếu này.

## Dấu vết và kiểm tra

- [Bản nhập](library-content-import-2026-10-31.json): nội dung mới, URL bằng chứng, SHA-256, thời điểm thu thập và phương pháp biên soạn.
- [Kết quả ghi](library-content-import-2026-10-31-result.json): số lượng đã kiểm tra sau giao dịch và vị trí sao lưu.
- Bản sao đầy đủ trước nhập: `.backups/library-content-2026-10-31-2026-10-31T16-52-06-443Z/terms-before.ejson`.
- HTML nguồn chỉ lưu trong thư mục kiểm tra riêng `.qa-perfume/`, không đưa vào website hoặc gói frontend.
- Kiểm thử parser, loại quảng bá, nội dung thiếu, chống ghi đè, API công khai, phân trang, lọc quan hệ và rich text.
- Kiểm tra trình duyệt với dữ liệu thật, xác thực mô phỏng: tìm kiếm, bốn loại trang, đường dẫn thương hiệu, 15 sản phẩm liên quan, dropdown header, Escape và màn hình 390px/320px. Không ghi cơ sở dữ liệu trong kiểm tra trình duyệt.
