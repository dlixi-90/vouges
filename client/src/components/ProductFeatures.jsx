import { assets } from "../assets/data";

const ProductFeatures = () => {
  return (
    <div className="mt-12 bg-primary rounded-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 rounded-xl">
        <div className="flexCenter gap-x-4 p-2 rounded-3xl">
          <div>
            <img
              src={assets.returnRequest}
              alt=""
              width={77}
              className="mb-3"
            />
          </div>
          <div>
            <h5 className="h4 mb-2">Đổi trả dễ dàng</h5>
            <p>
              Liên hệ bộ phận chăm sóc khách hàng để được hướng dẫn đổi trả.
            </p>
          </div>
        </div>

        <div className="flexCenter gap-x-4 p-2 rounded-3xl">
          <div>
            <img
              src={assets.secure}
              alt=""
              width={77}
              className="mb-3 text-blue-500"
            />
          </div>
          <div>
            <h5 className="h4 mb-2">Thanh toán an toàn</h5>
            <p>
              Lựa chọn phương thức thanh toán phù hợp khi đặt hàng.
            </p>
          </div>
        </div>

        <div className="flexCenter gap-x-4 p-2 rounded-3xl">
          <div>
            <img src={assets.delivery} alt="" width={77} className="mb-3" />
          </div>
          <div>
            <h5 className="h4 mb-2">Giao hàng nhanh chóng</h5>
            <p>
              Theo dõi tình trạng giao hàng trong mục Đơn hàng của tôi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductFeatures;
