# Tối ưu storefront và bộ lọc nước hoa — 28/10/2026

Giữ catalog, ảnh sản phẩm, giao diện đã chốt và logic bán hàng. Không sửa dữ liệu MongoDB khi kiểm tra đợt này.

## Bổ sung tối ưu ngày 29/10/2026

Nút thắt được đo ở backend: một trang 16 sản phẩm vẫn đọc toàn bộ 2.324 hồ sơ thẻ qua MongoDB khi snapshot 10 giây hết hạn. Bây giờ các lượt duyệt mặc định, tìm tên, giới tính, hãng, xuất xứ và nồng độ được phân trang trực tiếp bằng aggregation; backend nhận đúng các thẻ cần trả, cùng metadata nhỏ cho tổng số/loại/giá trần. Quy tắc tồn kho từng dung tích được giữ nguyên cho cả `tracked` và `source`.

| Đo cục bộ trên cùng catalog, không ghi dữ liệu | Trước | Sau |
| --- | ---: | ---: |
| Trang đầu khi cache nguội: thời gian đọc/xử lý | 844 ms | 239 ms |
| Dữ liệu MongoDB trả về backend cho trang đầu | 2.518.485 byte | 58.488 byte |
| Trang tiếp theo khi metadata đã có | — | 85 ms / 10.165 byte |
| Trang đã có cache backend | — | 0 ms / không truy vấn |
| Sản phẩm liên quan khi cache nguội | — | 64 ms / 4.297 byte |

Đây là kích thước phản hồi driver và thời gian controller/database trong lần đo, không phải tổng tốc độ website production. Phản hồi API trang đầu gửi tới trình duyệt vẫn khoảng 9,9 KB. Các con số không gồm xác thực, cold start của hosting, tải mã JavaScript hoặc mạng của khách.

- Lọc giá/dung tích, sắp xếp giá và các tiêu chí hồ sơ hương tiếp tục dùng đường xử lý cũ để bảo toàn kết quả. Các truy vấn này chỉ lấy ảnh đại diện ngay tại MongoDB; metadata trải nghiệm được rút xuống các mức có thể dùng cho bộ lọc, giữ nguyên đồng hạng và phân biệt thiếu dữ liệu với 0. Bản ghi sản phẩm và số liệu nguồn không bị sửa.
- Sản phẩm liên quan chỉ đọc tối đa 6 thẻ sau truy vấn tìm sản phẩm gốc. Vẫn ưu tiên cùng danh mục; trường hợp danh mục chỉ có một sản phẩm vẫn dùng thứ tự loại/phổ biến như trước.
- Cache backend dùng chung cho trang/metadata/ảnh liên quan, tối đa 64 mục hoàn tất, vẫn vô hiệu hóa khi có thay đổi catalog hoặc giao dịch kho. Batch giỏ hàng tiếp tục đọc tồn/giá trực tiếp; các API checkout vẫn kiểm tra lại giá và kho trong giao dịch.
- Các tham số mặc định và nhóm lọc trống được chuẩn hóa ở client để tải trước và mở trang dùng chung request. Rê chuột/focus danh mục, thương hiệu và nút ở hero tải trước trang bộ sưu tập tương ứng. Lần tìm mới vẫn giữ hành vi tìm kiếm đã có; không tải toàn catalog xuống trình duyệt.
- Trang chủ tải danh sách gợi ý song song với yêu cầu bán chạy; chỉ hiển thị gợi ý sau khi server xác nhận chưa có sản phẩm bán chạy. Lỗi tải gợi ý nền không che danh sách bán chạy thật.
- Trang chi tiết dùng ngay dữ liệu đã tải trước. Bốn ảnh hàng đầu của bộ sưu tập được tải ưu tiên. Nút thử lại danh sách/feed có thể làm mới cưỡng bức cache client thay vì trả lại chính phản hồi đang bị lỗi.
- Danh sách sản phẩm dashboard chỉ lấy một ảnh mỗi thẻ, dùng chung ba danh sách lựa chọn lọc trong 5 phút và xóa cache khi chỉnh sửa. Chi tiết quản trị tải sản phẩm và bản ghi nguồn song song.

Đã đối chiếu chính xác 30 cấu hình tìm/lọc/phân trang, 2.324 bộ giá trị lọc, 42 trường hợp tồn kho và các kết quả liên quan với cách xử lý cũ bằng truy vấn chỉ đọc. Có thể chạy lại từ thư mục `server` bằng `node scripts/verifyStorefrontPerformance.mjs`; script không tạo/sửa sản phẩm hoặc đơn hàng. Chrome đã kiểm tra tải gợi ý khi API bán chạy bị giữ chậm, tải trước không trùng request, phân trang/cuộn, giới tính, chi tiết, giỏ một ID và bố cục 1440/390/320 px với xác thực/giỏ mô phỏng. Không gửi thanh toán, email hoặc thay đổi dữ liệu thật.

Các thay đổi cần triển khai cả frontend và backend. Toàn bộ 416 kiểm thử backend, lint và build frontend đạt; bundle chính vẫn trên ngưỡng cảnh báo 500 KB của Vite.

## Tải đúng dữ liệu cần dùng

- `GET /api/products/browse`: bộ sưu tập phân trang 16 sản phẩm; lọc, sắp xếp và tổng số kết quả xử lý ở backend. Mỗi thẻ chỉ nhận ảnh đại diện và thông tin cần hiển thị, không mang bài mô tả, bộ ảnh chi tiết hoặc hồ sơ hương.
- `GET /api/products/batch?ids=...`: giỏ hàng chỉ tải các sản phẩm đang có trong giỏ, tối đa 100 ID mỗi yêu cầu. Truy vấn tồn kho trực tiếp, không lấy từ snapshot catalog.
- `GET /api/products/related?productId=...`: chỉ trả tối đa 6 sản phẩm liên quan, giữ cách chọn danh mục/loại trước đây.
- Trang chủ tải 10 sản phẩm gợi ý hoặc 12 sản phẩm mới khi khu vực đó sắp xuất hiện. API bán chạy vẫn giữ kết quả bán hàng thật, không tạo doanh số giả.
- Chi tiết sản phẩm được chia sẻ giữa thao tác xem trước khi rê chuột và mở trang; bài mô tả/bộ ảnh không được tải cho mọi sản phẩm trong danh sách.
- API danh sách cũ vẫn giữ tương thích nhưng các trang storefront không còn gọi để tải toàn catalog.

## Bộ lọc

12 tiêu chí: Giới tính, Thương hiệu, Giá, Dung tích, Lưu hương, Tỏa hương, Thời điểm khuyên dùng, Note hương, Kiểu mùi hương, Phong cách, Nồng độ, Xuất xứ.

- Nhiều lựa chọn trong cùng tiêu chí dùng OR; các tiêu chí khác nhau dùng AND.
- Giới tính chỉ nhận Nam/Nữ/Unisex, dùng danh mục tương ứng nếu giá trị nguồn là placeholder. Không sửa dữ liệu gốc.
- Dung tích chỉ khớp các phân loại có thể mua. Lọc giá kết hợp dung tích dùng giá của dung tích khớp. Thẻ sản phẩm luôn hiển thị khoảng giá thấp nhất – cao nhất của toàn bộ dung tích có giá hợp lệ, kể cả dung tích tạm hết hàng; nếu các giá bằng nhau thì chỉ hiện một giá. Ví dụ: `350.000 ₫ - 3.950.000 ₫`.
- Lưu hương/tỏa hương dùng mức có nhiều lượt đánh giá dương nhất. Nếu bằng nhau, sản phẩm có thể khớp nhiều mức. Thiếu dữ liệu hoặc tất cả bằng 0 thì không tự xếp mức.
- Thời điểm khuyên dùng lấy các mùa/ngày/đêm có điểm từ 50% đến 100%. Đây là điểm phù hợp trong hồ sơ, không phải cam kết trải nghiệm cá nhân.
- Note hương tìm trong cả hương đầu, giữa và cuối; kiểu mùi dùng các accord; phong cách tách các mục đã nhập trong hồ sơ.
- Dữ liệu các lựa chọn chỉ tải khi có ý định mở bộ lọc. Danh sách dài có tìm kiếm và nút hiện thêm; không dựng hàng nghìn checkbox cùng lúc.
- Tìm kiếm chờ 180 ms sau khi gõ để gộp phím; đổi trang vẫn đưa màn hình lên hàng sản phẩm đầu tiên sau khi trang mới tải xong.

## Cache và tài nguyên

- Thẻ sản phẩm và giá/tồn dùng snapshot backend 10 giây, các yêu cầu đồng thời dùng chung truy vấn. Thao tác lưu catalog/sản phẩm và giao dịch đơn hàng làm hết hiệu lực snapshot sau khi hoàn tất.
- Hồ sơ dùng cho bộ lọc được tải riêng và giữ 5 phút, ghép với giá/tồn mới. Mở trang đầu không phải chờ tải toàn bộ hồ sơ hương.
- Trình duyệt giữ trang/chi tiết công khai 15 giây, tối đa 60 kết quả; danh sách thương hiệu và lựa chọn bộ lọc 5 phút. Những cache này chỉ ở bộ nhớ, không lưu lịch sử người dùng vào localStorage.
- Menu thương hiệu hiển thị ngay 173 tên/logo từ `client/src/data/brandDirectory.json`, bản xuất chỉ đọc từ catalog đã chốt; không chờ API/MongoDB mới dựng menu. Rê chuột, focus hoặc mở menu cập nhật danh sách ngầm qua cache metadata. Trong lúc tải lại hoặc lỗi mạng, danh sách hiện có vẫn tìm kiếm và điều hướng được; có nút thử lại. Mười logo đầu tải ngay khi mở, các logo bên dưới tải khi cuộn. API thương hiệu chia sẻ truy vấn đồng thời và cache trong server 60 giây; sửa catalog/thư viện làm hết hiệu lực cache. Khi thay catalog hàng loạt, có thể cập nhật bản đi kèm bằng `node scripts/exportBrandDirectory.mjs` trong thư mục `server`; script chỉ đọc database và ghi JSON tên/logo công khai, không mang giá/tồn hay dữ liệu khách hàng.
- Giỏ hàng và checkout luôn kiểm tra tồn/giá thật tại backend. Các số lượng trên thẻ có thể chậm hơn một nhịp cache; không dùng chúng để quyết định chấp nhận đơn.
- Dashboard tái sử dụng kết quả trong bộ nhớ theo tài khoản 30 giây, có làm mới cưỡng bức và hủy cache khi đổi tài khoản/quyền. Các API riêng tư vẫn yêu cầu xác thực và trả `private, no-store`.
- Font Lora/Inter được lưu tại `client/public/fonts`, gồm Latin và tiếng Việt, có giấy phép OFL. Không cần gọi Google Fonts khi mở trang. File font có tên theo hash và cache dài hạn; ảnh tĩnh có cache một ngày kèm revalidation.
- Chỉ khởi tạo index hỗ trợ sau xác thực khi truy cập API hỗ trợ; catalog không phải chờ ba lệnh khởi tạo này. Index vẫn được đảm bảo trước khi hỗ trợ ghi dữ liệu.
- Không đợi một lượt làm mới giỏ hàng bổ sung trước khi chuyển sang tổng quan đơn vừa đặt thành công.

## Đo và dọn dẹp

Kiểm tra chỉ đọc cùng database hiện tại:

| Phản hồi | Trước | Sau |
| --- | ---: | ---: |
| Số sản phẩm được gửi | 2.324 | 16 |
| JSON chưa nén | 3.635.437 byte | 10.059 byte |
| JSON gzip | 445.868 byte | 2.211 byte |

Đây là dung lượng phản hồi catalog, không phải tổng dung lượng website hoặc tốc độ kết nối của mọi người dùng. Tải lần đầu còn phụ thuộc vị trí backend, kết nối MongoDB, CDN ảnh và Clerk.

Đã xóa 102 file không còn được tham chiếu, tổng 7.938.392 byte: component cũ (ListProduct, PairWithProducts, Features, CartSteps, CartActionBar, SearchInput), ảnh sản phẩm mẫu/blog cũ, icon và ảnh gốc không còn dùng. Đã thu gọn `assets/data.js` và script tối ưu ảnh cho các tài nguyên còn dùng. Dữ liệu nghiên cứu, catalog thật, ảnh Cloudinary, bản sao lưu và script bảo trì vẫn được giữ; thư mục nghiên cứu/QA/backup không đưa vào gói triển khai.

Đã kiểm tra bằng Chrome: header trước khi tải danh mục; phân trang và cuộn; quay lại trang dùng cache; kết hợp 11 nhóm tiêu chí chọn trên dữ liệu thật; tìm kiếm; chi tiết/ảnh/tồn; giỏ hàng chỉ lấy một ID mẫu; dashboard và cache khi quay lại; font tiếng Việt; màn hình 1440/390/320 px. Không ghi đơn, kho hay gửi email trong các kiểm tra này.

Frontend và backend cần được triển khai cùng nhau vì storefront dùng các endpoint mới. Chưa triển khai lên production trong đợt này.

Kiểm tra bổ sung menu thương hiệu: cố ý giữ API chưa trả lời, xác nhận danh sách 173 hãng và mười logo đầu đã hiện, tìm kiếm/liên kết vẫn dùng được; phản hồi mới cập nhật ngầm mà không cần đóng menu. Khi API lỗi, danh sách vẫn giữ và thử lại phục hồi được. Đã kiểm tra máy tính và màn hình 390/320 px, không ghi database. 22 kiểm thử liên quan tới cache, thương hiệu và storefront đạt; build và ESLint các file thay đổi đạt.

Kiểm tra tự động: 380 bài kiểm thử backend đạt, build frontend và toàn bộ ESLint đạt. Kiểm tra chỉ dùng mock hoặc dữ liệu đọc; các dịch vụ email/thanh toán bên ngoài chưa được kiểm thử bằng giao dịch thật.
