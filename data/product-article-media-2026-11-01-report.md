# Mô tả sản phẩm và ảnh trong bài nguồn — 01/11/2026

Đã áp dụng **2.324/2.324 mô tả** vào cơ sở dữ liệu `vouges`, gồm phần bài viết và ảnh minh họa. Chỉ cập nhật `description`, `descriptionContent`, `updatedAt`; đã đối chiếu giữ nguyên giá, số lượng, dung tích, bộ ảnh đầu trang, ảnh từng dung tích, hồ sơ mùi và dữ liệu nguồn. 120 hồ sơ đã xóa không bị thay đổi.

## Xác định đúng phần mô tả

Đã mở [trang Agatho Parfum Adone người dùng chỉ](https://apaniche.vn/agatho-parfum-adone), tìm vùng `#tab-description` phía dưới thông tin mua hàng, đối chiếu với trường `description` trong API công khai. Khớp tiêu đề giới thiệu, tên Maurizio Cerizza và **cả ba ảnh** nằm trong bài. Không lấy `short_description` hoặc khu vực sản phẩm gợi ý làm bài chi tiết.

Đã thu thập mới đủ 2.324 bài vào vùng QA riêng. Nội dung đọc được biên soạn lại từ dữ kiện, có giới thiệu, thiết kế, diễn biến hương và bối cảnh sử dụng khi đủ thông tin; không sao chép nguyên bài. Các đoạn quảng bá hoặc nhắc tên cửa hàng nguồn không được đưa vào mô tả. Với 30 trang thiếu nội dung đủ điều kiện, dùng phần nghiên cứu từ hãng/nguồn bổ sung của đợt trước và vẫn bổ sung ảnh bài gốc.

## Ảnh

| Chỉ số | Kết quả |
| --- | ---: |
| Sản phẩm có ảnh trong bài | 2.323 |
| Vị trí ảnh đã chèn | 8.382 |
| URL ảnh tải được | 8.373 |
| Ảnh khác nhau sau loại trùng nhị phân | 8.361 |
| Số ảnh lớn nhất trong một bài | 16 |

Ảnh được đặt xen giữa các phần tương ứng. Loại trùng theo nội dung tệp nhưng giữ mọi ảnh khác nhau có thể truy cập công khai. Giữ nguyên toàn khung và những dấu/credit vốn có; chỉ chuyển định dạng và giới hạn cạnh tối đa 1.440px. Không dùng các đầu ra ảnh đã xóa chữ hoặc xử lý nền từ đợt trước. Đã tận dụng các bản tải gốc chưa chỉnh sửa có ánh xạ URL rõ ràng, lưu SHA-256 của bản gốc và tải bổ sung những ảnh chưa có.

Tệp nằm trong `client/public/images/product-articles/`, một số ảnh trùng được tái sử dụng từ `client/public/images/library/`. Có `loading="lazy"`, giải mã bất đồng bộ và kích thước nội tại để hạn chế nhảy bố cục. Ảnh trong bài được lưu trong tài liệu rich text, có thể tiếp tục biên tập bằng trình soạn thảo hiện tại.

Hai trường hợp nguồn:

- [Gucci Bloom EDP Intense](https://apaniche.vn/gucci-bloom-edp-intense): bài gốc có chữ, không có ảnh minh họa trong phần mô tả. Bộ ảnh đầu trang vẫn giữ nguyên.
- [Kilian Angel Share EDP](https://apaniche.vn/kilian-angel-share-edp): một ảnh nhúng từ Google chuyển sang trang đăng nhập, không trả ảnh công khai. Không đăng nhập hoặc vượt hạn chế truy cập. Các ảnh khác trong bài được thêm bình thường.

## Bảo toàn dữ liệu và kiểm tra

Trước khi ghi đã kiểm tra `updatedAt` cùng ID/URL nguồn của từng sản phẩm. Sao lưu đầy đủ tại `.backups/product-article-media-2026-11-01-2026-10-31T18-41-38-965Z/`, gồm `products-before.ejson`, `sources-before.ejson` và bản nhập. Ghi trong một giao dịch; đối chiếu toàn bộ bản ghi sản phẩm và nguồn ngay trong giao dịch, sau đó kiểm tra 2.324 tài liệu khớp bản chuẩn bị.

[Kết quả ghi dữ liệu](product-article-media-2026-11-01-result.json), [bản nhập và biên nhận ảnh](product-article-media-2026-11-01.json), [ngoại lệ ảnh yêu cầu xác thực](product-article-unavailable-media-2026-11-01.json).

Kiểm tra: 493 kiểm thử backend; 7 kiểm thử riêng cho bộ thu thập/bố trí ảnh, nội dung và bảo vệ khi nhập; lint các thành phần thay đổi; build frontend. Chrome kiểm tra sáu bài thật gồm Adone, bài 16 ảnh, mô tả bổ sung và phụ kiện; số ảnh, tải ảnh đầu/cuối, kích thước nội tại, xem trước trong trình soạn thảo và bố cục 390px/320px. Bộ kiểm tra trình duyệt chỉ đọc cơ sở dữ liệu.
