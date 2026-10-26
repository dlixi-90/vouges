# Catalog và dashboard nước hoa Velours

Catalog Apaniche đã được nhập làm dữ liệu vận hành của database `vouges`. Kết quả thực tế nằm trong [import-result.json](../data/research/apaniche/import-result.json).

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
| `/owner/edit-product/:id` | Thông tin chung, giá VND từng dung tích, thêm/bỏ dung tích, ảnh riêng, gallery, tầng hương, nhóm hương, phong cách, biểu đồ và bản ghi nguồn |
| `/owner/data` | Đối chiếu catalog với JSON nguồn không bị thay đổi khi biên tập |
| `/owner/brands` | 173 hãng và nội dung giới thiệu có thể biên tập |
| `/owner/library` | Nhóm hương, kiểu mùi, note; tìm kiếm, phân trang, biên tập nội dung và liên kết nguồn |
| `/owner/quality` | Hồ sơ thiếu hãng/nồng độ/ảnh/tầng hương, giá 0 và chỉ số nguồn bất thường |
| `/owner/orders` | Quy trình đơn hàng, COD/QR và biểu đồ doanh thu thực tế |

Danh mục, voucher và hộp thư CSKH tiếp tục dùng quy trình hiện có. API `/api/catalog/*` yêu cầu tài khoản chủ cửa hàng. Sửa sản phẩm kiểm tra `updatedAt` để tránh ghi đè thay đổi đồng thời. Không được bỏ dung tích hoặc đổi chế độ kho khi còn đơn QR giữ phân loại đó.

## Quy ước tiền và tồn kho

- Toàn bộ giá, phí giao hàng, voucher tiền mặt, tổng đơn, email, AI và QR dùng **VND nguyên đồng**. `1250000` hiển thị `1.250.000 ₫`; không nhân/chia 1.000 tại ranh giới API.
- Miễn phí giao tiêu chuẩn từ tổng tiền hàng 1.000.000đ trước voucher; dưới ngưỡng là 30.000đ. Giao nhanh 50.000đ; hỏa tốc thu phí riêng theo quy trình cũ.
- Người dùng đã chọn đặt hàng theo trạng thái còn/hết của nguồn. `inventoryMode: source` không suy diễn số lượng kho: `stockBySize` ban đầu bằng 0; `inStockBySize` quyết định khả năng đặt từng size. Giá 0 không được mở bán.
- Giới hạn thao tác là 10 sản phẩm mỗi lượt thêm, 100 sản phẩm mỗi dung tích trong giỏ/đơn; đây là giới hạn ứng dụng, không phải tồn kho của Apaniche.
- `inventoryMode: tracked` dành cho trường hợp chủ cửa hàng chuyển sang quản lý số lượng thật. Đơn lưu chế độ kho lúc mua; đặt/hủy đơn nguồn không tạo hoặc cộng số lượng giả.
- Giá và trạng thái là bản chụp tại thời điểm thu thập. **Chưa có tác vụ tự động đồng bộ thay đổi từ Apaniche.** Chủ cửa hàng có thể điều chỉnh catalog; bản gốc vẫn giữ nguyên.

## Thư viện và chỉ số

950 note bao gồm 609 note có tên/liên kết trong hồ sơ sản phẩm và phần URL bổ sung từ sitemap. Nội dung giới thiệu, nguồn gốc và ảnh minh họa chưa được nguồn nghiên cứu thu thập đầy đủ; các mục mang trạng thái `Cần biên soạn`, không tự sinh mô tả để lấp dữ liệu thiếu.

Biểu đồ lưu/tỏa hương, mùa và ngày/đêm giữ giá trị nguồn và dấu hiệu bất thường. Số âm hoặc tỷ lệ ngoài khoảng không được biến thành số hợp lệ giả. Phương pháp tổng hợp chưa được xác minh; biểu đồ mặc định ẩn trên cửa hàng và có thể bật theo từng sản phẩm. Các mùa/thời điểm là chỉ số độc lập, không cần cộng thành 100%.

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
