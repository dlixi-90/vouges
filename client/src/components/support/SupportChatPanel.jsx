import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Headset, LoaderCircle, MessageCircle, X } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { useSupportApi } from "../../hooks/useSupportChat";
import { supportContext } from "../../utils/supportChat";
import SupportThread from "./SupportThread";

export default function SupportChatPanel({ onClose, onBack, aiMessages }) {
  const { user, requireCartLogin } = useAppContext();
  const api = useSupportApi();
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [shareContext, setShareContext] = useState(true);
  const [shared, setShared] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const requestRef = useRef(null);
  const context = supportContext(aiMessages);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    void api.request("get", "/api/support/mine", undefined, controller.signal).then((data) => {
      if (!controller.signal.aborted) { setSnapshot(data); setError(""); }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || err.message); });
    return () => { controller.abort(); requestRef.current?.abort(); };
  }, [api, userId, attempt]);
  const start = async () => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setStarting(true);
    setError("");
    try {
      const data = await api.request("post", "/api/support/mine", { context: shareContext ? context : [] }, controller.signal);
      if (!controller.signal.aborted) { setSnapshot(data); setShared(true); }
    } catch (err) { if (!controller.signal.aborted) setError(err.response?.data?.message || err.message); }
    finally {
      requestRef.current = null;
      if (!controller.signal.aborted) setStarting(false);
    }
  };
  return <>
    <button type="button" aria-label="Đóng chat CSKH" onClick={onClose} className="fixed inset-0 z-40 bg-black/25 sm:hidden" />
    <section id="vouges-ai-chat-panel" role="dialog" aria-label="Chat với nhân viên CSKH" className="fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-3xl border border-secondary/15 bg-white text-secondary shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[calc(100dvh-6rem)] sm:max-h-[680px] sm:w-[420px]">
      <header className="flex shrink-0 items-center gap-3 border-b border-secondary/10 bg-[#f4f1f6] px-4 py-3">
        <button type="button" onClick={onBack} aria-label="Quay lại trợ lý AI" title="Quay lại AI" className="cursor-pointer rounded-xl p-2 hover:bg-white"><ArrowLeft size={18} /></button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-white"><Headset size={21} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">Nhân viên CSKH</h2><p className="mt-0.5 text-xs text-gray-500">Velours luôn lắng nghe bạn</p></div>
        <button type="button" onClick={onClose} aria-label="Đóng chat CSKH" className="cursor-pointer rounded-xl p-2 hover:bg-white"><X size={20} /></button>
      </header>
      {!user ? <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center"><Headset size={38} strokeWidth={1.5} aria-hidden="true" /><p className="text-sm leading-6 text-gray-500">Đăng nhập để gửi tin nhắn và xem lại phản hồi từ CSKH.</p><button type="button" onClick={requireCartLogin} className="btn-secondary">Đăng nhập</button></div>
        : snapshot?.conversation ? <>
          {context.length > 0 && !shared && <div className="shrink-0 border-b border-secondary/10 px-4 py-3 text-xs"><p className="leading-5 text-gray-500">Bạn có thể chia sẻ {context.length} tin nhắn với AI để nhân viên nắm vấn đề.</p><button type="button" disabled={starting} onClick={start} className="mt-2 cursor-pointer font-medium text-secondary underline disabled:opacity-50">{starting ? "Đang chia sẻ…" : "Chia sẻ nội dung với CSKH"}</button></div>}
          {error && <p role="alert" className="shrink-0 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
          <SupportThread key={snapshot.conversation._id} conversationId={snapshot.conversation._id} initialSnapshot={snapshot} />
        </>
        : <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-6 text-center">
          {!snapshot && !error ? <p role="status" className="flex items-center gap-2 text-sm text-gray-500"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Đang kết nối với CSKH…</p> : <>
            <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary"><MessageCircle size={30} strokeWidth={1.5} aria-hidden="true" /></span>
            <h3 className="text-lg font-semibold">Bạn cần hỗ trợ thêm?</h3>
            <p className="mt-3 text-sm leading-6 text-gray-500">Gửi câu hỏi trực tiếp đến nhân viên Velours. Tin nhắn được lưu để bạn có thể quay lại xem phản hồi.</p>
            {context.length > 0 && <label className="mt-5 flex cursor-pointer items-start gap-2 rounded-xl bg-primary p-3 text-left text-xs leading-5 text-gray-600"><input type="checkbox" checked={shareContext} onChange={(event) => setShareContext(event.target.checked)} className="mt-1 accent-secondary" />Chia sẻ {context.length} tin nhắn gần nhất với AI cho nhân viên.</label>}
            {error && <p role="alert" className="mt-4 text-xs text-red-600">{error}</p>}
            {!snapshot ? <button type="button" onClick={() => { setError(""); setAttempt((value) => value + 1); }} className="btn-outline mt-5">Thử kết nối lại</button>
              : <button type="button" disabled={starting} onClick={start} className="mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3 text-sm font-medium text-white disabled:opacity-50">{starting ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Headset size={17} aria-hidden="true" />}{starting ? "Đang gửi yêu cầu…" : "Bắt đầu chat với CSKH"}</button>}
            <p className="mt-4 text-xs leading-5 text-gray-400">Nếu nhân viên chưa phản hồi ngay, bạn có thể để lại lời nhắn.</p>
          </>}
        </div>}
    </section>
  </>;
}
