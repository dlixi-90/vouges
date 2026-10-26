import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const About = () => {
  const { hash, key } = useLocation();

  useEffect(() => {
    if (hash === "#cau-chuyen") {
      document.getElementById("cau-chuyen")?.scrollIntoView({ block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [hash, key]);

  return (
    <div className="inessa-about">
      <header className="inessa-about-hero" aria-labelledby="about-title">
        <img src="/images/inessa/bg-11.webp" alt="Khung cảnh cửa hàng và ánh đèn trên con phố về đêm" width="1920" height="700" fetchPriority="high" />
        <div className="max-padd-container inessa-about-hero-copy">
          <p className="inessa-eyebrow">Một chút về Velours</p>
          <h1 id="about-title">Về chúng tôi</h1>
        </div>
      </header>

      <section className="max-padd-container inessa-about-intro" aria-labelledby="about-intro-title">
        <p className="inessa-eyebrow">Chúng tôi là ai</p>
        <h2 id="about-intro-title">Một không gian dành cho hương thơm và vẻ đẹp của riêng bạn.</h2>
        <p>Velours là nơi bạn khám phá những mùi hương phù hợp với phong cách và nhu cầu của mình. Mỗi chai nước hoa mở ra một câu chuyện, từ những nốt hương đầu tiên đến dư âm trên da. Chúng tôi tin rằng lựa chọn hương thơm bắt đầu khi bạn cảm thấy thoải mái và tự tin với chính mình.</p>
      </section>

      <figure className="max-padd-container inessa-about-wide-photo">
        <img src="/images/inessa/bg-14.webp" alt="Một khoảnh khắc khám phá hương nước hoa yêu thích" width="1360" height="600" loading="lazy" />
      </figure>

      <section className="max-padd-container inessa-about-companion" aria-labelledby="about-companion-title">
        <p className="inessa-eyebrow">Như một người bạn</p>
        <h2 id="about-companion-title">Đồng hành cùng những khoảnh khắc rất riêng.</h2>
        <div className="inessa-about-prose">
          <p>Một mùi hương gợi nhớ, một chai nước hoa yêu thích, hay vài phút dành cho bản thân giữa ngày bận rộn — những điều nhỏ ấy làm nên cảm giác khác biệt. Velours mong muốn cùng bạn tìm thấy niềm vui khi khám phá hương thơm, để mỗi ngày đều có một chút tinh tế và cảm hứng.</p>
          <p>Chúng tôi hiểu rằng mỗi người có một sở thích và nhu cầu khác nhau. Vì vậy, trải nghiệm tại Velours được xây dựng để bạn có thể tìm hiểu sản phẩm, lựa chọn dung tích, nhận tư vấn và theo dõi đơn hàng một cách thuận tiện. Khi cần thêm thông tin, bạn luôn có thể trò chuyện với trợ lý hoặc liên hệ với đội ngũ hỗ trợ của Velours.</p>
        </div>
      </section>

      <div className="inessa-about-panorama">
        <img src="/images/inessa/bg-13.webp" alt="Chai nước hoa trên nền đá hồng dịu nhẹ" width="1920" height="1080" loading="lazy" />
      </div>

      <div className="max-padd-container inessa-about-stories">
        <section id="cau-chuyen" className="inessa-about-story" aria-labelledby="about-story-title">
          <div className="inessa-about-story-photo">
            <img src="/images/inessa/bg-12.webp" alt="Bộ ảnh chân dung đen trắng gợi nhắc những câu chuyện và ký ức" width="680" height="680" loading="lazy" />
          </div>
          <div className="inessa-about-story-copy">
            <p className="inessa-eyebrow">Câu chuyện Velours</p>
            <h2 id="about-story-title">Từ những<br /><em>điều tinh tế.</em></h2>
            <p>Velours được xây dựng quanh một ý tưởng đơn giản: chăm sóc bản thân có thể bắt đầu từ những điều rất nhỏ. Một sản phẩm phù hợp, một hương thơm yêu thích, một lựa chọn khiến bạn thấy tự tin hơn — đó là những điều chúng tôi muốn cùng bạn khám phá.</p>
            <Link to="/collection" className="inessa-button">Khám phá bộ sưu tập</Link>
          </div>
        </section>

        <section className="inessa-about-story inessa-about-story-reverse" aria-labelledby="about-mission-title">
          <div className="inessa-about-story-copy">
            <p className="inessa-eyebrow">Điều chúng tôi hướng đến</p>
            <h2 id="about-mission-title">Để vẻ đẹp<br /><em>là chính bạn.</em></h2>
            <p>Chúng tôi mong muốn việc lựa chọn sản phẩm làm đẹp trở nên gần gũi và dễ dàng hơn. Thông tin rõ ràng, sự hỗ trợ khi bạn cần và cảm hứng từ những điều bình dị sẽ giúp bạn xây dựng thói quen chăm sóc phù hợp với chính mình.</p>
            <Link to="/contact" className="inessa-button">Liên hệ với Velours</Link>
          </div>
          <div className="inessa-about-story-photo">
            <img src="/images/inessa/bg-15.webp" alt="Những chai nước hoa mini với thiết kế cổ điển" width="680" height="680" loading="lazy" />
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
