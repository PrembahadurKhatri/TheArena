import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/api/axios";
import { apiError } from "@/types";

/**
 * GET a URL and keep the result in state. Re-fetches when the URL or params
 * change; `reload()` fetches again (e.g. after a mutation). Pass `null` as
 * the URL to skip fetching.
 */
export function useApi<T>(url: string | null, params?: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params ?? {});
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    const clean = Object.fromEntries(Object.entries(paramsRef.current ?? {}).filter(([, v]) => v !== "" && v !== undefined && v !== null));
    api
      .get(url, { params: clean })
      .then(({ data }) => alive && setData(data))
      .catch((err) => alive && setError(apiError(err, "Something went wrong.")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url, key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload, setData };
}
