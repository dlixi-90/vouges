# Catalog và dashboard nước hoa Velours

Catalog Apaniche đã được nhập làm dữ liệu vận hành của database `vouges`. Kết quả thực tế nằm trong [import-result.json](../data/research/apaniche/import-result.json).

Storefront hiện tải theo trang 16 sản phẩm, header cố định ba danh mục nước hoa và hỗ trợ 12 tiêu chí lọc. Các thay đổi tối ưu không sửa catalog/kho trong database. Xem quy tắc lọc, cache, số đo và danh sách dọn dẹp tại [STOREFRONT_PERFORMANCE.md](STOREFRONT_PERFORMANCE.md).

## Dữ liệu sau chuyển đổi

| Nội dung | Số lượng |
| --- | ---: |
| Sản phẩm quản lý | 2.444 |
| Sản phẩm hiển thị trên cửa hàng | 2.324 |
| Sản phẩm có thể đặt hàng | 2.251 |
| Biến thể nguồn | 5.289 |
| Phân loại bán hàng, gồm sản phẩm đơn | 5.464 |
| Danh mục mới | 5, trong đó 4 hiện trên cửa hàng |
| Thương hiệu / nhóm hương / kiểu mùi / note | 173 / 31 / 68 / 950 |

120 mặt hàng ngoài phạm vi nước hoa được giữ trong dashboard để đối chiếu, mặc định ẩn và bị chặn mở bán. Không tự tạo dung tích cho 175 sản phẩm đơn không công bố dung tích: phân loại của chúng mang tên `Tiêu chuẩn`.

61 sản phẩm, 9 danh mục và 49 đơn cũ đã được thay thế. Đơn, doanh thu, đánh giá mua hàng và lịch sử dùng voucher cũ được xóa; giỏ hàng được làm trống. 5 tài khoản, địa chỉ, tin nhắn CSKH và nhật ký AI được giữ nguyên. Voucher giữ lại, đặt lại lượt dùng và chuyển các trường tiền sang VND.

## Sử dụng dashboard

| Trang | Chức năng |
| --- | --- |
| `/owner` | Tổng số hồ sơ, hiển thị, khả năng đặt hàng, doanh thu thực, chất lượng và độ phủ thư viện |
| `/owner/list-product` | Tìm theo tên, hãng, ID nguồn; lọc nồng độ, hiển thị, còn/hết, phạm vi và chất lượng; phân trang phía server; ẩn/hiện hàng loạt; xuất CSV trang hiện tại |
| `/owner/inventory` | Tra cứu giá và trạng thái, mở tab dung tích của sản phẩm |
| `/owner/edit-product/:id` | Thông tin chung, giá VND và số lượng từng dung tích, thêm/bỏ dung tích, ảnh riêng, gallery, tầng hương, nhóm hương, phong cách, kiểu mùi/tỷ lệ, chỉ số trải nghiệm và bản ghi nguồn |
| `/owner/data` | Đối chiếu catalog với JSON nguồn không bị thay đổi khi biên tập |
| `/owner/brands` | 173 hãng và nội dung giới thiệu có thể biên tập |
| `/owner/library` | Nhóm hương, kiểu mùi, note; tìm kiếm, phân trang, biên tập nội dung và liên kết nguồn |
| `/owner/quality` | Hồ sơ thiếu hãng/nồng độ/ảnh/tầng hương, giá 0 và chỉ số nguồn bất thường |
| `/owner/orders` | Quy trình đơn hàng, COD/QR và biểu đồ doanh thu thực tế |

Danh mục, voucher và hộp thư CSKH tiếp tục dùng quy trình hiện có. API `/api/catalog/*` yêu cầu tài khoản chủ cửa hàng. Sửa sản phẩm kiểm tra `updatedAt` để tránh ghi đè thay đổi đồng thời. Không được bỏ dung tích hoặc đổi chế độ kho khi còn đơn QR giữ phân loại đó.

Dashboard dùng chung khung quản trị đen trắng: menu chia nhóm, tìm nhanh sản phẩm/thương hiệu, tài khoản và lối vào hộp thư. Trang tổng quan có bốn chỉ số thực tế, biểu đồ giá trị đơn/đã thanh toán theo 3 hoặc 6 tháng và phân bổ trạng thái catalog. Khi chưa có doanh số, bảng sản phẩm hiển thị hồ sơ mới cập nhật; khi có doanh số sẽ chuyển sang xếp hạng bán chạy. Khối cần chú ý lấy hồ sơ thiếu dữ liệu, không suy diễn số lượng tồn kho từ trạng thái còn/hết hàng. Menu trên điện thoại có lớp phủ, phím Escape và giữ thao tác bàn phím trong menu đang mở.

Đơn hàng, danh mục, mã giảm giá và tin nhắn sử dụng cùng tiêu đề, thẻ, bảng, biểu mẫu và nút thao tác với catalog. Trang danh mục tải dữ liệu khi mở trực tiếp và đặt biểu mẫu cạnh danh sách; trang mã giảm giá dùng bảng cùng ngăn tạo mã bên phải, hỗ trợ đóng bằng Escape. Hộp thư giữ khung cuộn riêng cho danh sách/lịch sử, chuyển qua lại danh sách và nội dung trên điện thoại. Quy trình cập nhật trạng thái đơn, CRUD danh mục/voucher và tiếp nhận/trả lời hội thoại không thay đổi.

Thanh phân trang dùng chung hiển thị tối đa bảy vị trí số/dấu ba chấm, giữ trang đầu/cuối và các trang quanh trang hiện tại. Khi đổi trang, danh sách cuộn về hàng đầu sau khi dữ liệu mới tải xong; hộp thư cuộn trong vùng hội thoại riêng. Bộ sưu tập, dashboard, thư viện, đánh giá và hộp thư đều dùng cách này.

## Quy ước tiền và tồn kho

- Toàn bộ giá, phí giao hàng, voucher tiền mặt, tổng đơn, email, AI và QR dùng **VND nguyên đồng**. `1250000` hiển thị `1.250.000 ₫`; không nhân/chia 1.000 tại ranh giới API.
- Miễn phí giao tiêu chuẩn từ tổng tiền hàng 1.000.000đ trước voucher; dưới ngưỡng là 30.000đ. Giao nhanh 50.000đ; hỏa tốc thu phí riêng theo quy trình cũ.
- Catalog hiện dùng **`inventoryMode: tracked`** theo yêu cầu đồng bộ số lượng mua với tồn kho ngày 28/10/2026. Cả 2.444 sản phẩm đã chuyển sang chế độ này, giữ nguyên 5.464 số lượng theo dung tích và giá đã lưu. [Kết quả chuyển đổi và bản sao lưu](../data/tracked-inventory.json). Chế độ `source` trước đây chỉ dựa trên còn/hết, nên đã không giới hạn đơn theo các số lượng mới khởi tạo.
- Dashboard luôn có ô số lượng cho từng phân loại. Trang chi tiết hiển thị số lượng trong kho của dung tích đang chọn; số có thể thêm là tồn kho trừ số đã có trong giỏ. Khi đủ số lượng trong giỏ hoặc tồn bằng 0, nút tăng và thêm vào giỏ được khóa. Trang danh sách có tổng số lượng và phần mở rộng theo từng dung tích.
- Ngày 28/10/2026, toàn bộ 2.444 sản phẩm đã được bổ sung số lượng nội bộ theo yêu cầu mới nhất: **1–30 cho mỗi dung tích còn hàng, 0 cho dung tích hoặc sản phẩm hết hàng**. Số lượng được phân bổ ổn định theo mã sản phẩm và dung tích. Có 4.846 phân loại còn hàng, 618 phân loại bằng 0, tổng số lượng 74.792; toàn bộ các mức từ 1 đến 30 đều có trong catalog. Đây là mức khởi tạo của cửa hàng, không phải số tồn kho Apaniche công bố. Giá, trạng thái mở bán và dữ liệu nguồn giữ nguyên. [Kết quả phân bổ ban đầu](../data/inventory-range-distribution.json), [lần phân bổ theo giá trước đó](../data/inventory-distribution.json) và [lần khởi tạo ban đầu](../data/inventory-initialization.json) ghi lại số liệu cùng vị trí bản sao lưu.
- Script `server/scripts/initializePerfumeStock.js` mặc định chỉ xem trước, yêu cầu `--apply --database=vouges` để ghi trong một giao dịch có sao lưu. `--vary-by-price` thực hiện lần phân bổ theo giá trước đây; `--range=1-30` chuyển lần phân bổ đó sang 1–30. Các bản ghi `perfume-initial-stock-v1`, `perfume-varied-stock-v1` và `perfume-range-stock-v1` chặn chạy lại để tránh đặt lại số lượng sau khi chủ cửa hàng đã điều chỉnh. Script cũng từ chối ghi đè khi số lượng đã được sửa khác lần phân bổ trước.
- Mỗi lần thêm tối đa 100 sản phẩm và luôn bị giới hạn bởi số tồn còn có thể thêm của từng dung tích. Cửa hàng hiện có tồn khởi tạo 1–30; số lượng này do cửa hàng chọn, không phải số tồn do Apaniche công bố.
- `tracked` kiểm tra kho tại API giỏ hàng và đặt hàng; tạo đơn COD/giữ đơn QR trừ kho trong giao dịch, hủy/hết hạn QR hoàn lại theo quy trình hiện có. Đơn giữ chế độ kho lúc mua, nên các đơn nguồn cũ không được cộng kho giả khi hủy. Không đổi chế độ khi còn QR đang chờ. `server/scripts/enableTrackedInventory.js` hỗ trợ xem trước, sao lưu và áp dụng một lần bằng `--apply --database=vouges`.
- Giá và trạng thái là bản chụp tại thời điểm thu thập. **Chưa có tác vụ tự động đồng bộ thay đổi từ Apaniche.** Chủ cửa hàng có thể điều chỉnh catalog; bản gốc vẫn giữ nguyên.

## Thư viện và chỉ số

950 note bao gồm 609 note có tên/liên kết trong hồ sơ sản phẩm và phần URL bổ sung từ sitemap. Nội dung giới thiệu, nguồn gốc và ảnh minh họa chưa được nguồn nghiên cứu thu thập đầy đủ; các mục mang trạng thái `Cần biên soạn`, không tự sinh mô tả để lấp dữ liệu thiếu.

Biểu đồ lưu/tỏa hương, mùa và ngày/đêm luôn hiển thị trên trang chi tiết, kể cả sản phẩm cũ còn cờ `assessmentsVisible: false`; dashboard không còn nút bật/tắt. Có thể sửa số lượt và tỷ lệ, thêm/xóa/sắp xếp các kiểu mùi chính. Bản ghi nguồn và dấu hiệu bất thường vẫn được giữ để đối chiếu; giá trị được biên tập không ghi đè `CatalogSource`. Số lượt nhập phải là số nguyên không âm, tỷ lệ từ 0–100% hoặc để trống khi chưa biết. Không tự chuẩn hóa tỷ lệ hay tính từ số lượt vì phương pháp tổng hợp nguồn chưa được xác minh; các kiểu mùi và mùa/thời điểm độc lập, không cần cộng thành 100%.

Bộ ảnh hỗ trợ thêm tối đa 4 ảnh/lượt, thay từng ảnh, sắp xếp, xóa và chọn đại diện. Ảnh đầu là đại diện, được loại khỏi gallery chi tiết; ảnh riêng từng dung tích vẫn độc lập. Ảnh mới tối đa 5 MB/tệp, bộ ảnh tối đa 30 tệp.

## Mô tả dạng bài viết

Dashboard có trình soạn thảo trong phần **Thông tin chung → Mô tả sản phẩm**, áp dụng cả tạo mới và chỉnh sửa. Có tiêu đề lớn/nhỏ, cỡ và màu chữ, đậm/nghiêng/gạch chân/gạch ngang, căn lề, danh sách, trích dẫn, liên kết, đường phân cách, hoàn tác và xem trước. Có thể chèn tối đa 4 ảnh/lượt, thay hoặc xóa ảnh đang chọn, sửa mô tả/chú thích ảnh và chọn chiều rộng 50%, 75% hoặc 100%. Ảnh bài viết độc lập với ảnh đại diện, gallery và ảnh từng dung tích.

Bài viết tối đa 30.000 ký tự và 30 ảnh; mỗi tệp PNG/JPEG/WebP không quá 5 MB. Lưu bằng nút **Lưu thay đổi** của sản phẩm. Nội dung đang soạn được giữ khi chuyển tab; nút lưu và chuyển tab tạm khóa trong lúc tải ảnh. Trang chi tiết trình bày bài viết trong tab **Mô tả**, với ba tầng hương vẫn nằm phía dưới.

Trường `descriptionContent` lưu tài liệu có cấu trúc đã kiểm tra ở API; chỉ các kiểu nội dung, định dạng và URL cho phép được lưu. Trang cửa hàng dựng nội dung bằng React, không chèn HTML tùy ý. `description` tiếp tục giữ văn bản thuần tối đa 5.000 ký tự để tương thích danh sách, tìm kiếm và AI. Mô tả cũ không bị thay đổi khi triển khai; chỉ tạo tài liệu định dạng khi biên tập. Cần triển khai cả frontend và backend để lưu và đọc trường mới.

## Vận hành và kiểm tra

Chạy trong thư mục `server`:

```powershell
# Chỉ xem kế hoạch; không kết nối hoặc xóa dữ liệu
npm.cmd run catalog:preview

# Đã thực hiện một lần. Có khóa chặn chạy lại để không xóa đơn mới.
npm.cmd run catalog:reset

# Kiểm tra dữ liệu ngay sau chuyển đổi; phần sửa thử luôn rollback
node scripts/verifyPerfumeCatalog.js --check-write

npm.cmd test
```

`verifyPerfumeCatalog.js` kiểm tra trạng thái khởi tạo không có đơn; sau khi bắt đầu bán hàng, các kiểm tra số đơn/doanh thu bằng 0 sẽ không còn phù hợp.

`resetPerfumeCatalog.js` xác nhận tên database, yêu cầu replica set, sao lưu BSON Extended JSON vào `.backups/perfume-reset-<timestamp>/`, rồi thay dữ liệu trong một giao dịch MongoDB. `manifest.json` ghi số bản ghi trước khi thay. Thư mục này bị loại khỏi Git và chứa dữ liệu khách hàng; giữ nội bộ. Ảnh Cloudinary cũ không bị xóa.

`perfumeBrowserQA.mjs` kiểm tra desktop/mobile bằng dữ liệu database thật, giả lập Clerk riêng trong Chrome kiểm thử và chỉ đọc dữ liệu. Nó không sửa cơ chế xác thực của ứng dụng. Ảnh kiểm tra được ghi vào `.qa-perfume/`.

## Xử lý ảnh sản phẩm

Đã hoàn tất cập nhật ngày 27/10/2026:

| Nội dung | Kết quả |
| --- | ---: |
| Ảnh nguồn đã đối chiếu và xử lý theo vai trò | 11.216 |
| Sản phẩm có ảnh đại diện tách nền | 2.444 / 2.444 |
| Tệp ảnh đại diện tách nền riêng biệt | 2.443 |
| Ảnh đã xóa dòng website/số điện thoại | 3.286 |
| Ảnh thật bổ sung từ Open Graph của nguồn | 2 |
| Lỗi nguồn khi hoàn tất | 0 |

Hai hồ sơ dùng chung một ảnh nguồn nên số tệp ảnh đại diện khác số sản phẩm. Kiểm tra database xác nhận các trường ngoài ảnh của sản phẩm/đơn hàng và toàn bộ URL ảnh trong bản chụp nguồn không đổi.

Theo lựa chọn của chủ cửa hàng, ảnh được xử lý hàng loạt bằng mã, không sinh lại hình chai hoặc nhãn. Ảnh đại diện dùng WebP có nền trong suốt; màu nền khung vẫn do logic hiện có của cửa hàng quyết định. Ảnh gallery và ảnh từng dung tích giữ bối cảnh, chỉ xóa dòng website/số điện thoại được nhận diện. Ảnh gallery đã sửa có cạnh dài tối đa 2.000 px; bản nguồn đầy đủ vẫn được lưu.

Quy trình và lệnh chạy tiếp nằm trong [tools/media/README.md](../tools/media/README.md). Mỗi ảnh có kết quả riêng để tiếp tục sau gián đoạn. URL đã xử lý được tải vào thư mục Cloudinary riêng, không ghi đè ảnh nguồn. Bản sao các trường ảnh trong database được lưu trước mỗi lần cập nhật; ID, giá VND, tồn kho, phân loại dung tích và dữ liệu nguồn không thay đổi.

- [applied-avatars.json](../data/media-processing/applied-avatars.json): kết quả cập nhật ảnh đại diện đã thực hiện.
- [applied.json](../data/media-processing/applied.json): kết quả cập nhật toàn bộ ảnh, số hồ sơ thay đổi và đường dẫn bản sao lưu.
- [verification.json](../data/media-processing/verification.json): đối chiếu các trường ngoài ảnh và URL trong bản ghi nguồn với thời điểm trước xử lý.
- [audit.json](../data/media-processing/audit.json): 100 ảnh đại diện giữ nguyên RGB so với ảnh gốc/ảnh đã xóa chữ; 100 ảnh đã sửa không phát hiện dòng website/số điện thoại còn sót.
- [full-surface-complete.json](../data/media-processing/full-surface-complete.json): kết quả kiểm tra bổ sung trên toàn ảnh, gồm ảnh ghép có nhiều dòng lặp và mẫu đối chứng 100 ảnh.

Kiểm tra trình duyệt sau cập nhật đã đạt trên desktop 1.440 px và mobile 390 px: ảnh sản phẩm tải thành công, chuyển ảnh gallery hoạt động, giá VND và dashboard giữ đúng dữ liệu, không có tràn ngang. Bộ kiểm tra chỉ đọc database; kết quả và ảnh chụp nằm trong `.qa-perfume/`. Bốn kiểm tra xử lý ảnh bằng Python và bốn kiểm tra ánh xạ ảnh/sản phẩm bổ sung cũng đã đạt.

Gallery nguồn của `Creed Original Vetiver` và `Byredo Rose Of No Man’s Land Absolu Parfum` dùng ảnh chờ, nhưng metadata Open Graph trên chính trang Apaniche có ảnh chai thật. Hai ảnh này đã được kiểm tra trực quan, tách nền và bổ sung vào hai hồ sơ còn trống; thông tin nguồn nằm trong [extra-plan.json](../data/media-processing/extra-plan.json). Không sinh ảnh thay thế hoặc ghi đè ảnh chủ cửa hàng đã tự thêm. Bản chụp dữ liệu nguồn ban đầu vẫn được giữ nguyên.
