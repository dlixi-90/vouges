import { useEffect } from "react";
import { CreditCard, LifeBuoy, LockKeyhole } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import StorePageHeading from "../components/StorePageHeading";
import "./policies.css";

const sections = [
  { id: "don-hang", title: "Đặt hàng và thanh toán", Icon: CreditCard },
  { id: "ho-tro", title: "Hỗ trợ đơn hàng", Icon: LifeBuoy },
  { id: "thong-tin", title: "Thông tin cá nhân", Icon: LockKeyhole },
];

export default function Policies() {
  const { hash, key } = useLocation();
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Chính sách | Velours";
    return () => { document.title = previousTitle; };
  }, []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const section = sections.some(section => hash === `#${section.id}`) ? document.getElementById(hash.slice(1)) : null;
      if (section) {
        section.focus({ preventScroll: true });
        section.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      } else window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash, key]);

  return <div className="policies-page max-padd-container store-page-container">
    <StorePageHeading title="Chính sách" />
      <div className="policies-content">
        {sections.map(({ id, title, Icon }) => <section key={id} id={id} tabIndex={-1} aria-labelledby={`${id}-title`} className="policies-section">
          <header><span className="policies-section-icon"><Icon size={21} strokeWidth={1.5} aria-hidden="true" /></span><h2 id={`${id}-title`}>{title}</h2></header>
          <div className="policies-section-copy">
            {id === "don-hang" && <><p>Kiểm tra sản phẩm, dung tích, số lượng và địa chỉ trước khi xác nhận. Phí giao hàng và mã giảm giá được thể hiện tại bước thanh toán.</p><p>Bạn có thể theo dõi tình trạng xử lý và thanh toán trong <Link to="/my-orders">Đơn hàng của tôi</Link>.</p></>}
            {id === "ho-tro" && <p>Nếu cần thay đổi, hủy đơn hoặc phản ánh về sản phẩm đã nhận, vui lòng <Link to="/contact">liên hệ với Velours</Link> và cung cấp mã đơn hàng để được kiểm tra, hỗ trợ.</p>}
            {id === "thong-tin" && <p>Thông tin người nhận và địa chỉ bạn cung cấp được dùng trong quá trình xử lý đơn hàng và giao hàng. Bạn có thể cập nhật địa chỉ khi thanh toán hoặc liên hệ để được hỗ trợ về thông tin tài khoản.</p>}
          </div>
        </section>)}
      </div>
  </div>;
}
