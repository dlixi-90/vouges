import { assets } from "../assets/data";

export default function Contact() {
  return (
    <div className="net-contact bg-primary py-28">
      <form className="flex flex-col items-center text-sm text-slate-800">
        <p className="text-xs bg-black/80 text-white font-medium px-3 py-1 rounded-full">
          Liên hệ với chúng tôi
        </p>
        <h1 className="text-4xl font-bold py-4 text-center">
          Kết nối với chúng tôi
        </h1>
        <p className="max-md:text-sm text-gray-500 pb-10 text-center">
          Bạn cũng có thể liên hệ trực tiếp qua{" "}
          <a href="#" className="text-secondary hover:underline">
            hello@velours.com
          </a>
        </p>

        <div className="max-w-96 w-full px-4">
          <label htmlFor="name" className="font-medium">
            Họ và tên
          </label>
          <div className="net-field-shell flex items-center mt-2 mb-4 h-10 pl-3 border border-slate-300 bg-secondary/10 rounded-full focus-within:ring-2 focus-within:ring-black/80 transition-all overflow-hidden">
            <img src={assets.user} alt="" width={19} className="invert-50" />
            <input
              type="text"
              className="h-full px-2 w-full outline-none"
              placeholder="Nhập họ và tên của bạn"
              required
            />
          </div>

          <label htmlFor="email-address" className="font-medium mt-4">
            Địa chỉ thư điện tử
          </label>
          <div className="net-field-shell flex items-center mt-2 mb-4 h-10 pl-3 border border-slate-300 bg-secondary/10 rounded-full focus-within:ring-2 focus-within:ring-black/80 transition-all overflow-hidden">
            <img src={assets.mail} alt="" width={18} className="invert-50" />
            <input
              type="email"
              className="h-full px-2 w-full outline-none"
              placeholder="Nhập địa chỉ thư điện tử của bạn"
              required
            />
          </div>

          <label htmlFor="message" className="font-medium mt-4">
            Tin nhắn
          </label>
          <textarea
            rows="4"
            className="w-full mt-2 p-2 border border-slate-300 bg-secondary/10 rounded-lg resize-none outline-none focus:ring-2 focus-within:ring-black/80 transition-all"
            placeholder="Nhập nội dung tin nhắn"
            required
          ></textarea>

          <button
            type="submit"
            className="flexCenter gap-1 mt-5 btn-secondary w-full !font-bold"
          >
            Gửi tin nhắn
            <img src={assets.right} alt="" className="invert" />
          </button>
        </div>
      </form>
    </div>
  );
}
