import { assets } from "../assets/data";

const Testimonial = () => {
  const cardsData = [
    {
      image: assets.user1,
      name: "Briar Martin",
      handle: "@neilstellar",
      date: "20 tháng 4, 2026",
      review:
        "Mình thích sự chỉn chu của Velours, từ hình ảnh đến cách giới thiệu sản phẩm. Mọi thứ đều nhẹ nhàng, tinh tế và tạo cảm giác muốn khám phá thêm.",
    },
    {
      image: assets.user2,
      name: "Avery Johnson",
      handle: "@averywrites",
      date: "10 tháng 5, 2026",
      review:
        "Velours có phong cách rất hợp gu của mình. Bộ sưu tập đa dạng, dễ tìm hiểu và mang đến nhiều gợi ý cho việc chăm sóc bản thân mỗi ngày.",
    },
    {
      image: assets.user3,
      name: "Jordan Lee",
      handle: "@jordantalks",
      date: "5 tháng 6, 2026",
      review:
        "Điều khiến mình nhớ đến Velours là vẻ đẹp tối giản và thanh lịch. Mỗi lần xem bộ sưu tập, mình lại có thêm cảm hứng để chăm chút cho bản thân.",
    },
    {
      image: assets.user4,
      name: "Avery Johnson",
      handle: "@averywrites",
      date: "10 tháng 5, 2026",
      review:
        "Mình yêu cách Velours tôn vinh vẻ đẹp tự nhiên. Thông tin sản phẩm rõ ràng, cách trình bày gần gũi khiến việc lựa chọn mỹ phẩm trở nên dễ dàng hơn.",
    },
  ];

  const CreateCard = ({ card }) => (
    <div className="flex flex-col p-4 rounded-lg mx-4 shadow hover:shadow-lg transition-all duration-200 w-72 shrink-0">
      <div className="flex gap-2">
        <img
          className="size-11 rounded-full"
          src={card.image}
          loading="lazy"
          decoding="async"
          alt="Ảnh đại diện người dùng"
        />
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <p>{card.name}</p>
            <img src={assets.badge} alt="" width={15} />
          </div>
          <span className="text-xs text-slate-500">{card.handle}</span>
        </div>
      </div>
      <p className="flex-1 text-sm py-4 text-gray-800">
        {card.review}
      </p>
      <div className="flex items-center justify-between text-slate-500 text-xs">
        <div className="flex items-center gap-1">
          <span>Đăng trên</span>
          <a
            href="https://x.com"
            target="_blank"
            className="hover:text-sky-500"
          >
            <img src={assets.twitter} alt="" width={16} />
          </a>
        </div>
        <p>{card.date}</p>
      </div>
    </div>
  );

  return (
    <section className="net-testimonials max-padd-container py-16 xl:py-22">
      <>
        <style>{`
            @keyframes marqueeScroll {
                0% { transform: translateX(0%); }
                100% { transform: translateX(-50%); }
            }

            .marquee-inner {
                animation: marqueeScroll 25s linear infinite;
            }

            .marquee-reverse {
                animation-direction: reverse;
            }
        `}</style>

        <div className="marquee-row overflow-hidden relative">
          <div className="absolute left-0 top-0 h-full w-20 z-10 pointer-events-none bg-gradient-to-r from-white to-transparent"></div>
          <div className="marquee-inner flex transform-gpu min-w-[200%] pt-10 pb-5">
            {[...cardsData, ...cardsData].map((card, index) => (
              <CreateCard key={index} card={card} />
            ))}
          </div>
          <div className="absolute right-0 top-0 h-full w-20 md:w-40 z-10 pointer-events-none bg-gradient-to-l from-white to-transparent"></div>
        </div>

        <div className="marquee-row overflow-hidden relative">
          <div className="absolute left-0 top-0 h-full w-20 z-10 pointer-events-none bg-gradient-to-r from-white to-transparent"></div>
          <div className="marquee-inner marquee-reverse flex transform-gpu min-w-[200%] pt-10 pb-5">
            {[...cardsData, ...cardsData].map((card, index) => (
              <CreateCard key={index} card={card} />
            ))}
          </div>
          <div className="absolute right-0 top-0 h-full w-20 md:w-40 z-10 pointer-events-none bg-gradient-to-l from-white to-transparent"></div>
        </div>
      </>
    </section>
  );
};

export default Testimonial;
