import { useLayoutEffect, useState } from "react";
import { ArrowRight, Clock, Mail, MapPin, Phone, User } from "lucide-react";
import toast from "react-hot-toast";

export default function Contact() {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Vui lòng điền đầy đủ thông tin.");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      toast.success("Cảm ơn bạn! Tin nhắn của bạn đã được gửi thành công.");
      setName("");
      setEmail("");
      setMessage("");
      setIsSubmitting(false);
    }, 400);
  };

  return (
    <div className="net-contact">
      <div className="net-contact-card">
        {/* Left Side: Boutique & Consultation Information */}
        <div className="net-contact-info-panel">
          <div>
            <p className="net-contact-eyebrow">Dịch vụ khách hàng</p>
            <h1 className="net-contact-title">Kết nối với chúng tôi</h1>
            <p className="net-contact-description">
              Đội ngũ chuyên gia tại Velours luôn sẵn sàng lắng nghe, tư vấn và hỗ trợ mọi thắc mắc của bạn.
            </p>
          </div>

          <div className="net-contact-details">
            <div className="net-contact-detail-item">
              <span className="net-contact-icon-badge">
                <MapPin size={15} aria-hidden="true" />
              </span>
              <div>
                <strong>Velours</strong>
                <p>123 ABC, Hà Nội</p>
              </div>
            </div>

            <div className="net-contact-detail-item">
              <span className="net-contact-icon-badge">
                <Phone size={15} aria-hidden="true" />
              </span>
              <div>
                <strong>Hotline hỗ trợ</strong>
                <p><a href="tel:19006868">1900 0123</a> (09:00 – 22:00)</p>
              </div>
            </div>

            <div className="net-contact-detail-item">
              <span className="net-contact-icon-badge">
                <Mail size={15} aria-hidden="true" />
              </span>
              <div>
                <strong>Email tư vấn</strong>
                <p><a href="mailto:hello@velours.com">hello@velours.com</a></p>
              </div>
            </div>

            <div className="net-contact-detail-item">
              <span className="net-contact-icon-badge">
                <Clock size={15} aria-hidden="true" />
              </span>
              <div>
                <strong>Giờ mở cửa</strong>
                <p>Thứ Hai – Chủ Nhật: 09:00 – 21:30</p>
              </div>
            </div>
          </div>

          <p className="net-contact-promise">
            Phản hồi nhanh chóng trong vòng 24 giờ làm việc.
          </p>
        </div>

        {/* Right Side: Contact Form */}
        <form onSubmit={handleSubmit} className="net-contact-form" noValidate={false}>
          <div className="net-contact-form-header">
            <h2>Gửi lời nhắn</h2>
            <p>Điền thông tin bên dưới để gửi tin nhắn đến đội ngũ CSKH.</p>
          </div>

          <div className="net-contact-fields">
            <div className="net-contact-field">
              <label htmlFor="contact-name" className="net-contact-label">
                Họ và tên
              </label>
              <div className="net-contact-input-shell">
                <User size={15} className="text-neutral-400 shrink-0" aria-hidden="true" />
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="net-contact-input"
                  placeholder="Nhập họ và tên của bạn"
                  required
                />
              </div>
            </div>

            <div className="net-contact-field">
              <label htmlFor="contact-email" className="net-contact-label">
                Địa chỉ email
              </label>
              <div className="net-contact-input-shell">
                <Mail size={15} className="text-neutral-400 shrink-0" aria-hidden="true" />
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="net-contact-input"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="net-contact-field">
              <label htmlFor="contact-message" className="net-contact-label">
                Tin nhắn
              </label>
              <textarea
                id="contact-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="net-contact-textarea"
                placeholder="Nội dung cần tư vấn hoặc hỗ trợ..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="net-contact-submit"
            >
              <span>{isSubmitting ? "Đang gửi..." : "Gửi tin nhắn"}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
