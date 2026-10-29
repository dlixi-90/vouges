# Quản lý khách hàng và hoàn thiện hồ sơ

## Dashboard

Trang **Khách hàng** tại `/owner/customers`, trong nhóm Vận hành, gồm họ tên, số điện thoại, ngày sinh đầy đủ `dd/mm/yyyy`, email đăng ký, số đơn đặt hàng và tổng tiền đã thanh toán bằng VND. Có tìm kiếm theo tên/điện thoại/email, phân trang 10/25/50 dòng, làm mới và chỉnh sửa họ tên/điện thoại/ngày sinh. Email lấy từ danh tính Clerk đã xác minh; biểu mẫu không thay email đăng nhập hoặc quyền tài khoản.

Số đơn và tiền dùng cùng điều kiện với dashboard hiện tại: trạng thái đã đặt/đóng gói/giao hàng/đã giao; COD đã đặt hoặc QR đã thanh toán. Tổng tiền chỉ cộng đơn có `isPaid=true`; không cộng lần thử QR, QR chờ thanh toán hoặc thanh toán cần kiểm tra. Chỉ tổng hợp đơn của tối đa 50 khách hàng trên trang đang xem. Tài khoản quản trị không nằm trong danh sách khách hàng.

## Tài khoản mới

- Bản ghi người dùng mới tạo bởi webhook Clerk hoặc lần đăng nhập được xác minh có `profileOnboardingRequired=true`. Tài khoản đã có trước tính năng không được cập nhật hàng loạt; thiếu cờ được xem là không yêu cầu onboarding.
- Khi tài khoản mới đăng nhập rồi vào trang chủ, popup tự mở sau khi hồ sơ được xác thực. Họ tên, điện thoại và ngày/tháng/năm sinh đều bắt buộc. Không đóng bằng Escape hoặc nhấp nền; có thể đăng xuất. Nếu chưa lưu hoặc lưu lỗi, lần truy cập sau vẫn cần hoàn tất.
- Backend xác minh ngày có thật, từ năm 1900 đến hiện tại, và **đủ 18 tuổi theo ngày tại Việt Nam**, không chỉ lấy năm hiện tại trừ năm sinh. Ví dụ ngày 29/10/2026, sinh 29/10/2008 được chấp nhận, sinh 30/10/2008 bị từ chối. Người sinh 29/02 đủ tuổi vào 01/03 nếu năm tròn 18 không nhuận. Giao diện dùng cùng quy tắc và chặn trước khi gửi.
- Sau lần lưu hợp lệ đầu tiên, `customerProfile.completedAt` được ghi cùng họ tên/điện thoại và ngày sinh trong một cập nhật có điều kiện. Popup không hiện lại sau tải lại, đăng nhập lại hoặc đổi thiết bị. Gửi lại do lỗi mạng hoặc hai tab đồng thời trả hồ sơ đã lưu, không ghi đè lần đầu. Chỉ quản trị viên có thể sửa sau đó.
- Họ tên và điện thoại liên hệ được lưu riêng với danh tính Clerk. Webhook cập nhật hoặc gửi lại không xóa thông tin đã nhập, ngày sinh hoặc trạng thái hoàn tất. Ngày sinh tiếp tục dùng cho quyền lợi thành viên; không thay đổi thông tin người nhận trong đơn cũ.
- Khi đăng nhập đến trước webhook, backend có thể đọc người dùng từ Clerk bằng ID phiên đã xác minh và upsert bằng `$setOnInsert`. Không tin role, email, ngày sinh hoặc metadata do trình duyệt gửi. Tài khoản có sẵn không gọi thêm Clerk API.
- COD và QR yêu cầu tài khoản mới hoàn thiện hồ sơ trước khi tạo đơn; không thể bỏ qua bằng gọi trực tiếp API. Điều kiện này không áp dụng hồi tố cho tài khoản cũ hoặc quản trị viên.

## API

| Phương thức | Đường dẫn | Quyền |
| --- | --- | --- |
| PATCH | `/api/users/profile` | Tài khoản đang đăng nhập; hoàn thiện một lần |
| GET | `/api/users/customers?q=&page=1&pageSize=25` | Chủ cửa hàng |
| PATCH | `/api/users/customers/:id` | Chủ cửa hàng; chỉ sửa khách hàng |

Payload hồ sơ/chỉnh sửa: `{ "fullName": "Nguyễn An", "phone": "0912345678", "birthday": "2000-12-21" }`. Điện thoại được chuẩn hóa như địa chỉ giao hàng. Phản hồi lỗi dữ liệu có `errors.fullName`, `errors.phone`, `errors.birthday`. Các API riêng tư trả `private, no-store`; cache danh sách trong bộ nhớ trình duyệt vẫn tách theo tài khoản và được làm mới sau chỉnh sửa.

## Kiểm tra

Ngày 29/10/2026: **441/441 kiểm thử backend đạt**, gồm 18 bài mới về hồ sơ, tuổi, xác thực, webhook gửi lại, lưu đồng thời, phân quyền, thống kê và chống bỏ qua. ESLint toàn frontend và build production đạt. Chrome kiểm tra bản production với danh tính/hồ sơ giả lập: ba trường bắt buộc, dưới 18 tuổi, không đóng bằng Escape, lỗi lưu/thử lại, tải lại sau hoàn tất, tài khoản cũ, tìm kiếm, phân trang/cuộn, sửa thông tin và màn hình 1440/390/320px.

Đã đối chiếu API trên trang đầu của dữ liệu thật bằng truy vấn chỉ đọc: số đơn và tiền bằng kết quả từ đơn đã lưu. Không tạo tài khoản, ghi hồ sơ khách hàng/kho/đơn thật hoặc gửi email trong kiểm tra. Chưa triển khai production; cần triển khai backend rồi frontend. Không cần chạy script đặt lại dữ liệu hoặc backfill tài khoản cũ.
