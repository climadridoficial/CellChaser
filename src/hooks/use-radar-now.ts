import { useEffect, useState } from "react";

/** Recheck scan expiry even when a failed provider leaves the cache unchanged. */
export function useRadarNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}