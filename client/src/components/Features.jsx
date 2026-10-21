import { assets } from "../assets/data";
import { BadgeCheck, ShieldCheck, Truck } from "lucide-react";

const Features = () => {
  return (
    <section className="net-features max-padd-container my-10 xl:my-22">
      {/* Container */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-6 gap-y-12 items-center rounded-xl">
        <div>
          <img
            src={assets.features1}
            loading="lazy"
            decoding="async"
            alt=""
            height={77}
            width={222}
            className="rounded-full"
          />
        </div>
        <div>
          <img
            src={assets.features2}
            loading="lazy"
            decoding="async"
            alt=""
            height={77}
            width={222}
            className="rounded-full"
          />
        </div>
        <div className="p-4">
          <BadgeCheck size={32} strokeWidth={1.6} className="mb-3 text-secondary" aria-hidden="true" />
          <h4 className="h4 ">Sản phẩm chất lượng</h4>
          <p>Sản phẩm làm đẹp cao cấp, được chăm chút trong từng công đoạn.</p>
        </div>
        <div className="p-4">
          <Truck size={32} strokeWidth={1.6} className="mb-3 text-secondary" aria-hidden="true" />
          <h4 className="h4 ">Giao hàng nhanh chóng</h4>
          <p>Sản phẩm làm đẹp cao cấp, được chăm chút trong từng công đoạn.</p>
        </div>
        <div className="p-4">
          <ShieldCheck size={32} strokeWidth={1.6} className="mb-3 text-secondary" aria-hidden="true" />
          <h4 className="h4 ">Thanh toán an toàn</h4>
          <p>Sản phẩm làm đẹp cao cấp, được chăm chút trong từng công đoạn.</p>
        </div>
      </div>
    </section>
  );
};

export default Features;
