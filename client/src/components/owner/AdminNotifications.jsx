import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, CheckCheck, MessageSquare, Package, Star, X } from "lucide-react";
import { notificationBadge } from "../../utils/adminNotifications";
import "./admin-notifications.css";

const timeLabel = date => new Date(date).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" });

export default function AdminNotifications({ feed }) {
  const { data, status, markRead, markAllRead, pending, error } = feed;
  const location = useLocation();
  const [openedAt, setOpenedAt] = useState(null);
  const open = openedAt === location.key;
  const root = useRef(null), trigger = useRef(null);
  const id = useId();
  const count = data?.unreadCount || 0;
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpenedAt(null); };
    const escape = event => { if (event.key === "Escape") { setOpenedAt(null); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={root} className="admin-notifications" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpenedAt(null); }}>
    <button ref={trigger} type="button" className="admin-notification" aria-expanded={open} aria-controls={id}
      aria-label={data ? `Thông báo, ${count} chưa đọc` : "Thông báo, đang kết nối"}
      onClick={() => setOpenedAt(open ? null : location.key)}>
      <Bell size={19} strokeWidth={1.6} aria-hidden="true" />
      {count > 0 && <span className="admin-notification-badge" aria-hidden="true">{notificationBadge(count)}</span>}
    </button>
    <span className="sr-only" role="status" aria-live="polite">{data ? `${count} thông báo chưa đọc` : "Đang tải thông báo"}</span>
    {open && <section id={id} className="admin-notification-panel" aria-label="Thông báo quản trị">
      <header><div><h2>Thông báo</h2><p>{data ? `${count} chưa đọc · ${data.unreadMessages} tin nhắn / yêu cầu hỗ trợ` : "Đang tải thông báo…"}</p></div>
        <button type="button" className="admin-notification-close" onClick={() => { setOpenedAt(null); trigger.current?.focus(); }} aria-label="Đóng thông báo"><X size={18} /></button>
      </header>
      {status !== "live" && <p className="admin-notification-connection" role="status">Đang kết nối cập nhật trực tiếp. Tự làm mới sau mỗi 15 giây.</p>}
      {error && <p role="alert" className="admin-notification-error">{error}</p>}
      {data && count > 0 && <button type="button" className="admin-notification-read-all" disabled={pending} onClick={markAllRead}><CheckCheck size={16} />{pending ? "Đang cập nhật…" : "Đánh dấu tất cả đã đọc"}</button>}
      <div className="admin-notification-list">
        {!data && <p className="admin-notification-empty" role="status">Đang tải thông báo…</p>}
        {data && count === 0 && <div className="admin-notification-empty"><Bell size={30} strokeWidth={1.3} /><strong>Bạn đã xem hết thông báo</strong><p>Tin nhắn, đơn hàng và đánh giá mới sẽ xuất hiện tại đây.</p></div>}
        {data?.items.map(item => {
          const Icon = item.type === "message" ? MessageSquare : item.type === "review" ? Star : Package;
          return <Link key={item.id} to={item.href} className="admin-notification-item" onClick={() => { void markRead(item); setOpenedAt(null); }}>
            <span className={`admin-notification-icon is-${item.type}`}><Icon size={19} strokeWidth={1.6} aria-hidden="true" /></span>
            <span className="admin-notification-copy"><strong>{item.title}</strong><span>{item.body}</span><time dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time></span>
            {item.count > 1 ? <b className="admin-notification-item-count">{notificationBadge(item.count)}</b> : <i className="admin-notification-unread" aria-label="Chưa đọc" />}
          </Link>;
        })}
      </div>
      <footer><Link to="/owner/messages" onClick={() => setOpenedAt(null)}>Mở tin nhắn & hỗ trợ</Link><span>Thông báo mới nhất</span></footer>
    </section>}
  </div>;
}
