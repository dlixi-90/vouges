# Tối ưu tốc độ dashboard

Ngày kiểm tra: 29/10/2026. Các thay đổi nằm trong mã nguồn, chưa triển khai production.

## Những thay đổi đã thực hiện

- **Tổng quan:** API riêng `GET /api/catalog/overview` thay thế năm yêu cầu dữ liệu riêng lẻ. Chỉ lấy dữ liệu tổng hợp cho biểu đồ, tối đa năm sản phẩm gần đây, bốn hồ sơ cần hoàn thiện và năm sản phẩm bán chạy; không tải danh sách đơn hàng hoặc bộ lọc sản phẩm đầy đủ. Mỗi sản phẩm chỉ trả một ảnh.
- **Chuyển tab:** tải trước mã trang và dữ liệu khi rê chuột hoặc dùng bàn phím chọn liên kết. Yêu cầu tải trước và yêu cầu khi mở trang dùng chung cache, tránh gọi API trùng. Sidebar và thanh đầu trang vẫn hiển thị khi nội dung trang đang tải.
- **Cache quản trị:** giữ dữ liệu trong bộ nhớ theo tài khoản, thời hạn mới 30 giây; dữ liệu cũ có thể tiếp tục hiển thị trong lúc cập nhật. Ổn định hàm lấy token để việc render lại không tạo lại cache. Đổi tài khoản hoặc mất quyền chủ cửa hàng sẽ xóa dữ liệu liên quan. API riêng tư vẫn yêu cầu xác thực và không cho cache HTTP.
- **Đơn hàng & doanh thu:** dùng chung khóa cache giữa tải trước và tải trang, tải mã biểu đồ song song. Cập nhật trạng thái thành công vẫn làm mới doanh thu và sản phẩm bán chạy.
- **Mã giảm giá:** tái sử dụng danh sách khi quay lại. Thêm, sửa trạng thái hoặc xóa thành công cập nhật danh sách từ kết quả server, tránh gọi lại GET chỉ để phản ánh thao tác vừa hoàn tất. Nút Làm mới vẫn đọc lại server.
- **Tin nhắn & hỗ trợ:** lấy JSON hộp thư song song với kết nối SSE để không phải chờ khung dữ liệu trực tiếp đầu tiên. Giữ cập nhật trực tiếp; JSON tải chậm không ghi đè snapshot mới từ SSE. Các thao tác hỗ trợ làm mất hiệu lực cache hộp thư. Các yêu cầu đọc không còn phải chờ khởi tạo ba nhóm index; thao tác ghi vẫn chờ các index bắt buộc.

Không thay đổi công thức doanh thu, trạng thái thanh toán hay nội dung dữ liệu catalog.

## Kết quả đo

Đo chỉ đọc trên cùng bộ dữ liệu, không ghi đơn hàng, voucher hoặc tin nhắn thật:

| Trang tổng quan | Trước | Sau |
| --- | ---: | ---: |
| Yêu cầu dữ liệu từ trang | 5 | 1 |
| Lệnh đọc database | 16 | 7 |
| Tổng dung lượng JSON | 35.409 byte | 4.466 byte |
| Thời gian controller/database trong lần đo | 435 ms | 321 ms |

Thời gian trên không gồm xác thực, mạng hoặc khởi động server; đây không phải cam kết tốc độ production. Số truy vấn và dung lượng phản hồi là các mức giảm được kiểm tra trực tiếp. Các trang đơn hàng, voucher và hộp thư vốn có ít truy vấn; cải thiện chính là tránh tải lại và tránh chờ tuần tự.

## Kiểm tra

- Backend: **406/406 kiểm thử đạt**, gồm quyền truy cập API mới, payload giới hạn, bỏ truy vấn đơn hàng trên tổng quan, cache theo tài khoản, tải trước không trùng và snapshot hộp thư.
- Frontend: lint toàn client và build production đạt. Vite vẫn báo cảnh báo kích thước bundle chính trên 500 kB; đây là giới hạn còn lại, không phải lỗi build.
- Chrome: bốn tab tái sử dụng cache khi quay lại, không gọi thêm API JSON trong thời hạn mới; xác thực được mô phỏng. Hộp thư hiển thị khi SSE bị giữ chậm và không bị JSON cũ ghi đè tin mới.
- Kiểm tra thao tác trên fixture mô phỏng: phân trang/cập nhật trạng thái đơn hàng, thêm/bật-tắt/xóa voucher, trả lời và kết thúc hội thoại; desktop và mobile 390/320 px đều đạt. Không gửi tin nhắn hay ghi dữ liệu kinh doanh thật.

Cần triển khai cả frontend và backend để dùng API tổng quan mới. Chưa đo độ trễ Clerk, cold start hoặc đường truyền trên production.
