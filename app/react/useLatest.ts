import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

/**
 * Keeps the newest value in a ref. The ref is refreshed in an effect, so call
 * this hook before any effect that reads the ref.
 */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
