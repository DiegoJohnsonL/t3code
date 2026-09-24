import { describe, expect, it } from "vite-plus/test";

import { findDictationCorrections } from "./dictationCorrections.ts";

describe("findDictationCorrections", () => {
  it("finds words the user respelled inside the dictated text", () => {
    expect(
      findDictationCorrections({
        dictated: ["Bump the tan stack router version and redeploy on for sell."],
        sent: "Please bump the TanStack router version and redeploy on Vercel.",
      }),
    ).toEqual([
      { dictated: "tan stack", corrected: "TanStack" },
      { dictated: "for sell", corrected: "Vercel" },
    ]);
  });

  it("keeps a capitalized name whole", () => {
    expect(
      findDictationCorrections({
        dictated: ["Effect schema needs a new field."],
        sent: "Effect Schema needs a new field.",
      }),
    ).toEqual([{ dictated: "Effect schema", corrected: "Effect Schema" }]);
  });

  it("finds a respelling at the very start of a dictation", () => {
    expect(
      findDictationCorrections({
        dictated: ["tan stack needs an upgrade."],
        sent: "Note: TanStack needs an upgrade.",
      }),
    ).toEqual([{ dictated: "tan stack", corrected: "Note TanStack" }]);
  });

  it("ignores dictations the user rewrote or removed", () => {
    expect(
      findDictationCorrections({
        dictated: ["Fix the flaky login test before lunch.", "Also check the logs."],
        sent: "Actually, never mind. Ship it.",
      }),
    ).toEqual([]);
  });

  it("ignores text sent unchanged", () => {
    expect(
      findDictationCorrections({ dictated: ["Run the tests."], sent: "Run the tests." }),
    ).toEqual([]);
  });
});
