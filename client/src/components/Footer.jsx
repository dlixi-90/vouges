import { Link } from "react-router-dom";
import { assets } from "../assets/data";

const Footer = () => {
  return (
    <footer className="net-footer pt-16 xl:pt-20 w-full text-gray-500 bg-primary">
      <div className="max-padd-container">
        <div className="flex flex-wrap justify-between gap-12 md:gap-6">
          <div className="max-w-80">
            <div className="flex flex-1">
              <Link to={"/"} className="flex items-end">
                <img src={assets.logoImg} alt="Biểu trưng Velours" className="h-11" />
                <span className="bold-24 relative top-1 right-2 text-black">
                  elours
                </span>
              </Link>
            </div>
            <p className="text-sm mt-5">
              Khám phá bộ sưu tập mỹ phẩm cao cấp, giúp tôn lên vẻ đẹp tự nhiên, mang lại sự tự tin và nét thanh lịch mỗi ngày.
            </p>
            <div className="flex items-center gap-3 mt-7">
              <img src={assets.facebook} alt="" />
              <img src={assets.instagram} alt="" />
              <img src={assets.twitter} alt="" />
              <img src={assets.linkedin} alt="" />
            </div>
          </div>

          <div>
            <p className="h4 text-black/80">CÔNG TY</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li>
                <a href="#">Về chúng tôi</a>
              </li>
              <li>
                <a href="#">Tuyển dụng</a>
              </li>
              <li>
                <a href="#">Báo chí</a>
              </li>
              <li>
                <a href="#">Góc làm đẹp</a>
              </li>
              <li>
                <a href="#">Đối tác</a>
              </li>
            </ul>
          </div>

          <div>
            <p className="h4 text-black/80">HỖ TRỢ</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li>
                <a href="#">Trung tâm hỗ trợ</a>
              </li>
              <li>
                <a href="#">Thông tin an toàn</a>
              </li>
              <li>
                <a href="#">Chính sách hủy đơn</a>
              </li>
              <li>
                <a href="#">Liên hệ với chúng tôi</a>
              </li>
              <li>
                <a href="#">Hỗ trợ tiếp cận</a>
              </li>
            </ul>
          </div>

          <div className="w-full max-w-80">
            <p className="h4 text-black/80">NHẬN TIN MỚI NHẤT</p>
            <p className="mt-3 text-sm">
              Đăng ký nhận bản tin để cập nhật bí quyết làm đẹp và ưu đãi đặc biệt.
            </p>
            <div className="net-field-shell flex h-[46px] w-full items-center gap-2 overflow-hidden rounded-full border border-gray-500/30 bg-secondary/10 p-1 pl-4 mt-6">
              <input
                className="h-full min-w-0 flex-1 outline-none text-sm text-gray-500"
                aria-label="Địa chỉ thư điện tử nhận bản tin"
                placeholder="Địa chỉ thư điện tử của bạn"
                type="text"
              />
              <button type="button" className="btn-dark inline-flex h-full shrink-0 items-center justify-center whitespace-nowrap font-medium !px-4 !py-0 !text-sm">
                Đăng ký
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 items-center justify-between py-5 mt-8">
          <p>
            © {new Date().getFullYear()} <a href="#">Velours</a>. Bảo lưu mọi quyền.
          </p>
          <ul className="flex items-center gap-4">
            <li>
              <a href="#">Chính sách bảo mật</a>
            </li>
            <li>
              <a href="#">Điều khoản sử dụng</a>
            </li>
            <li>
              <a href="#">Sơ đồ trang web</a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
