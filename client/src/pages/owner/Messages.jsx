import { useEffect, useState } from "react";
import { ArrowLeft, Headset, LoaderCircle, MessageSquare, Search } from "lucide-react";
import { useSupportFeed } from "../../hooks/useSupportChat";
import { supportStatuses } from "../../utils/supportChat";
import SupportThread from "../../components/support/SupportThread";
import Pagination from "../../components/Pagination";
import usePaginationScroll from "../../hooks/usePaginationScroll";
import { Badge, CatalogPage } from "../../components/owner/CatalogUI";
import { OperationsEmptyState } from "../../components/owner/OperationsUI";

export default function Messages() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const value = search.trim();
    if (value === query) return;
    const timer = window.setTimeout(() => { setQuery(value); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search, query]);
  const params = new URLSearchParams({ search: query, status, page: String(page) });
  const feed = useSupportFeed(`/api/support/inbox/events?${params}`, true);
  const inbox = feed.data;
  const { listRef, changePage } = usePaginationScroll({ page, onPageChange: setPage, ready: Boolean(inbox) });
  return <CatalogPage className="admin-operations-page admin-messages-page" title="Tin nhắn & hỗ trợ" actions={<><Badge>{inbox ? inbox.unread : "—"} hội thoại chưa đọc</Badge><span className="admin-feed-status"><i data-connected={feed.status === "live"} />{feed.status === "live" ? "Đã kết nối" : feed.status === "error" ? "Mất kết nối" : "Đang kết nối…"}</span></>}>
    <div className="net-admin-messages admin-message-workspace">
      <aside aria-label="Danh sách hội thoại" className={`admin-message-sidebar${selected ? " is-conversation-selected" : ""}`}>
        <header className="admin-inbox-heading"><h2>Hộp thư</h2><Badge>{inbox ? inbox.total : "—"} hội thoại</Badge></header>
        <div className="admin-inbox-filters"><label className="perfume-search"><Search size={16} aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label="Tìm khách hàng theo tên hoặc email" placeholder="Tìm khách hàng, email…" /></label><select aria-label="Lọc hội thoại" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className="admin-operation-input"><option value="all">Tất cả hội thoại</option><option value="unread">Chưa đọc</option>{Object.entries(supportStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="admin-inbox-scroll overflow-y-auto"><div ref={listRef} tabIndex={-1} className="pagination-list-start">
          {!inbox && !feed.error && <p role="status" className="admin-inbox-loading"><LoaderCircle size={16} className="animate-spin" />Đang tải hộp thư…</p>}
          {inbox?.conversations.length === 0 && <OperationsEmptyState icon={MessageSquare} title="Chưa có hội thoại phù hợp" description="Yêu cầu hỗ trợ từ khách sẽ xuất hiện tại đây." />}
          {inbox?.conversations.map(conversation => <button key={conversation._id} type="button" onClick={() => setSelected(conversation)} aria-pressed={selected?._id === conversation._id} className="admin-conversation-row"><span className="admin-conversation-avatar">{conversation.customerName?.charAt(0).toUpperCase() || "K"}</span><span className="admin-conversation-copy"><span className="admin-conversation-top"><strong className={conversation.unreadStaff ? "is-unread" : ""}>{conversation.customerName}</strong>{conversation.unreadStaff > 0 && <b>{conversation.unreadStaff > 99 ? "99+" : conversation.unreadStaff}</b>}</span><span className="admin-conversation-preview">{conversation.lastMessage}</span><span className="admin-conversation-meta"><span>{supportStatuses[conversation.status]}</span><time>{new Date(conversation.lastMessageAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}</time></span></span></button>)}
        </div></div>
        {feed.error && <p role="alert" className="perfume-alert admin-inbox-error">{feed.error}</p>}
        {inbox && inbox.total > 30 && <Pagination compact className="admin-inbox-pagination" label="Phân trang hội thoại" page={page} totalPages={Math.ceil(inbox.total / 30)} onPageChange={changePage} />}
      </aside>
      <section aria-label="Nội dung hội thoại" className={`admin-message-thread${selected ? " has-conversation" : ""}`}>
        {selected ? <><header className="admin-thread-heading"><button type="button" onClick={() => setSelected(null)} aria-label="Quay lại danh sách hội thoại" className="perfume-icon-button admin-thread-back"><ArrowLeft size={17} /></button><span className="admin-conversation-avatar">{selected.customerName?.charAt(0).toUpperCase() || "K"}</span><div><h2>{selected.customerName}</h2><p>{selected.customerEmail || "Khách hàng Velours"}</p></div></header><SupportThread key={selected._id} conversationId={selected._id} role="staff" className="admin-support-thread" /></> : <div className="admin-message-welcome"><span><Headset size={35} strokeWidth={1.3} /></span><h2>Mỗi cuộc trò chuyện là một kết nối</h2><p>Chọn một hội thoại để xem nội dung, tiếp nhận và hỗ trợ khách hàng.</p><div><i />Không gian chăm sóc khách hàng Velours</div></div>}
      </section>
    </div>
  </CatalogPage>;
}
