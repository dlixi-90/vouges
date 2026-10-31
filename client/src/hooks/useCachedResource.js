import { useCallback, useEffect, useRef, useState } from "react";

// A memoized resource owns its request; late responses never replace a newer key.
// Previous data may be retained only within the same public/account resource scope.
export default function useCachedResource(resource, { scope = "", keepPrevious = false, delay = 0 } = {}) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const force = useRef(false);
  const reload = useCallback(() => { force.current = true; setAttempt(value => value + 1); }, []);
  const current = result?.resource === resource && result.attempt === attempt ? result : null;
  const cached = resource?.peek();
  const data = cached ?? current?.data ?? (keepPrevious && result?.scope === scope ? result.data : null);
  const pending = Boolean(resource && !current);

  useEffect(() => {
    if (!resource) return;
    const controller = new AbortController();
    const refresh = force.current; force.current = false;
    const read = async () => {
      try {
        let data;
        try { data = await resource.load({ force: refresh, signal: controller.signal }); }
        catch (error) {
          if (controller.signal.aborted) return;
          if (error.name !== "AbortError" && error.code !== "ERR_CANCELED") throw error;
          // A write may invalidate a shared cache while this screen still needs it.
          data = await resource.load({ force: true, signal: controller.signal });
        }
        if (!controller.signal.aborted) setResult({ resource, scope, attempt, data, error: "" });
      } catch (error) {
        if (controller.signal.aborted) return;
        setResult(previous => ({ resource, scope, attempt, data: resource.peek() ?? (keepPrevious && previous?.scope === scope ? previous.data : null), error: error.response?.data?.message || error.message || "Không thể tải dữ liệu. Vui lòng thử lại." }));
      }
    };
    const wait = resource.peek() === undefined ? delay : 0;
    const timer = wait ? window.setTimeout(read, wait) : null;
    if (!wait) read();
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [resource, scope, keepPrevious, delay, attempt]);
  return { data, loading: pending, initialLoading: pending && !data, updating: pending && Boolean(data), error: current?.error || "", reload };
}
