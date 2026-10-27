# Dữ liệu sản phẩm công khai của Apaniche

Nguồn: [apaniche.vn](https://apaniche.vn/), [API sản phẩm công khai](https://apaniche.vn/wp-json/wc/store/v1/products?per_page=1) và các URL chi tiết sản phẩm. Thời điểm lấy từng bản ghi nằm trong dữ liệu; số lượng và độ phủ mới nhất nằm trong [collection-summary.json](./collection-summary.json).

## Các tệp sử dụng

| Tệp | Nội dung |
| --- | --- |
| [products.json](./products.json) | Toàn bộ sản phẩm: thông tin API, ảnh, đặc tính, các biến thể và đánh giá hiển thị |
| [products.csv](./products.csv) | Bảng sản phẩm tổng hợp, mở bằng Excel hoặc phần mềm bảng tính |
| [variants.json](./variants.json) | Mỗi dòng là một biến thể/dung tích có dữ liệu chi tiết |
| [variants.csv](./variants.csv) | Giá, trạng thái bán và ảnh của từng biến thể |
| [assessments.csv](./assessments.csv) | Dữ liệu lưu/tỏa hương, mùa/ngày–đêm, nhóm mùi và tầng hương |
| [collection-summary.json](./collection-summary.json) | Độ phủ, các trường còn thiếu và lỗi thu thập |
| [quality-report.json](./quality-report.json) | Kiểm tra tính nhất quán sau thu thập |

Các tệp `catalog-base.json`, `product-details.jsonl` và `progress.json` là dữ liệu trung gian để kiểm tra và tiếp tục khi gián đoạn. `product-details.jsonl` có thể có nhiều lần lấy cho cùng một sản phẩm; các tệp xuất tổng hợp chỉ sử dụng bản ghi cuối cùng theo ID.

## Ý nghĩa và đơn vị

- `sourceId` là ID của Apaniche, không phải ID MongoDB của Velours.
- `price`, `regularPrice`, `salePrice`, `priceRange` và giá trong biến thể là tiền theo `currency`. Nguồn và Velours cùng dùng **VND: 1.250.000 đồng được lưu thành 1250000**. Không nhân/chia 1.000 khi trao đổi dữ liệu với ứng dụng.
- Giá cấp sản phẩm và giá theo dung tích đều được giữ nguyên từ nguồn tương ứng. Nếu giá biến thể khác khoảng giá của API, báo cáo chất lượng ghi nhận thay vì tự sửa.
- `inStock` chỉ là trạng thái còn hàng công khai, không phải số lượng tồn kho.
- `maxPurchaseQuantity` là giới hạn mua được nguồn hiển thị, không suy ra số lượng thực trong kho.
- `images[].url` là liên kết ảnh chung. `variants[].imageUrl` là ảnh biến thể; các size có thể dùng chung một URL.
- `variantSupplements` chứa biến thể được API danh mục liệt kê nhưng thiếu chi tiết trong HTML; đã bổ sung qua API công khai và giữ nguồn/thời gian riêng. Tệp `variants.json/csv` gộp cả phần này. Giá 0 từ nguồn được đánh dấu, không khẳng định đây là hàng miễn phí.
- `specifications` giữ tên thuộc tính và giá trị: hãng, xuất xứ, đối tượng, nhóm hương, nồng độ và các thuộc tính khác khi có.
- `scentNotes.top/middle/base` là các tầng hương được trang nguồn trình bày bằng dữ liệu có cấu trúc.
- `longevity` và `sillage` lưu `displayedCount` và `displayedPercent` đúng như biểu đồ nguồn. Chưa xác minh các con số có phải bình chọn thật hoặc được tổng hợp theo phương pháp nào.
- Khi số đếm nguồn là số âm, giữ ở `sourceRawCount`, đánh dấu `sourceCountIssue` và để `displayedCount = null`. Tương tự, phần trăm ngoài khoảng hợp lệ được giữ ở `sourceRawPercent` thay vì tự sửa số nguồn.
- `suitability[].displayedPercent` là chiều dài thanh Xuân/Hạ/Thu/Đông/Đêm/Ngày trên nguồn, không phải tỷ lệ hiệu quả đo thực nghiệm. Các mục không nhất thiết cộng thành 100%.
- Một số trang nguồn có giá trị phần trăm lớn hơn 100. Với các mục này, `sourceRawPercent` giữ nguyên số nguồn, `sourceValueIssue` đánh dấu bất thường và `displayedPercent` để `null`; không tự sửa thành 100 hoặc suy đoán số đúng.
- `assessmentProvenance.originalAssessmentSource = null` và `methodologyVerified = false` thể hiện chưa kiểm chứng được nguồn gốc/phương pháp của chỉ số.
- `null`, mảng trống hoặc trường không có nghĩa là nguồn chưa cung cấp hoặc chưa trích xuất được; không tự quy thành 0.
- `detailStatus` phân biệt `ok`, `error` và `pending`. Có `ok` không có nghĩa mọi trường đều hiện diện: một số mặt hàng không phải nước hoa hoặc chưa có biểu đồ/tầng hương.

## Phương pháp

1. Đọc robots và danh mục công khai qua Store API, phân trang theo ID ổn định, loại các bài mô tả dài khỏi trường dữ liệu yêu cầu.
2. Đọc trang chi tiết với hai yêu cầu đồng thời, giãn lượt bắt đầu tối thiểu 300 ms và lưu tiến độ.
3. Khi có mục đánh giá khách hàng, kết thúc đọc trước phần đó để tránh thu thập bình luận, thông tin người viết và phần điều hướng toàn site.
4. Chỉ trích xuất thuộc tính sản phẩm, số liệu hiển thị và URL ảnh. Không tải hàng loạt tệp ảnh hoặc sao chép nguyên bài giới thiệu/review.
5. Dừng khi có phản hồi từ chối truy cập; khi bị giới hạn tần suất, chờ theo phản hồi trước khi thử lại. Không sử dụng tài khoản, cookie đăng nhập hoặc đường dẫn quản trị.

## Chạy lại

Chạy từ thư mục gốc repository:

```powershell
# Tiếp tục những sản phẩm chưa có chi tiết
node tools/apaniche/collect-products.mjs

# Thử lại các trang từng gặp lỗi
node tools/apaniche/collect-products.mjs --retry-errors

# Chỉ xuất lại dữ liệu đã có
node tools/apaniche/collect-products.mjs --phase=export

# Kiểm tra dữ liệu tổng hợp
node tools/apaniche/validate-products.mjs

# Kiểm tra bộ trích xuất bằng dữ liệu giả lập
node --test tools/apaniche/product-parser.test.mjs
```

Dữ liệu đã được nhập làm catalog thật của Velours; xem [kết quả nhập](./import-result.json) và [hướng dẫn dashboard](../../../docs/PERFUME_CATALOG.md). Toàn bộ giá và trạng thái là ảnh chụp dữ liệu ở thời điểm thu thập; chưa có đồng bộ tự động. JSON nguồn được giữ nguyên, các chỉnh sửa bán hàng nằm riêng trong database.

## Màu sắc các kiểu mùi (Accords)

Ngày 28/10/2026, đã đối chiếu đủ **68 kiểu mùi** trong [thư viện Apaniche](https://apaniche.vn/thu-vien-mui-huong) với toàn bộ kiểu mùi xuất hiện trong 2.444 sản phẩm đã thu thập. Màu nền và màu chữ được lấy nguyên từ CSS `background-color` / `color` của `.accord-label` trên 21 trang sản phẩm đại diện. Không suy màu từ ảnh hoặc tự đặt bảng màu. Đối chiếu không có màu bị thiếu hoặc xung đột trong các trang mẫu.

- [accord-colors.json](./accord-colors.json) lưu tên Việt/Anh, mã màu, liên kết thư viện, trang sản phẩm đối chứng, thời điểm thu thập và SHA-256 các trang đã đọc.
- [accordColors.json](../../../client/src/data/accordColors.json) là bảng màu dùng trực tiếp ở frontend.
- `node tools/apaniche/collect-accord-colors.mjs` thu thập lại bảng màu. HTML dùng làm bộ nhớ đệm nằm trong `.qa-perfume/accord-colors/`, không đưa vào Git. Script không sửa database, giá hoặc tỷ lệ mùi hương.

Trang chi tiết và phần xem trước dashboard dùng chung thanh màu xếp dọc, độ dài đúng theo tỷ lệ đã lưu; tên và phần trăm nằm trên thanh. Các tỷ lệ độc lập, không ép tổng thành 100%. Khi chưa có tỷ lệ, hiển thị “Chưa có dữ liệu”; kiểu mùi do chủ cửa hàng tự đặt mà chưa có trong bảng màu sẽ dùng xám trung tính. Ánh xạ ưu tiên URL kiểu mùi, sau đó tên Việt/Anh, nên nhập lại tên có khác biệt hoa/thường hoặc dấu vẫn nhận được màu tương ứng.

Kiểm tra: `node --test tests/core/accordColors.test.js tests/core/perfumeCatalog.test.js` và `node scripts/perfumeBrowserQA.mjs --accord-colors` từ `server/`. Bộ kiểm tra trình duyệt đối chiếu màu thực tế, độ dài thanh, bản xem trước và màn hình 390px/320px; các chỉnh sửa thử không lưu vào database.
