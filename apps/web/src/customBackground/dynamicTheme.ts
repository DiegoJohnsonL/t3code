import {
  type DynamicColor,
  Hct,
  MaterialDynamicColors as Material,
  SchemeTonalSpot,
  hexFromArgb,
} from "@material/material-color-utilities";

import type { ThemeAppearance, ThemeColors } from "~/themePalette";

/**
 * Tonal spot is the scheme Android defaults to for wallpaper colors. It keeps
 * chroma low enough that a saturated picture still yields surfaces someone can
 * read a diff on, which the vivid schemes do not.
 */
const CONTRAST_LEVEL = 0;
/** Amber, because Material has no warning role and a warning has to stay a warning. */
const WARNING_HUE = 80;
const WARNING_CHROMA = 70;

/**
 * Repaints every theme role from one seed color the way Material builds a
 * scheme from a wallpaper. Roles Material names directly are taken as they
 * come; the rest are pulled to an explicit tone so T3's own contrast steps
 * (sidebar darker than canvas, raised surfaces lighter than flat ones)
 * survive the translation.
 */
export function backgroundThemeColors(
  sourceColor: number,
  appearance: ThemeAppearance,
): ThemeColors {
  const dark = appearance === "dark";
  const scheme = new SchemeTonalSpot(Hct.fromInt(sourceColor), dark, CONTRAST_LEVEL);
  const color = (role: DynamicColor): string => hexFromArgb(role.getArgb(scheme));
  const tone = (role: DynamicColor, value: number): string => {
    const hct = role.getHct(scheme);
    return hexFromArgb(Hct.from(hct.hue, hct.chroma, value).toInt());
  };
  const warning = (value: number): string =>
    hexFromArgb(Hct.from(WARNING_HUE, WARNING_CHROMA, value).toInt());

  return {
    canvas: color(Material.surface),
    chrome: color(Material.surfaceContainerLow),
    toolbar: color(Material.surfaceContainerLow),
    toolbarForeground: color(Material.onSurface),
    toolbarBorder: color(Material.surfaceContainerHighest),
    toolbarControl: color(Material.surfaceContainerHigh),
    toolbarControlForeground: color(Material.onSurface),
    toolbarControlHover: color(Material.surfaceContainerHighest),
    surface: color(Material.surfaceContainer),
    surfaceRaised: color(Material.surfaceContainerHigh),
    surfaceOverlay: color(Material.surfaceContainerHigh),
    text: color(Material.onSurface),
    textMuted: color(Material.onSurfaceVariant),
    border: color(Material.surfaceContainerHighest),
    input: color(Material.surfaceContainerLowest),
    focus: color(Material.primary),
    accent: color(Material.primary),
    accentForeground: color(Material.onPrimary),
    secondary: color(Material.secondaryContainer),
    secondaryForeground: color(Material.onSecondaryContainer),
    muted: color(Material.surfaceContainer),
    mutedForeground: color(Material.onSurfaceVariant),
    placeholder: color(Material.onSurfaceVariant),
    secondaryLabel: color(Material.onSurfaceVariant),
    iconMuted: color(Material.onSurfaceVariant),
    error: color(Material.error),
    errorForeground: tone(Material.error, dark ? 75 : 40),
    errorSurface: color(Material.errorContainer),
    warning: warning(dark ? 70 : 45),
    warningForeground: warning(dark ? 80 : 35),
    warningSurface: warning(dark ? 18 : 92),
    update: color(Material.primary),
    updateForeground: tone(Material.primary, dark ? 80 : 40),
    updateSurface: color(Material.primaryContainer),
    accentSurface: color(Material.surfaceContainerHigh),
    accentSurfaceForeground: color(Material.onSurface),
    messageSurface: color(Material.surfaceContainerHigh),
    messageForeground: color(Material.onSurface),
    messageAction: color(Material.primary),
    messageActionForeground: color(Material.onPrimary),
    messageActionHover: tone(Material.primary, dark ? 70 : 35),
    codeBackground: color(Material.surfaceContainer),
    codeForeground: color(Material.onSurface),
    // The sidebar is T3's darkest plane in dark mode and its lightest in
    // light mode, which is the opposite end of the ladder from the canvas.
    sidebar: dark ? tone(Material.surface, 4) : color(Material.surfaceContainerLowest),
    sidebarForeground: color(Material.onSurface),
    sidebarMutedForeground: color(Material.onSurfaceVariant),
    sidebarControlSurface: color(Material.surfaceContainerLow),
    sidebarRowHover: color(Material.surfaceContainerLow),
    sidebarRowActive: color(Material.surfaceContainerHigh),
    sidebarRowSelected: color(Material.surfaceContainer),
    sidebarBorder: tone(Material.surface, dark ? 12 : 88),
    terminalBackground: color(Material.surface),
    terminalForeground: color(Material.onSurface),
    terminalCursor: color(Material.primary),
    terminalSelection: color(Material.secondaryContainer),
    terminalScrollbar: color(Material.surfaceContainerHighest),
    terminalScrollbarHover: color(Material.outlineVariant),
  };
}
