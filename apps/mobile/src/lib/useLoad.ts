import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ApiError } from "./api-client";

export const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong. Try again.");

/**
 * Loads once, and again whenever the screen comes back into focus unless `onFocus` is
 * false (detail screens whose data only changes on them). Keeps the last data while
 * refreshing, and turns failures into a message.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = [], { onFocus = true } = {}) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const reload = useCallback(() => {
    setError(null);
    load().then((value) => {
      loaded.current = true;
      setData(value);
    }, (err) => setError(messageOf(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useFocusEffect(
    useCallback(() => {
      if (onFocus || !loaded.current) reload();
    }, [reload, onFocus]),
  );

  return { data, setData, error, reload };
}
