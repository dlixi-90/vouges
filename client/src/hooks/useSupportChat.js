import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { createSupportEventParser, mergeSupportSnapshot } from "../utils/supportChat";

export const useSupportApi = () => {
  const { axios, getToken, storeResources } = useAppContext();
  const tokenRef = useRef(getToken);
  useEffect(() => { tokenRef.current = getToken; }, [getToken]);
  return useMemo(() => ({
    token: () => tokenRef.current(),
    url: (path) => new URL(path, axios.defaults.baseURL || window.location.origin).toString(),
    async request(method, path, body, signal) {
      const token = await tokenRef.current();
      signal?.throwIfAborted();
      if (!token) throw new Error("Vui lòng đăng nhập để trò chuyện với CSKH.");
      const { data } = await axios.request({ method, url: path, data: body, signal, timeout: 15000,
        headers: { Authorization: `Bearer ${token}` } });
      if (!data.success) throw new Error(data.message || "Không thể tải cuộc trò chuyện.");
      if (method.toLowerCase() !== "get") storeResources.invalidateSupport();
      return data;
    },
  }), [axios, storeResources]);
};

export const useSupportFeed = (path, enabled, conversationFeed = false, initialData) => {
  const api = useSupportApi();
  const { user, storeResources } = useAppContext();
  const userId = user?.id;
  const key = `${userId}:${path}`;
  const inboxPath = !conversationFeed && path?.startsWith("/api/support/inbox/events") ? path.replace("/inbox/events", "/inbox") : null;
  const cached = inboxPath ? storeResources.peekSupportInbox(inboxPath) : null;
  const [result, setResult] = useState(() => initialData ? { key, data: initialData } : null);
  const [connection, setConnection] = useState({ key: "", status: "connecting", error: "" });
  const update = useCallback((snapshot) => {
    if (inboxPath) storeResources.setSupportInbox(inboxPath, snapshot);
    setResult(previous => ({ key, data: conversationFeed ? mergeSupportSnapshot(previous?.key === key ? previous.data : null, snapshot) : snapshot }));
  }, [key, conversationFeed, inboxPath, storeResources]);
  useEffect(() => {
    if (!enabled || !userId || !path) return undefined;
    let active = true;
    let controller;
    let reconnect;
    let failures = 0;
    let generation = 0;
    let liveSnapshots = 0;
    // A normal JSON response works even when a proxy buffers SSE frames. Never
    // let this older bootstrap replace a snapshot already received live.
    if (inboxPath) void storeResources.loadSupportInbox(inboxPath).then(snapshot => {
      if (active && liveSnapshots === 0) update(snapshot);
    }).catch(() => {}); // The live connection retains its existing retry/error UI.
    const connect = async () => {
      if (!active || document.hidden) return;
      const epoch = ++generation;
      const current = () => active && epoch === generation && !document.hidden;
      const requestController = new AbortController();
      controller = requestController;
      // Also recover when a proxy opens the stream but never flushes a frame.
      const deadline = window.setTimeout(() => requestController.abort(), 30000);
      try {
        const token = await api.token();
        requestController.signal.throwIfAborted();
        if (!token) throw new Error("Phiên đăng nhập đã hết hạn.");
        const response = await fetch(api.url(path), { signal: requestController.signal,
          headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" }, cache: "no-store" });
        if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
          const error = new Error(response.status === 401 ? "Vui lòng đăng nhập lại để tiếp tục trò chuyện." : "Không thể kết nối trò chuyện. Đang thử lại…");
          error.terminal = [401, 403, 404].includes(response.status);
          throw error;
        }
        const parse = createSupportEventParser((snapshot) => {
          if (!current()) return;
          failures = 0;
          liveSnapshots++;
          update(snapshot);
          setConnection({ key, status: "live", error: "" });
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        try {
          while (current()) {
            const { value, done } = await reader.read();
            if (done) break;
            parse(decoder.decode(value, { stream: true }));
          }
        } finally { await reader.cancel().catch(() => {}); }
        if (current()) reconnect = window.setTimeout(connect, 250);
      } catch (error) {
        if (!current()) return;
        setConnection({ key, status: error.terminal ? "error" : "reconnecting", error: error.name === "AbortError" ? "Kết nối gián đoạn. Đang kết nối lại…" : error.message });
        if (!error.terminal) reconnect = window.setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(failures++, 4)));
      } finally { window.clearTimeout(deadline); }
    };
    const visibility = () => {
      generation++;
      window.clearTimeout(reconnect);
      controller?.abort();
      if (!document.hidden) reconnect = window.setTimeout(connect, 0);
    };
    document.addEventListener("visibilitychange", visibility);
    void connect();
    return () => {
      active = false;
      generation++;
      window.clearTimeout(reconnect);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [api, path, enabled, userId, key, update, inboxPath, storeResources]);
  return { data: result?.key === key ? result.data : cached, update,
    status: connection.key === key ? connection.status : "connecting", error: connection.key === key ? connection.error : "" };
};
