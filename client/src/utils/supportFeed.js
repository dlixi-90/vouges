import { createSupportEventParser, supportSnapshotVersion } from "./supportChat.js";

// Initial JSON and live events race independently. A slow/ buffered stream must
// never hold up message history; failed streams fall back to visible JSON reads.
export function startSupportFeed({ path, api, conversationFeed, readSnapshot, getSnapshot, onSnapshot, onConnection,
  documentTarget = document, timers = window, fetchStream = fetch, fallbackMs = 10000, deadlineMs = 12000 }) {
  let active = true, terminal = false, healthy = false, generation = 0, failures = 0, revision = 0;
  let streamController, snapshotController, reconnect, fallback, streamDeadline;
  const visible = () => active && !terminal && !documentTarget.hidden;
  const refresh = async force => {
    if (!visible() || !readSnapshot || snapshotController) return;
    const controller = new AbortController();
    snapshotController = controller;
    const startedAt = revision;
    try {
      const snapshot = await readSnapshot(controller.signal, force);
      if (visible() && !controller.signal.aborted && snapshot && revision === startedAt) onSnapshot(snapshot);
    } catch (error) {
      if (visible() && !controller.signal.aborted && !healthy && !getSnapshot()) {
        onConnection("reconnecting", error.response?.data?.message || "Chưa thể tải tin nhắn. Đang thử lại…");
      }
    } finally { if (snapshotController === controller) snapshotController = undefined; }
  };
  const scheduleFallback = () => {
    timers.clearTimeout(fallback);
    if (!visible() || !readSnapshot) return;
    fallback = timers.setTimeout(() => {
      if (!healthy || !getSnapshot()) void refresh(true);
      scheduleFallback();
    }, fallbackMs);
  };
  const connect = async () => {
    if (!visible()) return;
    healthy = false;
    const epoch = ++generation;
    const current = () => visible() && epoch === generation;
    const controller = new AbortController();
    streamController = controller;
    let deadline = timers.setTimeout(() => controller.abort(), deadlineMs);
    streamDeadline = deadline;
    try {
      const token = await api.token();
      controller.signal.throwIfAborted();
      if (!token) { const error = new Error("Phiên đăng nhập đã hết hạn."); error.terminal = true; throw error; }
      const version = conversationFeed ? supportSnapshotVersion(getSnapshot()) : "";
      const streamPath = version ? `${path}${path.includes("?") ? "&" : "?"}since=${encodeURIComponent(version)}` : path;
      const response = await fetchStream(api.url(streamPath), { signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" }, cache: "no-store" });
      if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
        const error = new Error(response.status === 401 ? "Vui lòng đăng nhập lại để tiếp tục trò chuyện." : "Không thể kết nối trò chuyện. Đang thử lại…");
        error.terminal = [401, 403, 404].includes(response.status);
        throw error;
      }
      if (!current()) { await response.body.cancel().catch(() => {}); return; }
      const parse = createSupportEventParser(snapshot => {
        if (!current()) return;
        failures = 0; healthy = true; revision++;
        onSnapshot(snapshot);
        onConnection("live", "");
      });
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let receivedFrame = false;
      try {
        while (current()) {
          const { value, done } = await reader.read();
          if (done) break;
          parse(decoder.decode(value, { stream: true }));
          if (!current()) break;
          receivedFrame = true; healthy = true; failures = 0;
          onConnection("live", "");
          timers.clearTimeout(deadline);
          deadline = timers.setTimeout(() => controller.abort(), deadlineMs);
          streamDeadline = deadline;
        }
      } finally { await reader.cancel().catch(() => {}); }
      if (current() && !receivedFrame) throw new Error("Kết nối bị gián đoạn. Đang kết nối lại…");
      if (current()) reconnect = timers.setTimeout(connect, 250);
    } catch (error) {
      if (!current()) return;
      healthy = false;
      failures++;
      terminal = Boolean(error.terminal);
      onConnection(terminal || failures >= 3 ? "error" : "reconnecting", error.name === "AbortError" ? "Kết nối gián đoạn. Đang kết nối lại…" : error.message);
      if (terminal) { timers.clearTimeout(fallback); snapshotController?.abort(); }
      else {
        void refresh(true);
        reconnect = timers.setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(failures - 1, 4)));
      }
    } finally {
      timers.clearTimeout(deadline);
      if (streamDeadline === deadline) streamDeadline = undefined;
    }
  };
  const visibility = () => {
    generation++; healthy = false;
    timers.clearTimeout(reconnect); timers.clearTimeout(fallback);
    timers.clearTimeout(streamDeadline);
    streamController?.abort(); snapshotController?.abort(); snapshotController = undefined;
    if (visible()) {
      onConnection("connecting", "");
      void refresh(true); void connect(); scheduleFallback();
    } else if (active && !terminal) onConnection("paused", "");
  };
  documentTarget.addEventListener("visibilitychange", visibility);
  if (visible()) { void refresh(false); void connect(); scheduleFallback(); }
  return () => {
    active = false; generation++;
    timers.clearTimeout(reconnect); timers.clearTimeout(fallback);
    timers.clearTimeout(streamDeadline);
    streamController?.abort(); snapshotController?.abort();
    documentTarget.removeEventListener("visibilitychange", visibility);
  };
}
