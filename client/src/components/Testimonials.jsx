import { assets } from "../assets/data";

const Testimonial = () => {
  const cardsData = [
    {
      image: assets.user1,
      name: "Briar Martin",
      handle: "@neilstellar",
      date: "20 tháng 4, 2026",
      review:
        "Velours chỉn chu, tinh tế và tạo cảm giác rất dễ chịu.",
    },
    {
      image: assets.user2,
      name: "Avery Johnson",
      handle: "@averywrites",
      date: "10 tháng 5, 2026",
      review:
        "Bộ sưu tập của Velours đa dạng và rất hợp gu mình.",
    },
    {
      image: assets.user3,
      name: "Jordan Lee",
      handle: "@jordantalks",
      date: "5 tháng 6, 2026",
      review:
        "Mình thích nét tối giản, thanh lịch của Velours.",
    },
    {
      image: assets.user4,
      name: "Avery Johnson",
      handle: "@averywrites",
      date: "10 tháng 5, 2026",
      review:
        "Thông tin rõ ràng giúp mình dễ chọn mỹ phẩm phù hợp.",
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
      <p className="flex-1 text-sm py-3 text-gray-800">
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
    <section className="net-testimonials max-padd-container">
      <>
        <style>{`
            @keyframes marqueeScroll {
                0% { transform: translateX(0%); }
                100% { transform: translateX(-50%); }
            }

            .marquee-inner {
                animation: marqueeScroll 25s linear infinite;
            }

        `}</style>

        <div className="marquee-row overflow-hidden relative">
          <div className="absolute left-0 top-0 h-full w-20 z-10 pointer-events-none bg-gradient-to-r from-white to-transparent"></div>
          <div className="marquee-inner flex transform-gpu min-w-[200%] py-2">
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
