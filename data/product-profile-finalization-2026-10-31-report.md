# Hoàn thiện 14 hồ sơ còn lại — 31/10/2026

Đã áp dụng vào database `vouges`, đối chiếu lại lúc **22:41 ngày 31/10/2026 (UTC+7)**.

- Hoàn thiện **14/14** hồ sơ cuối; tổng đợt rà soát **310/310** hồ sơ đã xử lý.
- Kiểm tra lại cả **2.324 sản phẩm đang hiển thị**: **0 hồ sơ còn cờ cần xem**, đồng thời tính lại các tiêu chí chất lượng cũng không còn thiếu trường bắt buộc.
- Có **2.283 sản phẩm đặt được**, **41 sản phẩm chưa đặt được do cấu hình kho**, tách biệt với chất lượng hồ sơ.
- Bổ sung 6 dung tích bán lẻ từ nguồn khác; không khôi phục dung tích Test. Toàn catalog còn **0 dung tích có hậu tố Test/Tester**.
- Chỉ tạo kho ngẫu nhiên cho **hai sản phẩm người dùng đã chỉ định**. Các giá hợp lệ, lượng kho khác, ảnh đã xử lý, bài mô tả, giỏ hàng, đơn hàng và bản ghi nguồn gốc được giữ nguyên.

## Giá, dung tích và nguồn đối chiếu

Giá dưới đây là giá tham khảo đưa vào catalog, không phải xác nhận kho của nhà cung cấp. Những dung tích không được người dùng yêu cầu tạo kho vẫn giữ số lượng 0 và tắt đặt hàng.

| ID nguồn | Sản phẩm / dung tích được bổ sung | Giá VND | Kho sau cập nhật | Nguồn giá |
| --- | --- | ---: | ---: | --- |
| 38166 | Amouage Royal Tobacco EDP 100ml bán lẻ | 4.290.000 | 0 | [Kinperfume](https://kinperfume.com/san-pham/amouage-royal-tobacco/), đối chiếu dung tích với [VMIA](https://vmiaperfume.vn/products/amouage-opus-xiv-royal-tobacco) |
| 33606 | Jimmy Choo Illicit EDP 100ml bán lẻ | 2.850.000 | 0 | [The Perfume](https://theperfume.vn/nuoc-hoa/nuoc-hoa-jimmy-choo-illicit-eau-de-parfum-100ml/), đối chiếu [The Perfume Store](https://theperfumestore.vn/san-pham/jimmy-choo-illicit-100ml) |
| 33753 | Jimmy Choo Illicit Flower EDT 100ml bán lẻ | 2.550.000 | 0 | [The Perfume](https://theperfume.vn/nuoc-hoa/nuoc-hoa-jimmy-choo-illicit-flower-eau-de-toilette-100ml/), đối chiếu [Vua Hàng Hiệu](https://vuahanghieu.com/nuoc-hoa-nu-jimmy-choo-illicit-flower-edt-100ml-ph057954) |
| 33613 | Jimmy Choo Man Intense EDT 100ml bán lẻ | 1.620.000 | 0 | [Vua Hàng Hiệu](https://vuahanghieu.com/nuoc-hoa-nam-jimmy-choo-man-intense-edt-100ml-ph117055), đối chiếu nhận dạng với [Jimmy Choo](https://us.jimmychoo.com/en/men/fragrance/) |
| 34840 | Tom Ford Santal Blush EDP 50ml bán lẻ | 7.500.000 | 0 | [Tiến Perfume](https://tienperfume.vn/san-pham/tom-ford-santal-blush-edp-50ml/), đối chiếu [Vua Hàng Hiệu](https://vuahanghieu.com/nuoc-hoa-nu-tom-ford-santal-blush-edp-50ml-ph028370) |
| 32950 | Clive Christian V for Men EDP 50ml, bản 2012 | 7.200.000 | **25, ngẫu nhiên theo yêu cầu** | [Perfume Trader](https://www.perfumetrader.de/en/clive-christian-v-for-men-eau-de-parfum-50-ml): giá niêm yết cũ 243,90 EUR, nguồn không còn hàng; EAN 652638004631. Không dùng dữ liệu bản V Amber Fougere 2017. |
| 47416 | Zara 03 Caipirissima EDT **100ml không hộp** | 1.300.000 | **13, ngẫu nhiên theo yêu cầu** | [eBay](https://www.ebay.com/itm/156508293181): 49,95 USD, chai mới không hộp. Đổi nhãn lựa chọn để tình trạng không hộp hiển thị rõ. |
| 25232 | Le Labo Ylang 49 EDP chiết 10ml | 790.000 | 0 | [Vita Perfume](https://vitaperfume.com/%5Bchiet-10ml%5D-le-labo-ylang-49-eau-de-parfum.html), đối chiếu [Kai Perfume](https://kaiperfume.net/le-labo-ylang-49). Giữ nguyên giá và kho của chai 50ml/100ml. |
| 47423 | Zara Man Silver EDT 100ml | 550.000 | 0 | [petitchou.fr trên Shopee](https://shopee.vn/N%C6%B0%E1%BB%9Bc-hoa-zara-Man-silver-100ml-i.16854851.725490394), đối chiếu [Yody](https://yody.vn/post/nuoc-hoa-zara-nam). Nguồn bán đã hết hàng. |
| 48376 | Zara Vibrant Leather EDP 100ml | 899.000 | 0 | [Zara Việt Nam](https://www.zara.com/vn/vi/nuoc-hoa-vibrant-leather-edp-100-ml--3-38-fl-oz--p20210721.html), mã 0210/721/999 |
| 48376 | Zara Vibrant Leather EDP chiết 10ml | 470.000 | 0 | [Coolpriser](https://www.coolpriser.nl/shop/zara-vibrant-leather-2851920p.html): 15,95 EUR cho mẫu 10ml, quy đổi và làm tròn 10.000₫. Không lấy khoảng giá 199.000–699.000₫ của một trang nhiều dung tích làm giá chính xác cho 10ml. |

Quy đổi dùng tỷ giá bán tham khảo từ [XML công khai của Vietcombank](https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx), lấy lúc 22:32 ngày 31/10/2026: **1 EUR = 29.625,48 VND**, **1 USD = 25.990 VND**. Clive Christian và Caipirissima làm tròn đến 100.000₫ theo yêu cầu số tròn. Chưa cộng vận chuyển, thuế nhập khẩu hoặc phí dịch vụ. Tồn kho 25/13 là dữ liệu tạo ngẫu nhiên trong khoảng 1–30, không phải số kho do các nguồn công bố.

## Hồ sơ hương và thành phần set

- **32107 — House of Sillage The Batman Vengeance 2022:** bổ sung nồng độ **Parfum** sau đối chiếu đúng bản Vengeance 75ml ở [Sillage Perfume](https://sillage-perfume.ru/the-batman-vengeance), [Hoolly](https://hoolly.ru/brands/house-of-sillage) và [thư viện Parfumerie](https://parfumerie.com/library/brands/house-of-sillage?page=3). Không dùng thông tin Batman 85th Anniversary hay các trang có nội dung tự động mâu thuẫn.
- **38744 — Set Nữ Doanh Nhân:** xác nhận **Another 13 EDP + Baccarat Rouge 540 Extrait + Good Girl Gone Bad EDP**, mỗi chai chiết 10ml. [Ảnh nhãn ba chai của nguồn](https://apaniche.vn/wp-content/uploads/2024/09/Set-Nu-Doanh-Nhan-Le-Labo-13-MFK-540-Ex-Ran-trang-W-can-min.png), [ảnh riêng Another 13](https://apaniche.vn/wp-content/uploads/2024/09/Chiet-Le-Labo-Another-13-EDP-A13-U-10ml-min.png) và [đường dẫn sản phẩm](https://apaniche.vn/set-nuoc-hoa-nu-doanh-nhan-le-labo-13-mfk-540-extrait-ran-trang) thống nhất Another 13. Ghi rõ đoạn mở đầu nhắc Santal 33 không khớp, lưu bằng chứng giải quyết mâu thuẫn, không sửa mất bản ghi nguồn.
- **45123 — Set Quà Nam:** đủ hồ sơ cho **5 lựa chọn riêng**: Versace Man Eau Fraiche EDT, Acqua di Gio Pour Homme EDT, One Million EDT, 212 Heroes For Men EDT và Missoni Pour Homme EDP. Mỗi hồ sơ gắn đúng khóa lựa chọn đang có; giữ nguyên quà tặng, giá, kho và mã SKU. [Nguồn thành phần set](https://apaniche.vn/set-qua-tang-cho-nam).
- **45100 — Set Quà Nữ:** đủ hồ sơ cho **7 lựa chọn riêng**. Gucci có 2 Gardenia + 1 Jasmine + 1 Magnolia; MCM có 4 chai cùng mùi EDP 7ml; Narciso có Pure Musc EDP, Fleur Musc EDP, For Her EDP và For Her EDT. Các lựa chọn còn lại là Scandal EDP, White Tea EDP, Un Jardin Sur Le Nil EDT và Le Parfait Panache Pour Femme EDP. [Nguồn set](https://apaniche.vn/set-qua-tang-cho-nu), đối chiếu ảnh [Gucci](https://apaniche.vn/wp-content/uploads/2025/04/Set-qua-tang-nu-Gucci-Flora-4-Mini.png), [MCM](https://apaniche.vn/wp-content/uploads/2025/04/Set-qua-tang-cho-nu-Mini-MCM-EDP.png), [Narciso](https://apaniche.vn/wp-content/uploads/2025/04/Set-qua-nuoc-hoa-Narciso-Rodriguez-4-Mini.png).

Nốt hương của mỗi chai dùng hồ sơ catalog đã xác minh, kèm URL và ID hồ sơ đối chiếu trong manifest. Hai trang set nam/nữ hiển thị **“Mùi hương theo lựa chọn”**, chia thành từng set riêng; dữ liệu AI cũng giữ khóa lựa chọn. Bộ lọc nồng độ nhận được các nồng độ thật của từng chai và giữ kết quả của sản phẩm thông thường.

## Kiểm tra và khôi phục

- Manifest: [14 hồ sơ và bằng chứng từng trường](product-profile-finalization-2026-10-31.json).
- Trước ghi đã kiểm tra phiên bản hồ sơ, đơn QR đang chờ và giỏ hàng tham chiếu tên dung tích cũ: **0 đơn QR, 0 giỏ hàng bị ảnh hưởng**.
- Toàn bộ ghi nằm trong một transaction. Đối chiếu cả tài liệu sau ghi; 14 bản ghi `CatalogSource` gốc và các sản phẩm ngoài phạm vi được xác nhận không đổi.
- Bản sao trước cập nhật: `.backups/finalize-product-profiles-2026-10-31T15-39-36-902Z/`, gồm `products.ejson`, `catalog-sources.ejson`, `referenced-carts.ejson`, manifest và kết quả.
- Xác minh đọc lại cả catalog, tính lại tiêu chí chất lượng, thực thi bộ lọc nồng độ trên dữ liệu thật (**422 kết quả EDT**) và render nội dung set: đạt.
- Toàn bộ **472 kiểm thử server** đạt trước thay đổi bổ sung cuối cho bộ lọc; sau đó **31 kiểm thử liên quan** (có thêm một kiểm thử hồi quy cho phép gộp nồng độ) đạt. Build client và ESLint thành phần hiển thị đạt.

Ảnh nguồn, HTML, tỷ giá XML, SHA-256 và biên nhận cập nhật được lưu trong `.qa-perfume/profile-finalization-2026-10-31/`. Không ghi lại các nguồn không truy cập được thành dữ liệu đã xác minh; một số giá được đối chiếu qua nội dung công khai đã lập chỉ mục, có URL và ngày rà soát trong manifest.
