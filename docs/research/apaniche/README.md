# Khảo sát Apaniche và hướng áp dụng cho Velours

Ngày khảo sát: **26/10/2026**, múi giờ Asia/Bangkok.

Cập nhật **29/10/2026**: đã xác minh quan hệ số học của thanh lưu/tỏa hương và phân biệt với nguồn gốc bình chọn còn chưa rõ. Xem [Xác minh biểu đồ lưu hương và tỏa hương](ASSESSMENT_METHOD.md).

Đã đọc các nhóm trang công khai, quan sát bằng Chrome ở 1440 × 1000 và trang chủ ở 390 × 844, kiểm tra HTML/DOM và thống kê toàn bộ sitemap được công bố. Đây là khảo sát sản phẩm, giao diện và nội dung; không phải quyền truy cập hệ quản trị hoặc cơ sở dữ liệu của Apaniche. Chưa đặt đơn, thanh toán hoặc kiểm chứng vận hành nội bộ.

## 1. Quy mô nội dung được lập danh mục

Sitemap công bố **4.364 URL khác nhau**, phân thành 11 tệp. Đây là số URL tại thời điểm đọc, không phải xác nhận từng trang còn hàng, hoạt động hoặc được Google lập chỉ mục. [Sitemap gốc](https://apaniche.vn/sitemap_index.xml).

| Nhóm URL | Số lượng | Nguồn |
| --- | ---: | --- |
| Sản phẩm | 2.444 | Ba tệp product-sitemap |
| Bài viết | 184 | post-sitemap |
| Trang nội dung/chức năng | 31 | page-sitemap |
| Danh mục sản phẩm | 646 | product_cat-sitemap |
| Thành phần/note hương | 950 | note_huong-sitemap |
| Nhóm hương | 31 | nhom_huong-sitemap |
| Kiểu mùi | 68 | thu_vien_mui_huong-sitemap |
| Chuyên mục bài viết | 5 | category-sitemap |
| Tác giả | 5 | author-sitemap |

Danh sách đầy đủ: [sitemap-inventory.csv](./sitemap-inventory.csv). Mỗi dòng có sitemap nguồn, URL và ngày cập nhật do website công bố. Số đếm: [sitemap-summary.json](./sitemap-summary.json). Chưa tải và đọc toàn văn cả 4.364 trang.

## 2. Bản đồ trải nghiệm

| Nhu cầu khách hàng | Nhóm trang đã khảo sát | Vai trò |
| --- | --- | --- |
| Khám phá cửa hàng | [Trang chủ](https://apaniche.vn/) | Điều hướng, chiến dịch và nhận diện |
| Mua theo đối tượng | [Danh mục nam](https://apaniche.vn/nuoc-hoa-nam), [nữ](https://apaniche.vn/nuoc-hoa-nu) | Thu hẹp sản phẩm |
| Mua theo hãng | [Thương hiệu](https://apaniche.vn/thuong-hieu), [Bvlgari](https://apaniche.vn/nuoc-hoa-bvlgari) | Đi từ hãng tới sản phẩm |
| Hiểu sản phẩm | [Creed Aventus](https://apaniche.vn/creed-aventus-edp), [Versace Pour Homme](https://apaniche.vn/versace-pour-homme-edt) | Đánh giá độ phù hợp và chọn biến thể |
| Cân nhắc nhiều lựa chọn | [So sánh](https://apaniche.vn/so-sanh) | Đối chiếu thuộc tính |
| Tìm ưu đãi | [Voucher](https://apaniche.vn/ma-giam-gia) | Chọn mã trước khi mua |
| Học về hương thơm | [Nhóm hương](https://apaniche.vn/thu-vien-nhom-huong), [kiểu gỗ](https://apaniche.vn/mui-huong-go) | Giải thích thuật ngữ, dẫn tới khám phá |
| Đọc tư vấn | [Review](https://apaniche.vn/review), [FAQ](https://apaniche.vn/cau-hoi-thuong-gap) | Giải đáp trước khi quyết định |
| Xác minh cửa hàng | [Giới thiệu](https://apaniche.vn/gioi-thieu-ve-apa-niche) | Thông tin doanh nghiệp |
| Xem điều kiện mua | Các chính sách ở phần 7 | Thanh toán, giao nhận và hậu mãi |

Luồng tham khảo để thiết kế cho Velours: **nhu cầu → danh mục/tìm kiếm → lọc → chi tiết → chọn dung tích → giỏ → thanh toán → tổng quan đơn**. Đây là mô hình đề xuất của báo cáo, không phải khẳng định đã đi hết checkout Apaniche.

## 3. Ngôn ngữ giao diện

Quan sát trực tiếp: nền sáng, thanh thông tin trên cùng màu tối, logo nằm giữa dãy điều hướng, điểm nhấn đỏ, font SVN-Gilroy. Banner có phiên bản riêng cho điện thoại; mobile có thanh thao tác cố định phía dưới. Bố cục thiên về cung cấp nhiều lựa chọn và thông tin bán hàng. [Trang chủ](https://apaniche.vn/).

Ảnh khảo sát: [desktop](./home-desktop.png), [mobile](./home-mobile.png).

**Nhận định cho Velours:** phù hợp tham khảo cách phân cấp thông tin và vị trí thao tác. Velours hiện dùng tiêu đề serif và khoảng trắng rộng hơn; có thể bổ sung chức năng mà vẫn giữ nhận diện đó. Màu đỏ nên dành cho giá khuyến mại, trạng thái hoặc một hành động chính, tránh cùng lúc làm nổi bật quá nhiều vị trí.

## 4. Danh mục và tìm sản phẩm

Ở desktop, trang danh mục có bộ lọc bên trái và lưới bốn cột. Có sắp xếp, phân trang và trạng thái bộ lọc. Các thuộc tính lọc bao phủ đối tượng sử dụng, dạng hàng, hãng, ngân sách, dung tích, thời gian bám mùi, phạm vi tỏa, mùa và nguyên liệu hương. Thẻ có ảnh, tên, giá hoặc khoảng giá, thêm giỏ và so sánh. [Danh mục nam](https://apaniche.vn/nuoc-hoa-nam).

Ảnh khảo sát: [collection-desktop.png](./collection-desktop.png).

**Đề xuất riêng cho Velours:**

- Giữ bộ lọc trượt hiện tại trên mobile; desktop có thể cho chọn sidebar khi danh mục đủ lớn.
- Hiển thị những điều kiện đang áp dụng và cho xóa từng điều kiện.
- Lưu bộ lọc, trang và cách sắp xếp vào URL để chia sẻ và quay lại được.
- Chỉ đưa thuộc tính có dữ liệu thực vào bộ lọc. Với mỹ phẩm/chăm sóc tóc, ưu tiên vấn đề cần giải quyết và loại da/tóc thay cho các đặc tính nước hoa.
- Tìm kiếm nên bao gồm tên sản phẩm, hãng và loại; có trạng thái không tìm thấy cùng gợi ý bỏ bớt điều kiện.

Chưa kiểm chứng độ chính xác của toàn bộ kết quả lọc, cách tính thứ tự bán chạy hoặc tìm kiếm gợi ý trực tiếp.

## 5. Trang sản phẩm và biến thể

Trang Creed đặt bộ ảnh cạnh phần chọn mua và bảng đặc tính. Bên dưới là nội dung giải thích, mục lục, người viết/người duyệt, đánh giá và các lựa chọn liên quan. Có hai hướng thao tác: đưa vào giỏ hoặc chuyển sang mua. Đây là cách kết hợp nội dung tư vấn với thương mại trên cùng trang. [Creed Aventus](https://apaniche.vn/creed-aventus-edp).

Trang Versace dùng các ô dung tích có thumbnail. Dữ liệu biến thể trong HTML chứa giá, trạng thái bán và ảnh riêng; mẫu kiểm tra có ảnh tester khác, trong khi nhiều dung tích dùng lại cùng ảnh. Có biểu đồ đặc điểm mùi, bám/tỏa hương và gợi ý thời điểm sử dụng. [Versace Pour Homme](https://apaniche.vn/versace-pour-homme-edt).

Ảnh khảo sát: [product-desktop.png](./product-desktop.png). Dữ liệu cấu trúc đã rút gọn: [observations.json](./observations.json).

**Áp dụng cho tính năng vừa thêm ở Velours:**

- `images` tiếp tục là bộ ảnh chung và ảnh dùng trên danh sách.
- `sizeImages[size]` dành cho ảnh dung tích; có thể dùng thumbnail đó ngay trong nút chọn size.
- Khi đổi size, đồng bộ ảnh, giá, tồn kho và giới hạn số lượng.
- Chưa có ảnh riêng thì dùng ảnh chung; không ép tải ảnh trùng lặp.
- Giỏ và checkout theo size; đơn đã tạo giữ ảnh chụp dữ liệu lúc mua.

Các thanh tỷ lệ, số phiếu hoặc nhận xét chuyên gia chỉ nên xuất hiện khi có nguồn dữ liệu được quản lý. Chưa xác minh nguồn hoặc cách tổng hợp số liệu biểu đồ trên Apaniche.

## 6. So sánh và ưu đãi

[Trang so sánh](https://apaniche.vn/so-sanh) có ô tìm sản phẩm và bảng đối chiếu theo thuộc tính. Trong phiên chưa chọn sản phẩm, bảng vẫn chiếm phần lớn màn hình. Chưa kiểm thử thêm/xóa nhiều sản phẩm hoặc tính bền vững của danh sách qua các phiên. [Ảnh trạng thái trống](./compare-desktop.png).

[Trang voucher](https://apaniche.vn/ma-giam-gia) có phân loại ưu đãi, tìm mã, thứ tự hiển thị và thẻ chứa điều kiện cùng thao tác sao chép/sử dụng. Ở ảnh chụp ngày 26/10, banner chiến dịch vẫn mang khoảng thời gian kết thúc 20/10/2026; không có nghĩa mọi mã bên dưới đã hết hạn. [Ảnh khảo sát](./coupon-desktop.png).

**Đề xuất cho Velours:** so sánh tối đa 3–4 sản phẩm, ưu tiên hiển thị điểm khác biệt và cho bỏ từng sản phẩm. Khi chưa chọn, dùng lời hướng dẫn ngắn thay cho bảng dài. Voucher phải được backend xác minh; banner nên có lịch tự kết thúc riêng với thời hạn của từng mã.

## 7. Giỏ hàng, thanh toán và chính sách

Mở `/checkout` trong phiên giỏ rỗng chuyển về trang chủ. Vì chưa thêm hàng và không đặt đơn, báo cáo **không xác nhận** bố cục checkout có hàng, phí giao hàng thực tế, kết quả áp mã, cổng thanh toán hoặc trang thành công sau giao dịch. [Điểm vào checkout](https://apaniche.vn/checkout).

Các trang công khai cung cấp thông tin sau:

| Chính sách | Nội dung quan sát được | Giới hạn xác minh |
| --- | --- | --- |
| [Thanh toán](https://apaniche.vn/chinh-sach-thanh-toan) | Mua trực tiếp, trả khi nhận và chuyển khoản trước | Thông tin công bố, chưa thực hiện giao dịch |
| [Vận chuyển](https://apaniche.vn/chinh-sach-van-chuyen-giao-nhan-kiem-hang) | Thời gian dự kiến, thông báo cước, đóng gói và kiểm hàng | Không suy ra mức phí của checkout |
| [Đổi trả](https://apaniche.vn/chinh-sach-doi-hang-tra-hang-hoan-tien) | Mốc 10 ngày cùng điều kiện chấp nhận/từ chối, chứng từ cần có | Không kiểm chứng việc giải quyết thực tế |
| [Cam kết](https://apaniche.vn/cam-ket-bao-hanh-cua-chung-toi) | Công bố nguồn gốc và bảo hành | Là tuyên bố của cửa hàng |
| [Bảo mật](https://apaniche.vn/chinh-sach-bao-mat-thong-tin) | Nêu phạm vi thu thập, sử dụng và yêu cầu chỉnh sửa thông tin | Không chứng minh được biện pháp kỹ thuật nội bộ |

Với Velours, nên đặt liên kết chính sách gần hành động mua và tóm tắt điều kiện có liên quan. Tiếp tục dùng quy tắc COD/QR, báo giá phía server và quản lý tồn hiện tại; không lấy các điều kiện kinh doanh của cửa hàng khác làm mặc định.

## 8. Nội dung và SEO

Apaniche tổ chức riêng bài đánh giá, tư vấn, tin tức và thư viện kiến thức. [Khu review](https://apaniche.vn/review) dẫn khách vào bài theo nhu cầu; [thư viện nhóm hương](https://apaniche.vn/thu-vien-nhom-huong) giúp giải thích cách phân loại và liên kết sâu tới từng nhóm. Cấu trúc này tạo thêm đường khám phá ngoài menu bán hàng.

Trong mẫu DOM đã kiểm tra có title, meta description, canonical; danh mục có dữ liệu CollectionPage, trang sản phẩm có Product/Offer. Đây là quan sát markup, chưa phải xác nhận schema hợp lệ với Google hoặc hiệu quả xếp hạng. [Danh mục mẫu](https://apaniche.vn/nuoc-hoa-nam), [sản phẩm mẫu](https://apaniche.vn/versace-pour-homme-edt).

**Đề xuất cho Velours:** nội dung hướng dẫn nên có tác giả, thời điểm cập nhật, sản phẩm liên quan và tiêu chí lựa chọn rõ. Mỗi trang danh mục cần mô tả riêng. Chỉ xuất giá/tồn kho có thật trong dữ liệu cấu trúc; tránh tạo hàng loạt URL lọc trùng nhau để lập chỉ mục.

## 9. Công nghệ quan sát từ phía công khai

HTML và đường dẫn tài nguyên cho thấy WordPress, WooCommerce và theme Flatsome/child theme. Có dấu vết WP Rocket, Yoast, Variation Swatches; một trang còn tải tài nguyên mang tên bộ kết nối Nhanh.vn, affiliate và theo dõi. **Tên tài nguyên không xác nhận dịch vụ đang được dùng đầy đủ hoặc cấu hình đúng.** Nguồn: HTML công khai của [trang so sánh](https://apaniche.vn/so-sanh), [sitemap](https://apaniche.vn/sitemap_index.xml) và [robots](https://apaniche.vn/robots.txt).

Một lần đọc trang chủ trả HTML xấp xỉ 1,5 MB. Đây là kích thước HTML ở lần khảo sát, không phải tổng dung lượng tải, tốc độ mạng hoặc điểm Core Web Vitals. Cần phép đo riêng trước khi kết luận nhanh/chậm.

Với Velours, các chức năng tương tự có thể được làm trên React và backend hiện tại. Không cần chuyển sang WordPress để tham khảo trải nghiệm.

## 10. Điểm cần cân nhắc khi học theo

| Quan sát | Ý nghĩa thiết kế cho Velours |
| --- | --- |
| Sidebar có rất nhiều điều kiện | Gộp nhóm, thu gọn mặc định, cho tìm thuộc tính dài |
| Bảng so sánh trống vẫn cao | Thiết kế trạng thái chưa có dữ liệu trước khi dựng bảng |
| Banner có thể còn sau ngày kết thúc | Quản lý lịch chiến dịch tại dashboard |
| Mobile có thanh cố định dưới đáy | Dành khoảng đệm cho nội dung và tránh chồng launcher chat |
| DOM có một form tìm kiếm trỏ tới `localhost` | Kiểm tra đích điều hướng khi triển khai; chưa kết luận người dùng thực tế đang đi qua form đó |
| Nhiều khu vực cùng mời thao tác | Duy trì một hành động chính trong từng ngữ cảnh |

Các quan sát trên dựa vào ảnh và DOM của phiên khảo sát; không phải đánh giá bảo mật hoặc kết luận về toàn bộ khách hàng của website.

## 11. Khoảng cách với Velours và thứ tự triển khai đề xuất

Đây là đề xuất riêng, **chưa thay đổi giao diện hoặc logic ứng dụng trong lượt khảo sát này**.

| Ưu tiên | Hạng mục | Có thể tận dụng ở Velours | Phần cần bổ sung |
| --- | --- | --- | --- |
| 1 | Chọn dung tích bằng ảnh | Ảnh chung, `sizeImages`, giá và tồn theo size | Thumbnail trong nút chọn; trạng thái chọn/hết hàng rõ |
| 1 | Thông tin sản phẩm có cấu trúc | Mô tả, thành phần, danh mục, loại | Hãng, xuất xứ và đặc tính theo ngành hàng |
| 1 | Bộ lọc hữu ích | Drawer, sắp xếp và phân trang | Thuộc tính mới, điều kiện đang chọn, URL chia sẻ |
| 1 | Tìm kiếm dễ thấy | Dữ liệu catalog hiện có | Gợi ý phù hợp, trạng thái rỗng và điều hướng bàn phím |
| 2 | So sánh sản phẩm | Catalog, giá, ảnh | Danh sách so sánh và trang đối chiếu |
| 2 | Trung tâm ưu đãi | Membership và voucher phía server | Tìm mã, phân loại, hiển thị lý do chưa đủ điều kiện |
| 2 | Chính sách có ngữ cảnh | Footer, checkout | Trang chính sách hoàn chỉnh và liên kết gần nút mua |
| 3 | Nội dung tư vấn | Trang About và các khối nội dung hiện tại | Bài viết, phân loại, tác giả, quản lý xuất bản |
| 3 | Dashboard cho dữ liệu mới | Form thêm/sửa sản phẩm | Quản lý hãng, đặc tính và lịch banner |

Khi thiết kế schema bổ sung, nên tách thông tin chung của sản phẩm khỏi dữ liệu từng biến thể. Giữ `price`, `stockBySize`, `inStockBySize`, `sizeImages` hiện có; chỉ mở rộng dữ liệu mới cần cho trải nghiệm đã chọn. Thêm thuộc tính lọc trước khi thêm hàng loạt bộ lọc trên giao diện.

## 12. Tài liệu đi kèm và phạm vi còn mở

- [Danh sách 4.364 URL](./sitemap-inventory.csv).
- [Số đếm theo sitemap](./sitemap-summary.json).
- [Quan sát kỹ thuật đã rút gọn](./observations.json), [các trang bổ sung](./secondary-observations.json).
- Sáu ảnh: trang chủ desktop/mobile, danh mục, chi tiết, so sánh và voucher.

Chưa xác minh: tài khoản/thành viên thực tế, dashboard Apaniche, ERP/kho, checkout có hàng, thanh toán, giao nhận, độ chính xác của toàn bộ thông tin sản phẩm và dữ liệu đo hiệu năng. Danh mục URL giúp xác định phạm vi website; không thay thế việc kiểm thử từng URL.
