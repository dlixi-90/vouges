export const SUPPORT_MESSAGE_LIMIT = 3000;
export const supportStatuses = { waiting: "Chờ tiếp nhận", active: "Đang hỗ trợ", resolved: "Đã kết thúc" };
export const mergeSupportMessages = (...groups) => [...new Map(groups.flat().map((message) => [String(message._id), message])).values()]
  .sort((a, b) => a.sequence - b.sequence);
export const mergeSupportSnapshot = (current, incoming) => {
  if (!current?.conversation || String(current.conversation._id) !== String(incoming.conversation?._id)) return incoming;
  const old = current.conversation;
  const next = incoming.conversation;
  const stale = next.sequence < old.sequence || (next.sequence === old.sequence && new Date(next.updatedAt) < new Date(old.updatedAt));
  return { conversation: stale ? old : next, messages: mergeSupportMessages(current.messages || [], incoming.messages || []) };
};
export const supportContext = (messages = []) => {
  const context = messages.filter((message) => (message.role === "user" || (message.role === "assistant" && message.status === "sent")) && message.content?.trim())
    .slice(-12).map(({ role, content }) => ({ role, content: content.trim().slice(0, 2000) }));
  while (context.reduce((size, item) => size + item.content.length, 0) > 18000) context.shift();
  return context;
};
// Streaming UTF-8 decoding happens in the transport; this parser also accepts
// CRLF and incomplete event frames split across network chunks.
export const createSupportEventParser = (onSnapshot) => {
  let buffer = "";
  let event = "message";
  let data = [];
  return (chunk) => {
    buffer += chunk;
    if (buffer.length > 1000000) throw new Error("Phản hồi trò chuyện quá lớn.");
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (!line) {
        if (data.length) {
          const payload = JSON.parse(data.join("\n"));
          if (event === "error") throw new Error(payload.message || "Kết nối trò chuyện bị gián đoạn.");
          if (event === "snapshot") onSnapshot(payload);
        }
        event = "message";
        data = [];
      } else if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
  };
};
