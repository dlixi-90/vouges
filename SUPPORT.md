# Chat với nhân viên CSKH

Thay đổi trong mã nguồn, chưa triển khai lên website đang chạy.

## Sử dụng

- Khách đăng nhập, mở **Ask AI → Chat với nhân viên CSKH**. Tùy chọn chia sẻ tối đa 12 tin nhắn gần nhất giúp nhân viên biết nội dung AI chưa giải đáp; khách có thể bỏ chọn trước khi gửi yêu cầu. Câu hỏi đã gửi nhưng AI lỗi vẫn được giữ trong phần chia sẻ. Khách quay lại AI bằng nút mũi tên; lịch sử CSKH vẫn được lưu.
- Admin vào **Dashboard → Messages** (`/owner/messages`) để xem, tìm theo tên/email, lọc chưa đọc hoặc trạng thái, trả lời và đánh dấu hoàn tất/mở lại. Nhân viên dùng tài khoản có quyền `owner` hiện tại, được xác định từ `ADMIN_EMAILS`/`ADMIN_EMAIL`. Hộp thư chung dùng trạng thái đã đọc chung cho đội CSKH.
- Mỗi khách có một hội thoại được lưu trong MongoDB. Gửi tin sau khi hoàn tất tự mở lại hội thoại. Tin nhắn cũ tải theo từng nhóm 50; danh sách hội thoại tải 30 mục/trang. Khách có thể để lại tin nếu chưa có nhân viên phản hồi, không hiển thị trạng thái nhân viên online giả định.

## Kênh cập nhật

Gửi tin bằng HTTPS có Clerk bearer token; nhận cập nhật qua SSE dùng `fetch` để gắn cùng header xác thực. Không đưa token vào URL. Kênh hội thoại kiểm tra phiên bản trong MongoDB khoảng 1,5 giây/lần, hộp thư khoảng 2 giây/lần; chỉ gửi snapshot khi có thay đổi. Độ trễ thực tế còn phụ thuộc kết nối và database. Đây là SSE với kiểm tra thay đổi định kỳ trong backend, không phải WebSocket hoặc thông báo đẩy khi đã đóng web.

Phiên SSE kết thúc sau 20 giây và tự nối lại bằng token mới, có backoff khi lỗi. Đóng khung chat/chuyển hội thoại dừng kết nối; tab ẩn tạm ngừng, tab hiện nối lại và lấy snapshot mới để bù các tin đã lỡ. Đọc lịch sử cũ không tự kéo xuống cuối khi có tin mới. Tin nhắn được lưu trong database nên không phụ thuộc một process hoặc một instance Vercel.

Vercel có hỗ trợ [streaming Node.js](https://vercel.com/docs/functions/streaming-functions). Entry `server/server.js` khai báo `config.maxDuration = 60`, theo cơ chế đọc static config của [Node builder](https://github.com/vercel/vercel/blob/main/packages/node/src/build.ts) và [static-config](https://github.com/vercel/vercel/blob/main/packages/static-config/src/index.ts). Giữ streaming/HTTP buffering của proxy ở chế độ chuyển dữ liệu ngay; phải kiểm tra việc nhận tin trên môi trường triển khai thực tế.

## Dữ liệu và phân quyền

- Khách chỉ được đọc/gửi/đánh dấu đã đọc trong hội thoại của tài khoản mình. Hộp thư và thay đổi trạng thái yêu cầu quyền owner. Tên, vai trò và người gửi lấy từ tài khoản backend, không tin trường do browser gửi lên.
- `SupportConversation`, `SupportMessage`, `SupportUsage` là ba collection mới. Các unique indexes được đợi khởi tạo trước khi server phục vụ request. Tin nhắn và metadata/lượt chưa đọc được ghi trong cùng transaction. Cần MongoDB replica set/Atlas, như luồng đặt hàng hiện có.
- Mỗi lần gửi có một `clientMessageId`; gửi lại cùng ID/nội dung trả về tin cũ. Dùng lại ID cho nội dung khác bị từ chối. Client gộp theo ID và thứ tự `sequence`, không để snapshot đến chậm ghi đè trạng thái mới.
- Nội dung tối đa 3.000 ký tự/tin; context tối đa 12 mục, 2.000 ký tự/mục, 18.000 ký tự tổng. Nội dung hiển thị dạng văn bản. Context là nội dung khách chia sẻ, không được coi là tin nhắn của nhân viên hay hướng dẫn hệ thống.
- Rate limit theo tài khoản: 30 thao tác gửi/mở chat/kết nối stream mỗi phút cho khách, 120 cho owner. Bộ đếm có TTL; request đọc lịch sử/đánh dấu đã đọc vẫn yêu cầu xác thực. Responses là `private, no-store`. Không lưu nội dung vào localStorage.

## Kiểm tra và triển khai

Chạy `npm.cmd test` trong `server` và `npm.cmd run build` trong `client`. Các test CSKH nằm ở `server/tests/core/supportChat.test.js` và `supportChatClient.test.js`: phân quyền, đầu vào, gửi lại, transaction wiring, lượt chưa đọc, phân trang, context, parser SSE, ngắt kết nối và kết thúc phiên. Database được mock; các test không gửi tin thật cho khách/nhân viên.

Kết quả kiểm tra tại workspace: 260/260 kiểm thử đạt, build frontend thành công và ESLint đạt cho các file tích hợp CSKH.

Triển khai backend và frontend cùng phiên bản. Dùng một tài khoản khách và một tài khoản owner khác nhau để thử hai trình duyệt: gửi hai chiều, chia sẻ/bỏ chọn context, lọc chưa đọc, hoàn tất rồi gửi lại, tải tin cũ, chuyển tab và mất mạng/kết nối lại. Kiểm tra đồng thời gửi trùng ID trên MongoDB staging. Chưa có kiểm chứng bằng trình duyệt đã đăng nhập hoặc triển khai trong phiên làm việc này.
