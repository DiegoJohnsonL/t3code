import { useAtomValue } from "@effect/atom-react";
import type { CustomBackgroundSource, PhoneBackground } from "@t3tools/contracts";
import {
  currentBackgroundImageId,
  nextBackgroundRotationAt,
  upcomingBackgroundImageId,
} from "@t3tools/shared/customBackgroundRotation";
import * as Equal from "effect/Equal";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { useEffect, useState } from "react";

import { mobilePreferencesAtom } from "../../state/preferences";

let previousBackground: PhoneBackground | null = null;

// Preferences save for unrelated reasons; only a changed background may re-render.
const phoneBackgroundAtom = Atom.make((get) => {
  const preferences = get(mobilePreferencesAtom);
  const next = AsyncResult.isSuccess(preferences)
    ? (preferences.value.phoneBackground ?? null)
    : null;
  if (!Equal.equals(next, previousBackground)) previousBackground = next;
  return previousBackground;
}).pipe(Atom.withLabel("phone-background"));

/** The phone's own background, whether or not it is showing. */
export function usePhoneBackground(): PhoneBackground | null {
  return useAtomValue(phoneBackgroundAtom);
}

export function usePhoneBackgroundEnabled(): boolean {
  const preferences = useAtomValue(mobilePreferencesAtom);
  return !(
    AsyncResult.isSuccess(preferences) && preferences.value.phoneBackgroundEnabled === false
  );
}

/** The phone's background, unless it is switched off. */
export function useShownPhoneBackground(): PhoneBackground | null {
  const background = usePhoneBackground();
  return usePhoneBackgroundEnabled() ? background : null;
}

const NO_SOURCE: CustomBackgroundSource = { kind: "none" };

/** The picture showing now and the next one, on the same wall clock the desktop rotates by. */
export function usePhoneBackgroundImage(source: CustomBackgroundSource | null) {
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
