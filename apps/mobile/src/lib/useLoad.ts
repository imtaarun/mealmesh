import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ApiError } from "./api-client";

export const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong. Try again.");

/** Loads on focus, keeps the last data while refreshing, and turns failures into a message. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    load().then(setData, (err) => setError(messageOf(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useFocusEffect(reload);

  return { data, setData, error, reload };
}
