import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../context/AppContext";

export default function useProductFeed({ limit = 12, availability = "all", enabled = true } = {}) {
  const { publicCatalog } = useAppContext();
  const [state, setState] = useState(() => ({ data: publicCatalog.peekBrowse({ limit, availability }), error: "" }));
  const [attempt, setAttempt] = useState(0);
  const force = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const refresh = force.current; force.current = false;
    publicCatalog.browse({ limit, availability }, { force: refresh }).then(data => { if (active) setState({ data, error: "" }); })
      .catch(error => { if (active) setState(current => ({ ...current, error: error.message })); });
    return () => { active = false; };
  }, [publicCatalog, limit, availability, enabled, attempt]);
  return { products: state.data?.products || [], loading: enabled && !state.data && !state.error, error: state.error, reload: () => { force.current = true; setAttempt(value => value + 1); } };
}
