import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { mergeSupportSnapshot } from "../utils/supportChat";
import { newestNotificationSnapshot } from "../utils/adminNotifications";
import { startSupportFeed } from "../utils/supportFeed";

export const useSupportApi = () => {
  const { axios, getToken, storeResources } = useAppContext();
  const tokenRef = useRef(getToken);
  useEffect(() => { tokenRef.current = getToken; }, [getToken]);
  return useMemo(() => ({
    token: () => tokenRef.current(),
    url: path => new URL(path, axios.defaults.baseURL || window.location.origin).toString(),
    async request(method, path, body, signal) {
      const token = await tokenRef.current();
      signal?.throwIfAborted();
      if (!token) throw new Error("Vui lòng đăng nhập để trò chuyện với CSKH.");
      const { data } = await axios.request({ method, url: path, data: body, signal, timeout: 15000,
        headers: { Authorization: `Bearer ${token}` } });
      if (!data.success) throw new Error(data.message || "Không thể tải cuộc trò chuyện.");
      if (method.toLowerCase() !== "get") storeResources.invalidateSupportInbox();
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
  const conversationId = conversationFeed ? path?.match(/\/conversations\/([^/]+)\/events/u)?.[1] : null;
  const cached = conversationId ? storeResources.peekSupportConversation(conversationId)
    : inboxPath ? storeResources.peekSupportInbox(inboxPath) : null;
  const [result, setResult] = useState(() => initialData ? { key, data: initialData } : null);
  const latest = useRef(null);
  const [connection, setConnection] = useState({ key: "", status: "connecting", error: "" });
  const update = useCallback(snapshot => {
    const current = latest.current?.key === key ? latest.current.data
      : conversationId ? storeResources.peekSupportConversation(conversationId) : null;
    const data = conversationFeed ? mergeSupportSnapshot(current, snapshot) : newestNotificationSnapshot(current, snapshot);
    latest.current = { key, data };
    if (inboxPath) storeResources.setSupportInbox(inboxPath, data);
    if (conversationId) storeResources.setSupportConversation(conversationId, data);
    setResult({ key, data });
  }, [key, conversationFeed, inboxPath, conversationId, storeResources]);

  useEffect(() => {
    if (!enabled || !userId || !path) return;
    if (initialData) update(initialData);
    return startSupportFeed({
      path, api, conversationFeed,
      getSnapshot: () => latest.current?.key === key ? latest.current.data
        : conversationId ? storeResources.peekSupportConversation(conversationId)
          : inboxPath ? storeResources.peekSupportInbox(inboxPath) : null,
      readSnapshot: conversationId ? (signal, force) => !force && initialData ? Promise.resolve(initialData)
        : storeResources.loadSupportConversation(conversationId, { signal, force })
        : inboxPath ? (signal, force) => storeResources.loadSupportInbox(inboxPath, { signal, force }) : null,
      onSnapshot: update,
      onConnection: (status, error) => setConnection({ key, status, error }),
    });
  }, [api, path, enabled, userId, key, update, inboxPath, conversationId, storeResources, conversationFeed, initialData]);
  return { data: result?.key === key ? result.data : cached || initialData, update,
    status: connection.key === key ? connection.status : "connecting", error: connection.key === key ? connection.error : "" };
};
