import { useAtomValue } from "@effect/atom-react";
import type { CustomBackgroundSource } from "@t3tools/contracts";
import {
  currentBackgroundImageId,
  nextBackgroundRotationAt,
  upcomingBackgroundImageId,
} from "@t3tools/shared/customBackgroundRotation";
import * as Equal from "effect/Equal";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useEffect, useState } from "react";

import { mobilePreferencesAtom } from "../../state/preferences";
import { environmentServerConfigsAtom } from "../../state/server";
import {
  type ComputerBackgroundSource,
  selectComputerBackground,
} from "./computerBackground.logic";

let previousSource: ComputerBackgroundSource | null = null;

// Server configs refresh for unrelated reasons; only a changed background may re-render.
const computerBackgroundSourceAtom = Atom.make((get) => {
  const next = selectComputerBackground(get(environmentServerConfigsAtom));
  if (!Equal.equals(next, previousSource)) previousSource = next;
  return previousSource;
}).pipe(Atom.withLabel("computer-background-source"));

/** The background a connected computer publishes, whether or not this phone shows it. */
export function usePublishedComputerBackground(): ComputerBackgroundSource | null {
  return useAtomValue(computerBackgroundSourceAtom);
}

export function useComputerBackgroundEnabled(): boolean {
  const preferences = useAtomValue(mobilePreferencesAtom);
  return !(
    AsyncResult.isSuccess(preferences) && preferences.value.computerBackgroundEnabled === false
  );
}

/** The background a connected computer publishes, unless this phone turned it off. */
export function useComputerBackgroundSource(): ComputerBackgroundSource | null {
  const source = usePublishedComputerBackground();
  return useComputerBackgroundEnabled() ? source : null;
}

const NO_SOURCE: CustomBackgroundSource = { kind: "none" };

/** The picture showing now and the next one, on the same wall clock the desktop rotates by. */
export function useComputerBackgroundImage(source: CustomBackgroundSource | null) {
  const rotation = source ?? NO_SOURCE;
  const [now, setNow] = useState(Date.now);
  const wakeAt = nextBackgroundRotationAt(rotation, now);
  useEffect(() => {
    if (wakeAt === null) return;
    const timer = setTimeout(
      () => setNow(Math.max(Date.now(), wakeAt)),
      Math.max(0, wakeAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [wakeAt]);
  return {
    current: currentBackgroundImageId(rotation, now),
    upcoming: upcomingBackgroundImageId(rotation, now),
  };
}
