import { useCallback, useEffect, useState } from "react";
import { useSupportApi, useSupportFeed } from "./useSupportChat";
import { pollWhileVisible } from "../utils/visiblePolling";

export default function useAdminNotifications(enabled) {
  const api = useSupportApi();
  const { data, update, status } = useSupportFeed("/api/notifications/events", enabled);
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState(false);
  // JSON also recovers the badge when a proxy blocks or buffers SSE.
  useEffect(() => {
    if (!enabled) return;
    let controller;
    const refresh = async () => {
      controller?.abort();
      controller = new AbortController();
      try { update(await api.request("get", "/api/notifications", undefined, controller.signal)); }
      catch { /* The stream reconnects independently; never reset a known count. */ }
    };
    void refresh();
    const stop = pollWhileVisible(refresh, 15000);
    return () => { stop(); controller?.abort(); };
  }, [enabled, api, update]);
  const markRead = useCallback(async item => {
    if (item.type === "message") return; // Reading the thread acknowledges its actual message sequence.
    setActionError("");
    try { update(await api.request("post", "/api/notifications/read", { id: item.id })); }
    catch { setActionError("Chưa thể đánh dấu đã đọc. Vui lòng thử lại."); }
  }, [api, update]);
  const markAllRead = async () => {
    if (pending || !data?.asOf) return;
    setPending(true); setActionError("");
    try { update(await api.request("post", "/api/notifications/read-all", { before: data.asOf })); }
    catch { setActionError("Chưa thể đánh dấu đã đọc. Vui lòng thử lại."); }
    finally { setPending(false); }
  };
  return { data: enabled ? data : null, status, markRead, markAllRead, pending, error: actionError };
}
