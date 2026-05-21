import { useCallback, useState } from "react";

export function useRefresh() {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { tick, refresh };
}
