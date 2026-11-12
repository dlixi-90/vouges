import { supportStatuses } from "../../utils/supportChat";
import "./support-status.css";

const connections = {
  live: "Đã kết nối", connecting: "Đang kết nối…", reconnecting: "Đang kết nối lại…",
  error: "Mất kết nối", paused: "Tạm dừng cập nhật",
};

export function SupportConnectionStatus({ status = "connecting", className = "" }) {
  const state = Object.hasOwn(connections, status) ? status : "connecting";
  return <span className={`support-connection-status ${className}`} data-state={state} role="status">
    <span className="support-status-dot" aria-hidden="true" />{connections[state]}
  </span>;
}

export function SupportConversationStatus({ status }) {
  return <span className="support-case-status" data-state={status}>{supportStatuses[status] || "Đang tải hội thoại…"}</span>;
}
