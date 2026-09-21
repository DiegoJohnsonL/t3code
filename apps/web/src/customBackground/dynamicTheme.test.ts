import { Hct, argbFromHex } from "@material/material-color-utilities";
import { THEME_COLOR_ROLES } from "@t3tools/shared/themePalettes";
import { expect, it } from "vite-plus/test";

import { backgroundThemeColors } from "./dynamicTheme";

const TEAL = argbFromHex("#2f8f93");

function hue(color: string): number {
  return Hct.fromInt(argbFromHex(color)).hue;
}

it("fills every theme role with a usable color", () => {
  for (const appearance of ["light", "dark"] as const) {
    const colors = backgroundThemeColors(TEAL, appearance);
    for (const role of THEME_COLOR_ROLES) {
      expect(colors[role], `${appearance} ${role}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  }
});

it("carries the seed hue into the accent and keeps warnings amber", () => {
  const colors = backgroundThemeColors(TEAL, "dark");
  expect(Math.abs(hue(colors.accent) - Hct.fromInt(TEAL).hue)).toBeLessThan(20);
  // A warning that drifted to the seed hue would stop reading as a warning.
  expect(hue(colors.warning)).toBeGreaterThan(50);
  expect(hue(colors.warning)).toBeLessThan(110);
});

it("puts the canvas on opposite sides of the tone scale per appearance", () => {
  const dark = Hct.fromInt(argbFromHex(backgroundThemeColors(TEAL, "dark").canvas)).tone;
  const light = Hct.fromInt(argbFromHex(backgroundThemeColors(TEAL, "light").canvas)).tone;
  expect(dark).toBeLessThan(20);
  expect(light).toBeGreaterThan(80);
});
