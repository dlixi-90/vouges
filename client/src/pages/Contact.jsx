import { useState } from "react";
import { ArrowRight, Mail, User } from "lucide-react";
import toast from "react-hot-toast";

export default function Contact() {
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
      <form onSubmit={handleSubmit} className="net-contact-form" noValidate={false}>
        <p className="net-contact-eyebrow">
          Liên hệ với chúng tôi
        </p>
        <h1 className="net-contact-title">
          Kết nối với chúng tôi
        </h1>
        <p className="net-contact-subtitle">
          Bạn cũng có thể liên hệ trực tiếp qua{" "}
          <a href="mailto:hello@velours.com">
            hello@velours.com
          </a>
        </p>

        <div className="net-contact-fields">
          <div className="net-contact-field">
            <label htmlFor="contact-name" className="net-contact-label">
              Họ và tên
            </label>
            <div className="net-contact-input-shell">
              <User size={16} className="text-neutral-400 shrink-0" aria-hidden="true" />
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
              <Mail size={16} className="text-neutral-400 shrink-0" aria-hidden="true" />
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="net-contact-input"
                placeholder="Nhập địa chỉ email của bạn"
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
              placeholder="Nhập nội dung tin nhắn của bạn..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="net-contact-submit"
          >
            <span>{isSubmitting ? "Đang gửi..." : "Gửi tin nhắn"}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
