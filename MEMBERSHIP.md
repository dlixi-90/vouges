# Hồ sơ thành viên, voucher và đánh giá

## Clerk hiện dùng làm gì?

Frontend dùng `@clerk/react` cho đăng nhập/đăng ký, UserButton, quản lý hồ sơ xác thực và lấy session token. Backend dùng `@clerk/express` xác minh phiên; webhook Svix đồng bộ tài khoản vào MongoDB. Vai trò chủ cửa hàng do backend đối chiếu email chính đã xác minh với `ADMIN_EMAILS`/`ADMIN_EMAIL`. Giỏ hàng, địa chỉ, đơn hàng và ưu đãi được lưu trong MongoDB.

Phương thức email, mật khẩu và tài khoản liên kết cụ thể phụ thuộc cấu hình Clerk Dashboard; mã nguồn không cho biết các phương thức nào đang bật trong instance.

## Đăng nhập

Nút Login mở form Clerk hiện tại, dùng email hoặc tài khoản liên kết theo cấu hình instance. Đã bỏ trang đăng nhập bằng số điện thoại và luồng OTP SMS bổ sung trong mã nguồn.

Nếu đã bật đăng ký/đăng nhập bằng số điện thoại trong Clerk Dashboard, cần tắt các tùy chọn Phone và SMS dùng cho xác thực tại đó để form Clerk không tiếp tục cung cấp phương thức này. Thay đổi mã nguồn không tự thay đổi cấu hình Dashboard. Các tùy chọn xác thực email hiện có được giữ nguyên.

Cấu hình webhook `user.created`, `user.updated`, `user.deleted` tới `/api/clerk` với `CLERK_WEBHOOK_SECRET`. Webhook upsert khi gửi lại và chỉ đồng bộ các thông tin định danh đã xác minh. Số điện thoại nhận hàng vẫn được nhập/lưu trong địa chỉ giao hàng.

## Ngày sinh và voucher sinh nhật

Clerk không tự cung cấp ngày sinh đã xác minh. Có thể dùng [custom metadata](https://clerk.com/docs/guides/users/extending); triển khai này lưu ngày sinh trong MongoDB để backend kiểm soát điều kiện ưu đãi. Không dùng `unsafeMetadata` để quyết định quyền hay cấp voucher.

Mỗi tài khoản khách hàng được xem là thành viên. Trang `/membership` (menu tài khoản → Thành viên & voucher) cho nhập ngày sinh một lần. Backend kiểm tra ngày thật, không ở tương lai, từ năm 1900; cập nhật có điều kiện để tránh đổi liên tục nhận quà. Chỉnh sai cần cửa hàng hỗ trợ; chưa có giao diện quản trị chỉnh ngày sinh.

Chính sách khởi đầu: giảm **10%**, tối đa **100.000đ**, đơn tối thiểu **300.000đ**, **một lần mỗi năm**, hiệu lực **7 ngày tính từ 00:00 ngày sinh nhật theo giờ Việt Nam**. Ngày 29/2 tính là 28/2 trong năm không nhuận. Unique index trên thành viên/năm ngăn cấp trùng; chạy lại không gia hạn voucher. Trang ví cấp bù trong khoảng 7 ngày nếu tác vụ định kỳ bị lỡ. Đây là voucher trong ví, chưa gửi thông báo email/SMS sinh nhật.

`server/vercel.json` có lịch gọi `/api/vouchers/birthdays` lúc 17:00 UTC (00:00 Việt Nam). Đặt `CRON_SECRET` thành chuỗi bí mật dài trong môi trường backend; chỉ `Authorization: Bearer <CRON_SECRET>` được chạy tác vụ. Cron chỉ hoạt động sau khi triển khai cấu hình và được nền tảng chấp nhận. Khi chạy backend ngoài Vercel, dùng scheduler gọi URL này với header tương ứng. Không dùng `setInterval` trong serverless.

## Voucher và giao hàng

Chủ cửa hàng tạo/bật/tắt mã ở `/owner/vouchers`. Có mã giảm phần trăm hoặc số tiền cố định, mức đơn tối thiểu, trần giảm, thời gian hiệu lực và tổng lượt dùng. Form quản trị nhập tiền bằng **VNĐ**, backend theo quy ước hiện có **nghìn VNĐ**. Mỗi khách dùng tối đa một lần mỗi mã; chỉ áp dụng một mã mỗi đơn.

Thanh toán cho nhập mã, chọn giao hàng và gọi `/api/orders/quote` để kiểm tra giá/tồn kho/voucher ở backend. COD/QR tính lại trong MongoDB transaction; không tin giá, mức giảm hay phí gửi từ browser. Đơn lưu snapshot tiền hàng, mức giảm, phí và phương thức giao. Nếu tổng thay đổi so với báo giá, API từ chối để khách kiểm tra lại.

- Tiêu chuẩn: **30.000đ**, miễn phí khi tiền hàng **trước giảm giá** từ **500.000đ**; dự kiến 3–5 ngày.
- Giao nhanh: **50.000đ**, dự kiến 1–2 ngày, không miễn phí theo ngưỡng.
- Đây là biểu phí cửa hàng và lựa chọn dịch vụ; chưa gọi API GHN/GHTK/Viettel Post, chưa tính phí theo địa chỉ/cân nặng hay tạo vận đơn. Thời gian trên là ước tính.

COD tiêu thụ lượt voucher khi tạo đơn. QR giữ lượt khi tạo mã, hoàn lại cùng tồn kho khi hủy/hết hạn. Thanh toán tới sau khi đơn có voucher đã hết hạn được ghi nhận vào `Payment Review` để cửa hàng xử lý, tránh dùng lại voucher hai lần. Đơn cũ dùng cách đọc tương thích; email mới hiển thị giảm giá riêng với phí giao hàng.

MongoDB cần hỗ trợ transaction (replica set/Atlas, như luồng tồn kho hiện có). Đảm bảo indexes cho `Voucher` và `VoucherUse` được tạo trước khi phục vụ request production; các unique indexes là phần cần thiết để ngăn cấp/sử dụng trùng.

## Đánh giá

Chi tiết sản phẩm có trung bình sao, số đánh giá, danh sách phân trang và form 1–5 sao kèm nhận xét tối đa 2.000 ký tự. Chỉ khách đã có đơn chứa sản phẩm ở trạng thái `Delivery` được viết; QR phải thanh toán. Một đánh giá mỗi khách/sản phẩm, có thể cập nhật. Tên lấy từ backend, nhận xét render dạng text, API công khai không trả Clerk ID/email/ngày sinh. Lịch sử đơn đã giao có link tới phần đánh giá. Chưa có duyệt đánh giá, ảnh/video hay phản hồi của cửa hàng.

## Kiểm tra vận hành trước khi mở cho khách

Sau khi triển khai, kiểm tra đăng nhập bằng form Clerk và webhook đồng bộ tài khoản mới, tạo indexes, cron với `CRON_SECRET`, đơn COD/QR có voucher, QR hủy/hết hạn và đánh giá sau khi giao. Kiểm tra đồng thời hai request dùng lượt voucher cuối trên MongoDB staging. Unit tests có mock MongoDB để kiểm tra điều kiện/transaction wiring; không thay thế kiểm tra vận hành với dịch vụ thật.
