# Xác minh biểu đồ lưu hương và tỏa hương — 29/10/2026

Yêu cầu này chỉ nghiên cứu và đối chiếu; chưa thay đổi dữ liệu sản phẩm, biểu mẫu dashboard, bộ lọc hoặc biểu đồ vận hành.

## Kết quả đã xác minh

HTML công khai của Apaniche chứa sẵn số tại `.chart-value` và chiều rộng phần trăm tại `.chart-bar-fill`. Đây là hai cách thể hiện cùng một phân bố, không phải hai thông số độc lập. Trong các nhóm hợp lệ, công thức khớp dữ liệu là:

`chiều rộng thanh (%) = giá trị của mức / tổng giá trị các mức trong cùng nhóm × 100`

Apaniche làm tròn chiều rộng về một chữ số thập phân. Kiểm tra toàn bộ `data/research/apaniche/products.json`: 2.304 nhóm lưu hương và 2.305 nhóm tỏa hương có đủ số không âm, phần trăm hợp lệ và tổng dương đều khớp công thức, sai số không quá 0,051 điểm phần trăm. Không cộng gộp hai nhóm khi tính tổng. Những nhóm thiếu số, tổng 0 hoặc có dấu hiệu bất thường không tham gia kết luận này.

Ví dụ kiểm tra trực tiếp tại [Dior Sauvage EDP](https://apaniche.vn/dior-sauvage-edp): nhóm lưu hương có các giá trị 141, 263, 2.253, 5.374 và 964, tổng 8.995. Mức 9–12 giờ có chiều rộng `5.374 / 8.995 × 100 ≈ 59,7%`, đúng HTML. Đối chiếu thêm [Jo Malone English Oak & Hazelnut Cologne](https://apaniche.vn/jo-malone-english-oak-hazelnut-cologne) cho cùng quan hệ giữa số và chiều rộng.

## Điều chưa xác minh

Các trang đã kiểm tra không công bố trong khu vực biểu đồ phương pháp thu thập, số người tham gia, tập bình chọn gốc hoặc liên kết xác nhận nguồn đánh giá. HTML chỉ cung cấp kết quả hiển thị; công thức số học không chứng minh các giá trị là số người hoặc lượt bình chọn thật. Không đủ căn cứ gán những con số này cho khách mua tại Apaniche, Velours hoặc cộng đồng Fragrantica.

Do đó, `displayedCount` chỉ là tên trường kỹ thuật của số hiển thị trong nguồn. Chưa nên dùng nhãn “Số lượt đánh giá” như một thông tin đã xác thực. `methodologyVerified: false` vẫn phù hợp cho nguồn gốc thu thập, dù quan hệ số học của chiều rộng nay đã được kiểm chứng.

Nguồn còn có dữ liệu bất thường. Ví dụ [set Narciso Rodriguez Cristal](https://apaniche.vn/set-narciso-rodriguez-cristal-edp-50ml-body-lotion-50ml) có giá trị −124 và chiều rộng −23% tại một mức lưu hương. Điều này không phải số lượt hợp lệ; không tự đổi thành 0 hoặc chuẩn hóa các mức còn lại thành một phân bố mới. Bản gốc và cờ bất thường tiếp tục được giữ để đối chiếu.

## Hệ quả với Velours

- Nhãn “Số lượt” trong biểu mẫu hiện tại chưa đủ cơ sở; tên trung tính là “Giá trị nguồn”. Dữ liệu này cũng không phải nhận xét mua hàng của Velours.
- Với phân bố hợp lệ được biên tập, phần trăm cần được tính từ giá trị của cùng nhóm, thay vì cho nhập độc lập cả hai cột. Khi tổng bằng 0 hoặc dữ liệu chưa đầy đủ, cần biểu diễn trạng thái chưa có dữ liệu, không chia cho 0 hoặc tự tạo đánh giá.
- Lưu hương mô tả thời gian giữ mùi; tỏa hương mô tả mức lan tỏa. Nếu cần thông tin đặc tính sản phẩm do cửa hàng biên tập, nên có mức lưu hương/tỏa hương riêng và nguồn xác nhận, không coi số lớn nhất của một phân bố chưa xác thực là kết quả đo thực nghiệm.
- Quy tắc lọc hiện tại lấy mức có số hiển thị lớn nhất. Đây là quy tắc của Velours, chưa phải phương pháp phân loại được Apaniche xác nhận. Không tự thay đổi hàng loạt chỉ từ kết quả nghiên cứu này.

Kiểm tra số học chỉ áp dụng cho lưu hương và tỏa hương; không dùng công thức này cho các accord hoặc sáu thanh mùa/ngày/đêm.
