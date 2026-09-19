import type { CustomBackgroundSource } from "@t3tools/contracts";
import { useEffect, useState } from "react";

import { nextBackgroundRotationAt } from "./records";

/**
 * Wall-clock time that re-renders exactly when the source's next image is due.
 * Sources with one image never tick.
 */
export function useRotationClock(source: CustomBackgroundSource): number {
  const [now, setNow] = useState(() => Date.now());
  const wakeAt = nextBackgroundRotationAt(source, now);
  useEffect(() => {
    if (wakeAt === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, wakeAt - Date.now()));
    return () => clearTimeout(timer);
  }, [wakeAt]);
  return wakeAt === null ? 0 : now;
}
