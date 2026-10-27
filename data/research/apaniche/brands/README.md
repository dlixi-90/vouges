# Ảnh thương hiệu dùng trên header Velours

Thu thập ngày 27/10/2026 từ [thư viện thương hiệu Apaniche](https://apaniche.vn/thuong-hieu): 178 logo. Thương hiệu 4711 không có ô logo trong thư viện này; bổ sung logo từ header [website chính thức 4711](https://4711.com/). Tổng cộng 179 ảnh gốc, không chỉnh sửa hình hoặc sinh ảnh thay thế.

- `images.json` lưu tên, URL trang nguồn, URL ảnh nguồn và đường dẫn ảnh nội bộ.
- `client/public/images/brands/` chứa ảnh phục vụ bởi frontend.
- `server/data/brandImages.json` là bản manifest dùng khi dựng API công khai `/api/products/brands`.
- `tools/apaniche/collect-brands.mjs` tải lại thư viện và cập nhật hai manifest; không kết nối hoặc sửa database.

Dropdown chỉ hiện thương hiệu có sản phẩm công khai, không bị xóa. Hiện có 173 thương hiệu, tất cả đã có ảnh. Số sản phẩm còn hàng dùng cùng quy tắc tồn kho nguồn/tồn kho thực tế của cửa hàng; không công khai số lượng tồn kho nội bộ. Khi quản trị viên nhập ảnh vào bản ghi thương hiệu, ảnh đó được ưu tiên hơn ảnh trong manifest.

Chọn thương hiệu mở `/collection?brand=<tên>`, lọc chính xác theo tên không phân biệt hoa/thường. Tham số này có thể dùng cùng bộ lọc danh mục, giá và tìm kiếm. Dropdown xóa tìm kiếm cũ khi chuyển thương hiệu; trang bộ sưu tập hiển thị thương hiệu đang chọn và cho phép xóa bộ lọc.

Cần triển khai cả frontend (gồm ảnh tĩnh) và backend cho tính năng này. Kiểm tra tự động: `node --test tests/core/publicBrands.test.js` và `node scripts/perfumeBrowserQA.mjs --brand-menu` trong `server/`; kiểm tra trình duyệt chỉ đọc database.
