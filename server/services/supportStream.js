// Bounded SSE sessions work across serverless instances: MongoDB is the source
// of truth. Each client reconnects with a fresh token after this session ends.
export const streamSnapshots = async (req, res, read, { durationMs = 20000, intervalMs = 1500 } = {}) => {
  res.set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no" });
  res.flushHeaders?.();
  let closed = false;
  let timer;
  let previous;
  let finish;
  const done = new Promise((resolve) => { finish = resolve; });
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    clearTimeout(deadline);
    req.off("aborted", close);
    res.off("close", close);
    if (!res.destroyed && !res.writableEnded) res.end();
    finish();
  };
  const deadline = setTimeout(close, durationMs);
  req.on("aborted", close);
  res.on("close", close);
  const tick = async () => {
    if (closed) return;
    try {
      const snapshot = await read();
      if (closed) return;
      const encoded = snapshot == null ? null : JSON.stringify(snapshot);
      if (encoded != null && encoded !== previous) {
        res.write(`event: snapshot\ndata: ${encoded}\n\n`);
        if (res.writableLength > 2000000) { close(); return; }
        previous = encoded;
      } else res.write(": keepalive\n\n");
      if (!closed) timer = setTimeout(tick, intervalMs);
    } catch {
      if (!closed) res.write('event: error\ndata: {"message":"Kết nối bị gián đoạn. Đang kết nối lại."}\n\n');
      close();
    }
  };
  void tick();
  await done;
};
