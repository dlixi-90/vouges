# Cập nhật mô tả toàn bộ sản phẩm — 01/11/2026

Đã thay mô tả của **2.324/2.324 sản phẩm chưa bị xóa**, gồm cả sản phẩm hết hàng. Nội dung từng tự chỉnh sửa cũng được thay theo yêu cầu. Có 120 bản ghi đã xóa được giữ nguyên trong kho lưu trữ, không phục hồi lên website.

| Phạm vi | Số lượng |
| --- | ---: |
| Sản phẩm được đọc từ nguồn gốc | 2.324 |
| Có nội dung bài viết tại nguồn gốc | 2.294 |
| Nguồn gốc chỉ có ảnh, đã nghiên cứu bổ sung | 30 |
| Đã lưu mô tả dạng bài viết | 2.324 |
| Mô tả chứa tên cửa hàng nguồn | 0 |

Nội dung mới là bản giới thiệu biên soạn lại từ dữ kiện, không phải bản sao toàn văn bài viết bên ngoài. Mỗi bài có các mục phù hợp với dữ liệu: giới thiệu, đặc trưng mùi, tầng hương, thiết kế hoặc các thành phần trong bộ. Chỉ đưa năm ra mắt, người sáng tạo và chi tiết thiết kế khi nguồn có thông tin tương ứng. Không tự thêm thời gian lưu hương hoặc cam kết hiệu năng. Phụ kiện và bộ quà tặng được trình bày theo loại sản phẩm, không gán chung một tháp hương nước hoa.

Các đoạn quảng bá, liên hệ, mua hàng, bảo hành và đoạn chứa “Apa Niche” bị loại. Không lấy ảnh bài viết. Không sử dụng mô tả cũ làm đầu vào. Những nguồn chỉ có hình ảnh không được coi là đã có bài giới thiệu.

Phần mô tả ưu tiên cách chia tầng được ghi rõ trong bài nguồn. Danh sách note chỉ có một nhóm được gọi trung tính là “Các note hương được ghi nhận” khi hiển thị, tránh khẳng định toàn bộ đều thuộc hương cuối. Bộ chuyển đổi phân biệt chi tiết nắp/nhãn với thân chai; các trường hợp này có kiểm thử riêng.

## Nguồn bổ sung

[Danh sách 30 sản phẩm và URL bằng chứng](product-description-supplements-2026-11-01.json) ghi lại từng bản giới thiệu mới. Ưu tiên trang hãng; dùng nguồn bán lẻ hoặc cơ sở dữ liệu chuyên ngành khi hãng không có trang phù hợp.

- Creed Original Vetiver; Dior Holy Peony.
- Mykonos California Signature, California Blue, California Club, Dreamscape, Enchanted, Reflection, Slow Living và Sorrento.
- LONGTIEN Áo Dài, Bánh Mì Chấm Sữa, Kẹo Bông Gòn, Nàng, Quê Nhà và Trà Việt.
- Velixir Ares; Byredo Rose Of No Man’s Land Absolu; Chanel Coco Mademoiselle Crush Absolu.
- ELLA K Musc K và Pluie Sur Ha Long; Maison Crivelli Neroli Nasimba.
- Emporio Armani Stronger With You Powerfully; Ferragamo Signorina Unica; Lancôme Idôle Power.
- Parfums de Marly Athénaïs và Haltane; Armaf Perle D’or; Roja Isola Sol; Louis Vuitton Rain Tea.

Với các công bố khác nhau, mô tả bổ sung ưu tiên danh sách hãng. Trà Việt có thông tin tầng hương không nhất quán giữa các nguồn nên mô tả chỉ nêu các đặc tính chung và ghi rõ giới hạn này. Rain Tea được đối chiếu thêm với tên Tea Storm tại thị trường quốc tế. Những đối chiếu này chỉ cập nhật nội dung mô tả, không sửa các trường hồ sơ mùi riêng.

## Ghi dữ liệu và bảo toàn

Chỉ cập nhật `description`, `descriptionContent`, `updatedAt`. Tài liệu rich text qua cùng bộ kiểm tra với trình soạn thảo sản phẩm; bản văn bản thuần đồng bộ với tài liệu mới. Mỗi bài tối đa 200 từ theo phạm vi tổng hợp nội dung từ một nguồn, không chép các đoạn dài của bài gốc.

Giá, dung tích, tồn kho, trạng thái mở bán, hình ảnh, danh mục, hồ sơ mùi, đơn hàng và giỏ hàng không bị sửa. Bản ghi `CatalogSource` giữ nguyên. Giao dịch kiểm tra phiên bản, số lượng cập nhật và so sánh toàn bộ tài liệu sau ghi để phát hiện thay đổi ngoài phạm vi.

- [Bản nhập và bằng chứng](product-descriptions-2026-11-01.json).
- [Kết quả ghi và vị trí bản sao lưu](product-descriptions-2026-11-01-result.json).
- Sao lưu trước cập nhật: `.backups/product-descriptions-2026-11-01-2026-10-31T17-22-52-182Z/` (tên thư mục dùng UTC; thời điểm địa phương là ngày 01/11/2026).
- HTML/mô tả gốc và bản kiểm kê nằm trong `.qa-perfume/product-descriptions-2026-11-01/`, không đóng gói vào giao diện công khai.

## Kiểm tra

Kiểm thử parser, loại quảng bá, đủ 2.324 mã sản phẩm, định dạng bài viết, phủ nguồn bổ sung, thay nội dung chủ cửa hàng, chống ghi vào bản ghi đã xóa và chống thay nhầm phiên bản. Kiểm tra hiển thị bài viết ở trang sản phẩm, khả năng mở lại trong trình soạn thảo và bố cục điện thoại bằng dữ liệu thật, không ghi dữ liệu trong phiên trình duyệt.
