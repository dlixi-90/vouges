# Làm lại thư viện từ nguồn gốc — 01/11/2026

Đã áp dụng vào cơ sở dữ liệu `vouges` và kiểm tra lại 1.228 bản ghi. Không thay đổi sản phẩm, giá, dung tích hoặc tồn kho trong đợt này.

| Loại | Trang riêng | Có giới thiệu | Nguồn chưa có mô tả |
| --- | ---: | ---: | ---: |
| Thương hiệu | 179 | 155 | 24 |
| Nhóm hương | 31 | 31 | 0 |
| Kiểu mùi | 68 | 68 | 0 |
| Note hương | 950 | 949 | 1 |
| Tổng | 1.228 | 1.203 | 25 |

Đối chiếu các danh bạ [nhóm hương](https://apaniche.vn/thu-vien-nhom-huong), [kiểu mùi](https://apaniche.vn/thu-vien-mui-huong), [nguồn gốc note](https://apaniche.vn/nguon-goc-note-huong), [thương hiệu](https://apaniche.vn/thuong-hieu), sau đó tải từng trang chi tiết. Danh bạ mới có sáu thương hiệu chưa tồn tại: Ella K Parfums, Fragrance Du Boise, LONGTIEN, Mind Games, Mykonos, Toouch. Giữ các mục cũ có URL ổn định, bao gồm 4711 không còn trên danh bạ mới.

Nội dung được biên soạn từ dữ kiện của bài, bổ sung địa danh, nguyên liệu, phương pháp chế tác hoặc tác phẩm minh họa khi nguồn có đề cập. Có trích đoạn ngắn tối đa 20 từ và liên kết đọc bài gốc; không sao chép toàn bộ bài. Không dùng các đoạn quảng bá hoặc đoạn nhắc tên cửa hàng nguồn làm nội dung công khai. Với các thông tin lịch sử mâu thuẫn, không suy năm ra mắt một sản phẩm thành năm thành lập thương hiệu.

Đã tải thành công **2.854 URL ảnh**, loại ảnh trùng theo dữ liệu nhị phân thành **2.838 ảnh khác nhau**. Mỗi ảnh có một bản WebP giữ toàn khung, tối đa 1.440px và một bản thu nhỏ 360px. Ảnh minh họa nằm trong vùng nội dung biên tập và danh bạ; không gom ảnh từ lưới sản phẩm gợi ý. Ảnh gốc, thời điểm tải và SHA-256 nằm trong `.qa-perfume/library-refresh-2026-11-01/`. Giữ mọi dấu/credit trên khung hình gốc.

Trang thư viện có ảnh trên thẻ danh sách, ảnh trong phần đọc và phần minh họa tổng quan. Riêng note hương có 16 nguồn gốc, mỗi mục có hình, phần giải thích và bộ lọc kết hợp tìm kiếm. Menu Kiến thức đứng trước Về Velours ở cả hai kích thước màn hình.

Các mục không có mô tả đủ điều kiện tại nguồn giữ trạng thái cần biên soạn, có trang riêng và ảnh nhận diện nếu có. Danh sách: Agatho Parfum, Aristino Paris, Ella K Parfums, Ex Nihilo, Fragrance Du Boise, Fragrance World, French Avenue, Glossier, J.U.S Parfums, Kayali, LONGTIEN, Lusted, Maison Alhambra, Michael Kors, Mind Games, Mykonos, Profumum Roma, Sensxsent, Sospiro, Thameen, The Merchant of Venice, Toouch, Velixir, 4711; note Cam Đắng.

Sao lưu đầy đủ trước khi ghi: `.backups/library-refresh-2026-11-01-2026-10-31T18-12-35-889Z/terms-before.ejson`. Đã cập nhật 1.222 mục và thêm 6 mục trong một giao dịch, đối chiếu `updatedAt` để không ghi đè thay đổi đồng thời. Kiểm tra trong giao dịch bảo toàn tên, khóa, URL, thống kê liên kết và các trường ngoài phạm vi. [Kết quả nhập](library-refresh-2026-11-01-result.json), [bản nội dung và biên nhận ảnh](library-refresh-2026-11-01.json).

Kiểm tra: 492 kiểm thử backend; các kiểm thử nhập nội dung/ảnh, kiểm tra rich text và bảo vệ chỉnh sửa đồng thời; lint các thành phần thay đổi; build frontend. Kiểm tra Chrome riêng cho danh bạ, tìm kiếm, nguồn gốc note, trang đọc, ảnh và menu ở desktop, 390px và 320px được chạy bằng `node scripts/perfumeBrowserQA.mjs --knowledge`.
