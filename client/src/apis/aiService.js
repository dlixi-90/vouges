import axios from "axios";

const aiClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
});

export const AI_MESSAGE_MAX_LENGTH = 2000;
// The server uses the same three-exchange context window to avoid resending
// the entire transcript to the model on every message.
export const AI_HISTORY_MAX_MESSAGES = 6;

const normalizeHistory = (history) => {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (item) =>
        ["user", "assistant"].includes(item?.role) &&
        item?.status === "sent" &&
        typeof item?.content === "string" &&
        item.content.trim(),
    )
    .slice(-AI_HISTORY_MAX_MESSAGES)
    .map(({ role, content }) => ({
      role,
      content: content.trim(),
    }));
};

const getErrorMessage = (error) => {
  if (error.code === "ERR_CANCELED") {
    return "Yêu cầu AI đã bị hủy";
  }

  return (
    error.response?.data?.message ||
    error.message ||
    "Không thể kết nối với trợ lý AI"
  );
};

export const sendAIMessage = async ({ message, history = [], getToken, signal }) => {
  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    throw new Error("Vui lòng nhập nội dung tin nhắn");
  }

  if (normalizedMessage.length > AI_MESSAGE_MAX_LENGTH) {
    throw new Error(
      `Tin nhắn không được vượt quá ${AI_MESSAGE_MAX_LENGTH} ký tự`,
    );
  }

  if (typeof getToken !== "function") {
    throw new Error("Không thể xác thực người dùng");
  }

  const token = await getToken();

  if (!token) {
    throw new Error("Vui lòng đăng nhập để sử dụng trợ lý AI");
  }

  try {
    const { data } = await aiClient.post(
      "/api/ai/chat",
      {
        message: normalizedMessage,
        history: normalizeHistory(history),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      },
    );

    if (!data?.success) {
      throw new Error(data?.message || "Trợ lý AI không thể trả lời");
    }

    return data;
  } catch (error) {
    throw new Error(getErrorMessage(error), { cause: error });
  }
};
