import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";

export default function useCollectionPage(params) {
  const { publicCatalog } = useAppContext();
  const requestKey = JSON.stringify(params);
  const cached = publicCatalog.peekBrowse(params);
  const [result, setResult] = useState({ key: "", data: null, error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    publicCatalog.browse(JSON.parse(requestKey)).then(data => {
      if (active) setResult({ key: requestKey, data, error: "" });
    }).catch(error => {
      if (active) setResult(current => ({ ...current, key: requestKey, error: error.message }));
    });
    return () => { active = false; };
  }, [publicCatalog, requestKey, retry]);
  return { data: cached || result.data, loading: result.key !== requestKey && !cached,
    error: result.key === requestKey ? result.error : "", reload: () => setRetry(value => value + 1) };
}
