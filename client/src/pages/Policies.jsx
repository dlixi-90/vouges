import { Link } from "react-router-dom";
import StorePageHeading from "../components/StorePageHeading";
import "./knowledge.css";

export default function Policies() {
  return <div className="knowledge-page max-padd-container"><StorePageHeading title="Chính sách" /><div className="knowledge-policy-list">
    <section id="don-hang"><h2>Đặt hàng và thanh toán</h2><p>Kiểm tra sản phẩm, dung tích, số lượng và địa chỉ trước khi xác nhận. Phí giao hàng và mã giảm giá được thể hiện tại bước thanh toán.</p><p>Bạn có thể theo dõi tình trạng xử lý và thanh toán trong <Link to="/my-orders">Đơn hàng của tôi</Link>.</p></section>
    <section id="ho-tro"><h2>Hỗ trợ đơn hàng</h2><p>Nếu cần thay đổi, hủy đơn hoặc phản ánh về sản phẩm đã nhận, vui lòng <Link to="/contact">liên hệ với Velours</Link> và cung cấp mã đơn hàng để được kiểm tra, hỗ trợ.</p></section>
    <section id="thong-tin"><h2>Thông tin cá nhân</h2><p>Thông tin người nhận và địa chỉ bạn cung cấp được dùng trong quá trình xử lý đơn hàng và giao hàng. Bạn có thể cập nhật địa chỉ khi thanh toán hoặc liên hệ để được hỗ trợ về thông tin tài khoản.</p></section>
  </div></div>;
}
