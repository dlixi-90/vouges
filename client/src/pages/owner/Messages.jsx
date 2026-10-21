import { useEffect, useState } from "react";
import { ArrowLeft, Headset, LoaderCircle, MessageSquare, Search } from "lucide-react";
import { useSupportFeed } from "../../hooks/useSupportChat";
import { supportStatuses } from "../../utils/supportChat";
import SupportThread from "../../components/support/SupportThread";

export default function Messages() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const params = new URLSearchParams({ search: query, status, page: String(page) });
  const feed = useSupportFeed(`/api/support/inbox/events?${params}`, true);
  const inbox = feed.data;
  return <main className="net-admin-messages m-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-secondary/10 bg-white text-secondary shadow-sm sm:m-3">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-secondary/10 bg-primary/50 px-5 py-5 sm:px-6">
      <div><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#82738d]">Velours customer care</p><h1 className="flex items-center gap-2.5 text-xl font-semibold"><Headset size={23} aria-hidden="true" />Tin nhắn CSKH</h1></div>
      <span className="rounded-full bg-secondary/5 px-3 py-2 text-xs font-medium">{inbox ? `${inbox.unread} hội thoại chưa đọc` : "Đang kết nối…"}</span>
    </header>
    <div className="flex min-h-0 flex-1">
      <aside aria-label="Danh sách hội thoại" className={`${selected ? "hidden lg:flex" : "flex"} min-h-0 w-full shrink-0 flex-col border-r border-secondary/10 lg:w-72 xl:w-80`}>
        <div className="shrink-0 space-y-3 border-b border-secondary/10 p-4">
          <label className="relative block"><Search size={16} className="pointer-events-none absolute left-3 top-3 text-gray-400" aria-hidden="true" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Tìm khách hàng theo tên hoặc email" placeholder="Tìm tên hoặc email…" className="w-full rounded-xl border border-secondary/15 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-secondary" /></label>
          <select aria-label="Lọc hội thoại" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="w-full rounded-xl border border-secondary/15 bg-primary/60 px-3 py-2.5 text-xs outline-none focus:border-secondary"><option value="all">Tất cả hội thoại</option><option value="unread">Chưa đọc</option>{Object.entries(supportStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!inbox && !feed.error && <p role="status" className="flex items-center justify-center gap-2 py-12 text-xs text-gray-500"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Đang tải hộp thư…</p>}
          {inbox?.conversations.length === 0 && <div className="px-5 py-12 text-center"><MessageSquare size={30} strokeWidth={1.3} className="mx-auto mb-3 text-gray-300" aria-hidden="true" /><p className="text-sm font-medium">Chưa có hội thoại phù hợp</p><p className="mt-2 text-xs leading-5 text-gray-500">Yêu cầu hỗ trợ từ khách sẽ xuất hiện tại đây.</p></div>}
          {inbox?.conversations.map((conversation) => <button key={conversation._id} type="button" onClick={() => setSelected(conversation)} aria-pressed={selected?._id === conversation._id}
            className={`flex w-full cursor-pointer items-start gap-3 border-b border-secondary/5 px-4 py-4 text-left transition hover:bg-primary ${selected?._id === conversation._id ? "bg-secondary/5 shadow-[inset_3px_0_0_var(--color-secondary)]" : ""}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eee8f2] text-sm font-semibold">{conversation.customerName?.charAt(0).toUpperCase() || "K"}</span>
            <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className={`truncate text-sm ${conversation.unreadStaff ? "font-bold" : "font-medium"}`}>{conversation.customerName}</span>{conversation.unreadStaff > 0 && <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-white">{conversation.unreadStaff > 99 ? "99+" : conversation.unreadStaff}</span>}</span><span className="mt-1 block truncate text-xs text-gray-500">{conversation.lastMessage}</span><span className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-400"><span className={conversation.status === "waiting" ? "text-amber-700" : conversation.status === "active" ? "text-emerald-700" : ""}>{supportStatuses[conversation.status]}</span><span>{new Date(conversation.lastMessageAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}</span></span></span>
          </button>)}
        </div>
        {feed.error && <p role="alert" className="shrink-0 bg-red-50 p-3 text-xs leading-5 text-red-700">{feed.error}</p>}
        {inbox && inbox.total > 30 && <div className="flex shrink-0 items-center justify-between border-t border-secondary/10 p-3 text-xs"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="cursor-pointer rounded-lg px-2 py-2 hover:bg-primary disabled:opacity-40">Trước</button><span>Trang {page}</span><button type="button" disabled={page * 30 >= inbox.total} onClick={() => setPage((value) => value + 1)} className="cursor-pointer rounded-lg px-2 py-2 hover:bg-primary disabled:opacity-40">Sau</button></div>}
      </aside>
      <section aria-label="Nội dung hội thoại" className={`${selected ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-1 flex-col`}>
        {selected ? <><div className="flex shrink-0 items-center gap-3 border-b border-secondary/10 px-4 py-4"><button type="button" onClick={() => setSelected(null)} aria-label="Quay lại danh sách hội thoại" className="cursor-pointer rounded-lg p-2 hover:bg-primary lg:hidden"><ArrowLeft size={18} /></button><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{selected.customerName}</h2><p className="mt-1 truncate text-xs text-gray-500">{selected.customerEmail || "Khách hàng Velours"}</p></div></div><SupportThread key={selected._id} conversationId={selected._id} role="staff" /></>
          : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#f4f1f6]"><Headset size={38} strokeWidth={1.4} aria-hidden="true" /></span><h2 className="text-lg font-semibold">Mỗi cuộc trò chuyện là một kết nối</h2><p className="mt-3 max-w-sm text-sm leading-6 text-gray-500">Chọn hội thoại để xem nội dung, tiếp nhận và trả lời khách hàng.</p></div>}
      </section>
    </div>
  </main>;
}
