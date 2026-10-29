# Tối ưu toàn website — 29/10/2026

Các thay đổi dưới đây đã được kiểm tra cục bộ, chưa triển khai production. Đợt này bổ sung cho [tối ưu catalog và trang khách hàng](STOREFRONT_PERFORMANCE.md) và [tối ưu dashboard](DASHBOARD_PERFORMANCE.md).

## Tài nguyên tải trang

| CSS trong bản production | Trước | Sau |
| --- | ---: | ---: |
| CSS ban đầu của cửa hàng, chưa nén | 229,3 KB | 176,8 KB |
| CSS ban đầu của cửa hàng, gzip | khoảng 41 KB | khoảng 32 KB |
| CSS riêng dashboard | nằm trong CSS ban đầu | khoảng 53 KB, tải khi vào quản trị |

Bốn stylesheet quản trị được nhập tại layout Sidebar, giữ nguyên thứ tự ghi đè. Các biểu đồ mùi hương ở cửa hàng vẫn dùng stylesheet chung. Chrome đã xác nhận trang khách hàng không tải CSS Sidebar trước khi vào quản trị.

React, router và Clerk được tách thành các chunk riêng để trình duyệt tái sử dụng mã thư viện khi mã ứng dụng thay đổi. Tổng JavaScript của lần tải đầu không giảm đáng kể chỉ nhờ tách chunk; đây là cải thiện khả năng dùng lại cache. Các trang, biểu đồ doanh thu và trình soạn thảo tiếp tục tải riêng theo nhu cầu.

Preload bốn font thường Lora/Inter, gồm Latin và tiếng Việt, từ file nội bộ có hash. Không preload font nghiêng. Kiểm tra trình duyệt xác nhận mỗi file chỉ phát sinh một yêu cầu, không tải trùng giữa preload và font-face. Favicon PNG dùng đúng MIME.

## Tài khoản, đơn hàng và checkout

- `GET /api/orders/mine?page=1&pageSize=10` trả từng trang lịch sử thay vì tải toàn bộ đơn và toàn bộ hồ sơ sản phẩm. API xác thực, lấy tài khoản từ server, giới hạn pageSize 10/20 và trả `Cache-Control: private, no-store`. Giữ nguyên điều kiện lịch sử cũ: đơn COD hoặc đã thanh toán, kể cả đơn từng đặt rồi được hủy; không thay công thức đếm đơn của dashboard.
- Mỗi dòng đơn chỉ populate tên, ảnh đầu tiên, ảnh dung tích, giá và trạng thái xóa; thông tin sản phẩm/giá đã chốt trong đơn tiếp tục được ưu tiên. Ảnh thẻ lịch sử dùng biến đổi Cloudinary 160px. Phân trang đưa màn hình lên đầu danh sách sau khi có dữ liệu; bố cục điện thoại tránh cắt tên và giá.
- Lịch sử đơn và sổ địa chỉ dùng cache bộ nhớ 30 giây theo tài khoản. Các yêu cầu đồng thời dùng chung Promise; đăng xuất/đổi tài khoản hủy cache. Thao tác lưu/sửa/xóa/đặt mặc định địa chỉ thành công vô hiệu hóa cache địa chỉ. COD đặt thành công hoặc QR được xác nhận thanh toán vô hiệu hóa lịch sử đơn.
- Quốc gia, tỉnh/phường Việt Nam và thành phố nước ngoài dùng cache công khai một giờ, tối đa 32 mục theo quốc gia. Mở lại checkout không tải lại cùng danh sách. Yêu cầu có timeout 10 giây; phản hồi sai định dạng có thể thử lại, giao diện nhập địa chỉ thủ công vẫn hoạt động khi API ngoài lỗi. Không lưu địa chỉ khách vào cache công khai.
- Kiểm tra QR mỗi bốn giây chỉ chạy khi tab đang hiển thị; quay lại từ ứng dụng ngân hàng/tab khác kiểm tra ngay. Bộ đếm hạn và xử lý thanh toán, hủy, hoàn kho giữ nguyên. API tạo đơn vẫn kiểm tra giá/tồn thực tế; không dùng cache lịch sử để xác nhận thanh toán.
- Nút thử lại trang quyền lợi có thể buộc đọc lại server thay vì trả lại snapshot cũ.

## Xác minh

- **423/423 kiểm thử backend đạt**, gồm phân quyền/phân trang lịch sử, cách đếm đơn, tách cache theo tài khoản, vô hiệu hóa sau thay đổi, cache địa lý và dừng/tiếp tục polling QR.
- ESLint toàn frontend và build production đạt.
- Chrome kiểm tra bản production với xác thực và lịch sử đơn/checkout giả lập: phân trang/cuộn, dùng lại cache khi quay lại, CSS quản trị tải riêng, font không tải trùng, checkout mở lại chỉ gọi một lần mỗi API địa chỉ/quốc gia/tỉnh thành trong cùng phiên.
- Đã kiểm tra trang chủ, lịch sử đơn, checkout và tổng quan quản trị ở desktop, 390px và 320px. Các số liệu catalog quản trị được đọc từ database; không ghi sản phẩm/kho/đơn hàng và không gửi email hay thanh toán thật.

Số đo CSS là dung lượng file build, không phải thời gian tải trang production. Tốc độ thực tế còn phụ thuộc hosting, cold start, Clerk, CDN và mạng. Cần triển khai **backend và frontend** để dùng API lịch sử mới; triển khai backend trước để tương thích client cũ.
