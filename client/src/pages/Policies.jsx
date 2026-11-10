import { useEffect } from "react";
import { ArrowRight, CreditCard, LifeBuoy, LockKeyhole, MessageSquare } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import StorePageHeading from "../components/StorePageHeading";
import "./policies.css";

const sections = [
  {
    id: "don-hang",
    title: "Đặt hàng và thanh toán",
    Icon: CreditCard,
    action: { label: "Xem đơn hàng của tôi", to: "/my-orders" },
    content: (
      <>
        <p>
          Quý khách vui lòng kiểm tra kỹ sản phẩm, dung tích, số lượng và địa chỉ nhận hàng trước khi xác nhận đặt mua.
        </p>
        <p>
          Phí giao hàng cùng các ưu đãi mã giảm giá (nếu có) luôn được tính toán minh bạch và hiển thị rõ ràng tại bước thanh toán.
        </p>
        <p>
          Bạn có thể dễ dàng theo dõi chi tiết tiến trình xử lý và trạng thái thanh toán bất kỳ lúc nào trong{" "}
          <Link to="/my-orders">Đơn hàng của tôi</Link>.
        </p>
      </>
    ),
  },
  {
    id: "ho-tro",
    title: "Hỗ trợ đơn hàng",
    Icon: LifeBuoy,
    action: { label: "Liên hệ bộ phận CSKH", to: "/contact" },
    content: (
      <>
        <p>
          Nếu có nhu cầu điều chỉnh thông tin người nhận, thay đổi dung tích hoặc hủy đơn khi chưa giao vận, vui lòng thông báo sớm cho chúng tôi.
        </p>
        <p>
          Đối với các vấn đề về sản phẩm nhận được (vỡ nứt do vận chuyển, không đúng mô tả), xin vui lòng{" "}
          <Link to="/contact">liên hệ với Velours</Link> để được hỗ trợ kiểm tra và đổi mới nhanh chóng.
        </p>
        <p>
          Quý khách chỉ cần cung cấp mã đơn hàng tương ứng để nhân viên tư vấn tra cứu và giải quyết thuận tiện nhất.
        </p>
      </>
    ),
  },
  {
    id: "thong-tin",
    title: "Thông tin cá nhân",
    Icon: LockKeyhole,
    action: { label: "Quản lý tài khoản hội viên", to: "/membership" },
    content: (
      <>
        <p>
          Thông tin người nhận, số điện thoại và địa chỉ giao hàng bạn cung cấp chỉ được sử dụng trong suốt quá trình xử lý đơn hàng và giao vận.
        </p>
        <p>
          Velours cam kết bảo mật tuyệt đối dữ liệu khách hàng theo các tiêu chuẩn an toàn, không tiết lộ hay chuyển nhượng cho bên thứ ba.
        </p>
        <p>
          Bạn có thể chủ động cập nhật địa chỉ khi đặt hàng hoặc quản lý hồ sơ tại trang{" "}
          <Link to="/membership">Hội viên & đặc quyền</Link>.
        </p>
      </>
    ),
  },
];

export default function Policies() {
  const { hash, key } = useLocation();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Chính sách | Velours";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const section = sections.some((section) => hash === `#${section.id}`)
        ? document.getElementById(hash.slice(1))
        : null;
      if (section) {
        section.focus({ preventScroll: true });
        section.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash, key]);

  return (
    <div className="policies-page max-padd-container store-page-container">
      <StorePageHeading title="Chính sách" />
      <p className="policies-intro">
        Các cam kết và hướng dẫn minh bạch từ Velours nhằm mang đến cho bạn trải nghiệm mua sắm nước hoa an tâm, thuận tiện và chu đáo nhất.
      </p>

      <div className="policies-content">
        {sections.map(({ id, title, Icon, content, action }) => (
          <section
            key={id}
            id={id}
            tabIndex={-1}
            aria-labelledby={`${id}-title`}
            className="policies-section"
          >
            <div className="policies-section-main">
              <header className="policies-section-header">
                <span className="policies-section-icon">
                  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                </span>
                <h2 id={`${id}-title`}>{title}</h2>
              </header>

              <div className="policies-section-copy">{content}</div>
            </div>

            {action && (
              <Link to={action.to} className="policies-card-action">
                <span>{action.label}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </section>
        ))}
      </div>

      <div className="policies-callout">
        <div className="policies-callout-text">
          <h3>Bạn vẫn cần thêm thông tin hoặc hỗ trợ riêng?</h3>
          <p>
            Đội ngũ chuyên viên tư vấn mùi hương và chăm sóc khách hàng của Velours luôn sẵn sàng đồng hành cùng bạn.
          </p>
        </div>
        <Link to="/contact" className="btn-dark">
          <MessageSquare size={14} aria-hidden="true" />
          <span>Liên hệ trực tiếp</span>
        </Link>
      </div>
    </div>
  );
}
