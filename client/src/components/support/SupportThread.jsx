import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowDown, CheckCheck, LoaderCircle, Send } from "lucide-react";
import { useSupportApi, useSupportFeed } from "../../hooks/useSupportChat";
import { SUPPORT_MESSAGE_LIMIT, supportStatuses } from "../../utils/supportChat";

export default function SupportThread({ conversationId, role = "customer", onConversationChange, initialSnapshot }) {
  const api = useSupportApi();
  const feed = useSupportFeed(`/api/support/conversations/${conversationId}/events`, Boolean(conversationId), true, initialSnapshot);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const scrollRef = useRef(null);
  const followRef = useRef(true);
  const sendingRef = useRef(false);
  const acknowledged = useRef("");
  const alive = useRef(true);
  const requests = useRef(new Set());
  const conversation = feed.data?.conversation;
  const messages = feed.data?.messages || [];
  const lastSequence = messages.at(-1)?.sequence;
  const unread = role === "staff" ? conversation?.unreadStaff : conversation?.unreadCustomer;
  const readKey = conversation ? `${conversation.sequence}:${conversation.updatedAt}` : "";
  const pendingDelivered = pending && messages.some((message) => message.clientMessageId === pending.clientMessageId);
  const blockedPending = pending && (!pendingDelivered || pending.status === "sending");

  useEffect(() => {
    alive.current = true;
    const activeRequests = requests.current;
    return () => { alive.current = false; for (const controller of activeRequests) controller.abort(); };
  }, []);
  const request = async (method, path, body) => {
    const controller = new AbortController();
    requests.current.add(controller);
    try { return await api.request(method, path, body, controller.signal); }
    finally { requests.current.delete(controller); }
  };
  useEffect(() => {
    if (!followRef.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lastSequence, pending?.status]);
  useEffect(() => {
    if (!conversation || !unread || document.hidden || !followRef.current || acknowledged.current === readKey) return undefined;
    const controller = new AbortController();
    acknowledged.current = readKey;
    void api.request("post", `/api/support/conversations/${conversationId}/read`, { sequence: conversation.sequence }, controller.signal)
      .catch(() => { if (acknowledged.current === readKey) acknowledged.current = ""; });
    return () => controller.abort();
  }, [api, conversationId, conversation, unread, readKey]);
  const changeStatus = async () => {
    setUpdatingStatus(true);
    setError("");
    try {
      const result = await request("patch", `/api/support/conversations/${conversationId}/status`, { status: conversation.status === "resolved" ? "waiting" : "resolved" });
      if (alive.current) { feed.update({ conversation: result.conversation, messages: [] }); onConversationChange?.(); }
    } catch (err) { if (alive.current) setError(err.response?.data?.message || err.message); }
    finally { if (alive.current) setUpdatingStatus(false); }
  };
  const send = async (draft) => {
    if (sendingRef.current || !draft.content.trim()) return;
    sendingRef.current = true;
    followRef.current = true;
    setPending({ ...draft, status: "sending" });
    setInput("");
    setError("");
    try {
      const result = await request("post", `/api/support/conversations/${conversationId}/messages`, draft);
      if (!alive.current) return;
      feed.update({ conversation: result.conversation, messages: [result.message] });
      setPending(null);
      onConversationChange?.();
    } catch (err) {
      if (alive.current) { setPending({ ...draft, status: "failed" }); setError(err.response?.data?.message || err.message); }
    } finally { sendingRef.current = false; }
  };
  const submit = (event) => {
    event.preventDefault();
    if (blockedPending || !conversation || !input.trim()) return;
    void send({ content: input.trim(), clientMessageId: crypto.randomUUID() });
  };
  const loadOlder = async () => {
    setLoadingOlder(true);
    setError("");
    followRef.current = false;
    const height = scrollRef.current?.scrollHeight || 0;
    try {
      const result = await request("get", `/api/support/conversations/${conversationId}/messages?before=${messages[0].sequence}`);
      if (!alive.current) return;
      feed.update(result);
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop += scrollRef.current.scrollHeight - height; });
    } catch (err) { if (alive.current) setError(err.response?.data?.message || err.message); }
    finally { if (alive.current) setLoadingOlder(false); }
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-secondary/10 bg-primary/60 px-4 py-3">
        <p className="text-xs text-gray-500">{conversation ? supportStatuses[conversation.status] : "Đang tải hội thoại…"}
          <span className={`ml-2 inline-block h-1.5 w-1.5 rounded-full ${feed.status === "live" ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden="true" />
          <span className="ml-1.5">{feed.status === "live" ? "Đã kết nối" : feed.status === "error" ? "Mất kết nối" : "Đang kết nối…"}</span>
        </p>
        {role === "staff" && conversation && <button type="button" disabled={updatingStatus} onClick={changeStatus} className="cursor-pointer rounded-full border border-secondary/20 bg-white px-3 py-1.5 text-xs font-medium text-secondary disabled:opacity-50">
          {updatingStatus ? "Đang lưu…" : conversation.status === "resolved" ? "Mở lại hội thoại" : "Đánh dấu hoàn tất"}
        </button>}
      </div>
      <div ref={scrollRef} onScroll={() => {
        const area = scrollRef.current;
        followRef.current = area.scrollHeight - area.scrollTop - area.clientHeight < 100;
        if (followRef.current && unread && !document.hidden && conversation && acknowledged.current !== readKey) {
          acknowledged.current = readKey;
          void api.request("post", `/api/support/conversations/${conversationId}/read`, { sequence: conversation.sequence }).catch(() => { if (acknowledged.current === readKey) acknowledged.current = ""; });
        }
      }} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5" aria-label="Lịch sử tin nhắn">
        {!conversation && feed.status !== "error" && <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><LoaderCircle size={17} className="animate-spin" aria-hidden="true" />Đang tải tin nhắn…</p>}
        {messages[0]?.sequence > 1 && <button type="button" disabled={loadingOlder} onClick={loadOlder} className="block w-full cursor-pointer py-2 text-xs text-secondary underline disabled:opacity-50">{loadingOlder ? "Đang tải…" : "Xem tin nhắn trước"}</button>}
        {conversation?.context?.length > 0 && <details className="rounded-xl border border-secondary/10 bg-primary p-3 text-xs text-gray-600">
          <summary className="cursor-pointer font-medium text-secondary">Nội dung trao đổi với AI được khách chia sẻ</summary>
          <div className="mt-3 max-h-56 space-y-3 overflow-y-auto">{conversation.context.map((item, index) => <div key={index}><p className="font-semibold">{item.role === "user" ? "Khách hàng" : "Velours AI"}</p><p className="mt-1 whitespace-pre-wrap break-words leading-5">{item.content}</p></div>)}</div>
        </details>}
        {conversation && messages.length === 0 && <p className="mx-auto max-w-xs py-8 text-center text-sm leading-6 text-gray-500">{role === "staff" ? "Khách hàng đang cần hỗ trợ. Hãy gửi lời chào để tiếp nhận hội thoại." : "Yêu cầu đã được gửi đến CSKH. Bạn có thể để lại câu hỏi; nhân viên sẽ phản hồi tại đây."}</p>}
        {messages.map((message) => <div key={message._id} className={`flex ${message.role === role ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === role ? "rounded-br-md bg-secondary text-white" : "rounded-bl-md bg-primary text-secondary"}`}>
            <p className={`mb-1 text-[10px] font-medium ${message.role === role ? "text-white/65" : "text-gray-500"}`}>{message.role === "staff" ? `CSKH · ${message.authorName}` : message.role === role ? "Bạn" : message.authorName}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{message.content}</p>
            <p className={`mt-1.5 text-right text-[10px] ${message.role === role ? "text-white/60" : "text-gray-400"}`}>{new Date(message.createdAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" })}</p>
          </div>
        </div>)}
        {pending && !messages.some((message) => message.clientMessageId === pending.clientMessageId) && <div className="ml-auto max-w-[85%] rounded-2xl bg-secondary/10 p-4 text-sm text-secondary">
          <p className="whitespace-pre-wrap break-words">{pending.content}</p>
          <p className="mt-2 text-xs">{pending.status === "sending" ? "Đang gửi…" : "Chưa xác nhận gửi thành công"}</p>
          {pending.status === "failed" && <div className="mt-2 flex gap-4"><button type="button" onClick={() => void send(pending)} className="cursor-pointer text-xs font-semibold underline">Thử lại</button><button type="button" onClick={() => { setInput(pending.content); setPending(null); setError(""); }} className="cursor-pointer text-xs underline">Sửa bản nháp</button></div>}
        </div>}
      </div>
      {((error && !pendingDelivered) || feed.error) && <p role="alert" className="flex shrink-0 items-start gap-2 bg-red-50 px-4 py-2 text-xs leading-5 text-red-700"><AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{(!pendingDelivered && error) || feed.error}</p>}
      <form onSubmit={submit} className="shrink-0 border-t border-secondary/10 bg-white p-3">
        {conversation?.status === "resolved" && <p className="mb-2 text-xs text-gray-500"><CheckCheck size={13} className="mr-1 inline" aria-hidden="true" />Gửi tin mới để mở lại hội thoại.</p>}
        <div className="net-field-shell flex items-end gap-2 rounded-2xl border border-secondary/15 bg-primary/60 p-2 focus-within:border-secondary/50">
          <label htmlFor={`support-input-${conversationId}`} className="sr-only">Tin nhắn CSKH</label>
          <textarea id={`support-input-${conversationId}`} rows={2} maxLength={SUPPORT_MESSAGE_LIMIT} value={input} disabled={!conversation || Boolean(blockedPending)} onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(event); } }}
            placeholder="Nhập tin nhắn…" className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none disabled:opacity-50" />
          <button type="submit" disabled={!input.trim() || Boolean(blockedPending) || !conversation} aria-label="Gửi tin nhắn CSKH" className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-secondary text-white disabled:cursor-not-allowed disabled:opacity-40"><Send size={17} aria-hidden="true" /></button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-gray-400"><span>Enter để gửi · Shift + Enter để xuống dòng</span><span>{input.length}/{SUPPORT_MESSAGE_LIMIT}</span></div>
        <button type="button" onClick={() => { followRef.current = true; if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }} className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 text-[10px] text-gray-500"><ArrowDown size={11} aria-hidden="true" />Tin nhắn mới nhất</button>
      </form>
    </div>
  );
}
