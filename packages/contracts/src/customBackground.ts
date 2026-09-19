import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { TrimmedNonEmptyString } from "./baseSchemas.ts";

export const CUSTOM_BACKGROUND_NAME_MAX_LENGTH = 80;

export const CustomBackgroundId = TrimmedNonEmptyString.check(Schema.isMaxLength(64));
export type CustomBackgroundId = typeof CustomBackgroundId.Type;

/** SHA-256 of the original upload, hex encoded. */
export const CustomBackgroundImageId = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/));
export type CustomBackgroundImageId = typeof CustomBackgroundImageId.Type;

export const CustomBackgroundName = TrimmedNonEmptyString.check(
  Schema.isMaxLength(CUSTOM_BACKGROUND_NAME_MAX_LENGTH),
);

/** `#rrggbb` or `#rrggbbaa`; shaders accept either. */
export const CustomBackgroundColor = Schema.String.check(
  Schema.isPattern(/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i),
);
export type CustomBackgroundColor = typeof CustomBackgroundColor.Type;

export interface NumberControlSpec {
  readonly kind: "number";
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly default: number;
  readonly integer?: boolean;
}

export interface SelectControlSpec<Option extends string = string> {
  readonly kind: "select";
  readonly label: string;
  readonly options: ReadonlyArray<Option>;
  readonly default: Option;
}

export interface BooleanControlSpec {
  readonly kind: "boolean";
  readonly label: string;
  readonly default: boolean;
}

export interface ColorControlSpec {
  readonly kind: "color";
  readonly label: string;
  readonly default: CustomBackgroundColor;
}

export interface ColorListControlSpec {
  readonly kind: "colors";
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly default: ReadonlyArray<CustomBackgroundColor>;
}

export type CustomBackgroundControlSpec =
  | NumberControlSpec
  | SelectControlSpec
  | BooleanControlSpec
  | ColorControlSpec
  | ColorListControlSpec;

function number(
  label: string,
  range: { min: number; max: number; step: number },
  defaultValue: number,
): NumberControlSpec {
  return { kind: "number", label, ...range, default: defaultValue };
}

function integer(
  label: string,
  range: { min: number; max: number },
  defaultValue: number,
): NumberControlSpec {
  return { kind: "number", label, ...range, step: 1, default: defaultValue, integer: true };
}

function select<const Option extends string>(
  label: string,
  options: ReadonlyArray<Option>,
  defaultValue: Option,
): SelectControlSpec<Option> {
  return { kind: "select", label, options, default: defaultValue };
}

function boolean(label: string, defaultValue: boolean): BooleanControlSpec {
  return { kind: "boolean", label, default: defaultValue };
}

function color(label: string, defaultValue: string): ColorControlSpec {
  return { kind: "color", label, default: defaultValue };
}

function colors(
  label: string,
  range: { min: number; max: number },
  defaultValue: ReadonlyArray<string>,
): ColorListControlSpec {
  return { kind: "colors", label, ...range, default: defaultValue };
}

const UNIT = { min: 0, max: 1, step: 0.01 } as const;
const SIGNED_UNIT = { min: -1, max: 1, step: 0.02 } as const;
const IMAGE_SCALE = { min: 0.1, max: 4, step: 0.04 } as const;
const PATTERN_SCALE = { min: 0.01, max: 4, step: 0.04 } as const;
const ROTATION = { min: 0, max: 360, step: 4 } as const;
/**
 * Shaders that read time render one frame at this offset (milliseconds) and
 * never animate, so scrubbing it picks a still.
 */
const VARIATION = { min: 0, max: 30_000, step: 250 } as const;

const fit = select("Fit", ["contain", "cover"], "cover");
const imageScale = number("Scale", IMAGE_SCALE, 1);
const grainMixer = number("Grain mixer", UNIT, 0);
const grainOverlay = number("Grain overlay", UNIT, 0);
const variation = number("Variation", VARIATION, 0);

type ControlSchema<Spec> =
  Spec extends SelectControlSpec<infer Option>
    ? Schema.Literals<ReadonlyArray<Option>>
    : Spec extends NumberControlSpec
      ? Schema.Number
      : Spec extends BooleanControlSpec
        ? Schema.Boolean
        : Spec extends ColorControlSpec
          ? typeof CustomBackgroundColor
          : Spec extends ColorListControlSpec
            ? Schema.$Array<typeof CustomBackgroundColor>
            : never;

type ControlFields<Controls extends Record<string, CustomBackgroundControlSpec>> = {
  readonly [Key in keyof Controls]: ControlSchema<Controls[Key]>;
};

function controlSchema(spec: CustomBackgroundControlSpec): Schema.Top {
  switch (spec.kind) {
    case "number": {
      const bounded = Schema.Finite.check(
        Schema.isBetween({ minimum: spec.min, maximum: spec.max }),
      );
      return spec.integer ? bounded.check(Schema.isInt()) : bounded;
    }
    case "select":
      return Schema.Literals(spec.options);
    case "boolean":
      return Schema.Boolean;
    case "color":
      return CustomBackgroundColor;
    case "colors":
      return Schema.Array(CustomBackgroundColor).check(
        Schema.isMinLength(spec.min),
        Schema.isMaxLength(spec.max),
      );
    default: {
      const _exhaustive: never = spec;
      return _exhaustive;
    }
  }
}

function controlFields<const Controls extends Record<string, CustomBackgroundControlSpec>>(
  controls: Controls,
): ControlFields<Controls> {
  const fields: Record<string, Schema.Top> = {};
  for (const [key, spec] of Object.entries(controls)) {
    fields[key] = controlSchema(spec);
  }
  // The loop above builds exactly one schema per spec kind, so the
  // record matches the mapped type; TypeScript cannot follow that
  // through `Object.entries`.
  return fields as ControlFields<Controls>;
}

type ControlDefaults<Controls extends Record<string, CustomBackgroundControlSpec>> = {
  readonly [Key in keyof Controls]: Controls[Key]["default"];
};

function controlDefaults<const Controls extends Record<string, CustomBackgroundControlSpec>>(
  controls: Controls,
): ControlDefaults<Controls> {
  const defaults: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(controls)) {
    defaults[key] = spec.default;
  }
  // Each spec's `default` is typed against its own value kind above.
  return defaults as ControlDefaults<Controls>;
}

// Control specs own the schema ranges, form controls, and starting values.
function defineFilter<
  const Kind extends string,
  const Controls extends Record<string, CustomBackgroundControlSpec>,
>(kind: Kind, controls: Controls) {
  const schema = Schema.Struct({
    kind: Schema.Literal(kind),
    ...controlFields(controls),
  });
  const defaults = { kind, ...controlDefaults(controls) };
  return { kind, controls, schema, defaults };
}

export const IMAGE_DITHERING_FILTER = defineFilter("image-dithering", {
  type: select("Type", ["random", "2x2", "4x4", "8x8"], "4x4"),
  size: number("Size", { min: 0.5, max: 20, step: 0.2 }, 3.4),
  colorSteps: integer("Color steps", { min: 1, max: 7 }, 5),
  originalColors: boolean("Original colors", true),
  inverted: boolean("Inverted", false),
  colorBack: color("Background", "#000c38"),
  colorFront: color("Foreground", "#94ffaf"),
  colorHighlight: color("Highlight", "#eaff94"),
  fit,
  scale: imageScale,
});

export const MIN_CUSTOM_BACKGROUND_FADE = 0;
export const MAX_CUSTOM_BACKGROUND_FADE = 100;
/** Opacity of the theme background at the bottom edge; 100 hides the picture there. */
export const DEFAULT_CUSTOM_BACKGROUND_FADE = 100;
/** Opacity of the theme background above the fade, where the picture shows most. */
export const DEFAULT_CUSTOM_BACKGROUND_DIM = 60;
/** How far up from the bottom edge, in percent of the pane, the fade climbs before it settles at the dim level. */
export const DEFAULT_CUSTOM_BACKGROUND_FADE_HEIGHT = 60;
export const CustomBackgroundFade = Schema.Int.check(
  Schema.isBetween({ minimum: MIN_CUSTOM_BACKGROUND_FADE, maximum: MAX_CUSTOM_BACKGROUND_FADE }),
);

export type ImageDitheringFilter = typeof IMAGE_DITHERING_FILTER.schema.Type;

export interface ImageDitheringPreset {
  readonly id: string;
  readonly name: string;
  readonly filter: ImageDitheringFilter;
  /** Only presets that define a look for the overlay set the fade sliders. */
  readonly fade?: { readonly fade: number; readonly dim: number; readonly fadeHeight: number };
}

/**
 * Starting points for the dithering filter. "Original" keeps the picture's
 * colors; the others quantize it to a tinted palette, the look popularized by
 * dot-matrix wallpapers, and every slider stays editable afterwards.
 */
export const IMAGE_DITHERING_PRESETS: ReadonlyArray<ImageDitheringPreset> = [
  {
    id: "original",
    name: "Original",
    filter: IMAGE_DITHERING_FILTER.defaults,
  },
  {
    id: "faded",
    name: "Faded",
    filter: IMAGE_DITHERING_FILTER.defaults,
    fade: { fade: 100, dim: 55, fadeHeight: 70 },
  },
  {
    id: "violet",
    name: "Violet",
    filter: {
      ...IMAGE_DITHERING_FILTER.defaults,
      type: "8x8",
      size: 3.4,
      colorSteps: 3,
      originalColors: false,
      colorBack: "#0a0914",
      colorFront: "#6d5ce0",
      colorHighlight: "#b8a9ff",
    },
  },
  {
    id: "terminal",
    name: "Terminal",
    filter: {
      ...IMAGE_DITHERING_FILTER.defaults,
      type: "4x4",
      size: 2.6,
      colorSteps: 3,
      originalColors: false,
    },
  },
  {
    id: "mono",
    name: "Mono",
    filter: {
      ...IMAGE_DITHERING_FILTER.defaults,
      type: "8x8",
      size: 3,
      colorSteps: 3,
      originalColors: false,
      colorBack: "#0a0a0a",
      colorFront: "#8a8a8a",
      colorHighlight: "#f2f2f2",
    },
  },
];

export const FLUTED_GLASS_FILTER = defineFilter("fluted-glass", {
  size: number("Size", { min: 0, max: 1, step: 0.001 }, 0.7),
  shape: select(
    "Shape",
    ["lines", "linesIrregular", "wave", "zigzag", "pattern"],
    "linesIrregular",
  ),
  angle: number("Angle", { min: 0, max: 180, step: 2 }, 30),
  distortion: number("Distortion", UNIT, 1),
  distortionShape: select(
    "Distortion shape",
    ["prism", "lens", "contour", "cascade", "flat"],
    "flat",
  ),
  shift: number("Shift", SIGNED_UNIT, 0),
  stretch: number("Stretch", UNIT, 1),
  highlights: number("Highlights", UNIT, 0),
  shadows: number("Shadows", UNIT, 0),
  edges: number("Edges", UNIT, 0.5),
  blur: number("Blur", UNIT, 1),
  margin: number("Margin", UNIT, 0),
  grainMixer: number("Grain mixer", UNIT, 0.1),
  grainOverlay: number("Grain overlay", UNIT, 0.1),
  colorBack: color("Background", "#00000000"),
  colorHighlight: color("Highlight", "#ffffff"),
  colorShadow: color("Shadow", "#000000"),
  fit,
  scale: number("Scale", IMAGE_SCALE, 4),
});

export const LENS_DISTORTION_FILTER = defineFilter("lens-distortion", {
  count: integer("Count", { min: 2, max: 50 }, 17),
  angle: number("Angle", ROTATION, 12),
  spread: number("Spread", UNIT, 0.08),
  lensCircle: number("Lens circle", UNIT, 0),
  lensBulge: number("Lens bulge", SIGNED_UNIT, -1),
  swirl: number("Swirl", SIGNED_UNIT, 0),
  bias: number("Bias", SIGNED_UNIT, 1),
  perspective: number("Perspective", UNIT, 0.18),
  dispersion: number("Dispersion", UNIT, 0.81),
  dispersionColor: number("Dispersion color", UNIT, 0.45),
  dispersionShift: number("Dispersion shift", SIGNED_UNIT, 0.18),
  focusCenter: number("Focus center", UNIT, 0.8),
  focusEdges: number("Focus edges", UNIT, 1),
  noise: number("Noise", UNIT, 0),
  noiseFrequency: number("Noise frequency", UNIT, 0.25),
  noiseOffset: number("Noise offset", UNIT, 0),
  grainMixer,
  grainOverlay,
  imageX: number("Image X", SIGNED_UNIT, 0),
  imageY: number("Image Y", SIGNED_UNIT, 0),
  fit: select("Fit", ["contain", "cover"], "contain"),
  scale: imageScale,
});

export const STATIC_MESH_GRADIENT_FILTER = defineFilter("static-mesh-gradient", {
  colors: colors("Colors", { min: 1, max: 10 }, ["#000000", "#000000", "#122d4e", "#2f6a6a"]),
  positions: integer("Positions", { min: 0, max: 100 }, 2),
  waveX: number("Wave X", UNIT, 1),
  waveXShift: number("Wave X shift", UNIT, 0.6),
  waveY: number("Wave Y", UNIT, 1),
  waveYShift: number("Wave Y shift", UNIT, 0.21),
  mixing: number("Mixing", UNIT, 0.93),
  grainMixer,
  grainOverlay,
  offsetX: number("Offset X", SIGNED_UNIT, 0),
  offsetY: number("Offset Y", SIGNED_UNIT, 0),
  rotation: number("Rotation", ROTATION, 270),
  scale: number("Scale", PATTERN_SCALE, 1),
});

export const GRAIN_GRADIENT_FILTER = defineFilter("grain-gradient", {
  colorBack: color("Background", "#000000"),
  colors: colors("Colors", { min: 1, max: 7 }, ["#22edee", "#fd0f9a", "#22d3ee", "#000000"]),
  shape: select(
    "Shape",
    ["wave", "dots", "truchet", "corners", "ripple", "blob", "sphere"],
    "wave",
  ),
  softness: number("Softness", UNIT, 0.7),
  intensity: number("Intensity", UNIT, 0.5),
  noise: number("Noise", UNIT, 0.2),
  variation,
  offsetX: number("Offset X", SIGNED_UNIT, 0),
  offsetY: number("Offset Y", SIGNED_UNIT, 0),
  rotation: number("Rotation", ROTATION, 0),
  scale: number("Scale", PATTERN_SCALE, 1),
});

export const CUSTOM_BACKGROUND_IMAGE_FILTERS = [
  IMAGE_DITHERING_FILTER,
  FLUTED_GLASS_FILTER,
  LENS_DISTORTION_FILTER,
] as const;

export const CUSTOM_BACKGROUND_GENERATIVE_FILTERS = [
  STATIC_MESH_GRADIENT_FILTER,
  GRAIN_GRADIENT_FILTER,
] as const;

export const CUSTOM_BACKGROUND_FILTERS = [
  ...CUSTOM_BACKGROUND_IMAGE_FILTERS,
  ...CUSTOM_BACKGROUND_GENERATIVE_FILTERS,
] as const;

export const NoCustomBackgroundFilter = Schema.Struct({ kind: Schema.Literal("none") });

export const CustomBackgroundFilter = Schema.Union([
  NoCustomBackgroundFilter,
  ...CUSTOM_BACKGROUND_FILTERS.map((filter) => filter.schema),
]);
export type CustomBackgroundFilter = typeof CustomBackgroundFilter.Type;
export type CustomBackgroundFilterKind = CustomBackgroundFilter["kind"];
export type CustomBackgroundImageFilterKind =
  (typeof CUSTOM_BACKGROUND_IMAGE_FILTERS)[number]["kind"];
export type CustomBackgroundGenerativeFilterKind =
  (typeof CUSTOM_BACKGROUND_GENERATIVE_FILTERS)[number]["kind"];

export const DEFAULT_CUSTOM_BACKGROUND_FILTER: CustomBackgroundFilter =
  IMAGE_DITHERING_FILTER.defaults;

export function isGenerativeCustomBackgroundFilter(
  kind: CustomBackgroundFilterKind,
): kind is CustomBackgroundGenerativeFilterKind {
  return CUSTOM_BACKGROUND_GENERATIVE_FILTERS.some((filter) => filter.kind === kind);
}

export function customBackgroundFilterControls(
  kind: Exclude<CustomBackgroundFilterKind, "none">,
): Readonly<Record<string, CustomBackgroundControlSpec>> {
  const filter = CUSTOM_BACKGROUND_FILTERS.find((candidate) => candidate.kind === kind);
  return filter ? filter.controls : {};
}

export function defaultCustomBackgroundFilter(
  kind: CustomBackgroundFilterKind,
): CustomBackgroundFilter {
  if (kind === "none") return { kind: "none" };
  const filter = CUSTOM_BACKGROUND_FILTERS.find((candidate) => candidate.kind === kind);
  return filter ? filter.defaults : DEFAULT_CUSTOM_BACKGROUND_FILTER;
}

export const MIN_CUSTOM_BACKGROUND_ROTATION_MINUTES = 1;
export const MAX_CUSTOM_BACKGROUND_ROTATION_MINUTES = 1440;
export const DEFAULT_CUSTOM_BACKGROUND_ROTATION_MINUTES = 10;
export const CUSTOM_BACKGROUND_ROTATION_MINUTE_OPTIONS = [
  1, 2, 5, 10, 15, 30, 60, 120, 360, 1440,
] as const;
export const CustomBackgroundRotationMinutes = Schema.Int.check(
  Schema.isBetween({
    minimum: MIN_CUSTOM_BACKGROUND_ROTATION_MINUTES,
    maximum: MAX_CUSTOM_BACKGROUND_ROTATION_MINUTES,
  }),
);

/**
 * One image is a rotation of one. With several, the client advances through
 * them in order every `rotationMinutes`, keyed off wall-clock time so every
 * pane and reload agrees on which image is up.
 */
export const CUSTOM_BACKGROUND_ROTATION_ORDERS = ["sequential", "shuffle"] as const;
export const CustomBackgroundRotationOrder = Schema.Literals(CUSTOM_BACKGROUND_ROTATION_ORDERS);
export type CustomBackgroundRotationOrder = typeof CustomBackgroundRotationOrder.Type;

export const CUSTOM_BACKGROUND_TRANSITIONS = ["cut", "fade", "zoom", "slide"] as const;
export const CustomBackgroundTransition = Schema.Literals(CUSTOM_BACKGROUND_TRANSITIONS);
export type CustomBackgroundTransition = typeof CustomBackgroundTransition.Type;

export const CustomBackgroundImageSource = Schema.Struct({
  kind: Schema.Literal("image"),
  imageIds: Schema.Array(CustomBackgroundImageId).check(Schema.isMinLength(1)),
  rotationMinutes: CustomBackgroundRotationMinutes.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_CUSTOM_BACKGROUND_ROTATION_MINUTES)),
  ),
  /** Shuffle plays every image once per round in a seeded order that never repeats across a round boundary. */
  order: CustomBackgroundRotationOrder.pipe(
    Schema.withDecodingDefault(Effect.succeed("sequential" as const)),
  ),
  transition: CustomBackgroundTransition.pipe(
    Schema.withDecodingDefault(Effect.succeed("fade" as const)),
  ),
});
export type CustomBackgroundImageSource = typeof CustomBackgroundImageSource.Type;

export const CustomBackgroundSource = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("none") }),
  CustomBackgroundImageSource,
]);
export type CustomBackgroundSource = typeof CustomBackgroundSource.Type;

const RetiredCustomBackgroundFilterKind = Schema.Literals([
  "paper-texture",
  "water",
  "halftone-dots",
  "halftone-cmyk",
]);

const RetiredCustomBackgroundFilter = Schema.Struct({
  kind: RetiredCustomBackgroundFilterKind,
}).pipe(
  Schema.decodeTo(
    NoCustomBackgroundFilter,
    SchemaTransformation.transform<
      { readonly kind: "none" },
      { readonly kind: typeof RetiredCustomBackgroundFilterKind.Type }
    >({
      decode: () => ({ kind: "none" }),
      // Encoding never takes this branch: `none` is a live filter kind.
      encode: () => ({ kind: "paper-texture" }),
    }),
  ),
);

const CustomBackgroundRecordFilter = Schema.Union([
  CustomBackgroundFilter,
  RetiredCustomBackgroundFilter,
]);

export const CustomBackgroundRecord = Schema.Struct({
  id: CustomBackgroundId,
  name: CustomBackgroundName,
  source: CustomBackgroundSource,
  filter: CustomBackgroundRecordFilter,
  fade: CustomBackgroundFade,
  dim: CustomBackgroundFade.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_CUSTOM_BACKGROUND_DIM)),
  ),
  fadeHeight: CustomBackgroundFade.pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_CUSTOM_BACKGROUND_FADE_HEIGHT)),
  ),
  createdAt: Schema.String,
});
export type CustomBackgroundRecord = typeof CustomBackgroundRecord.Type;

export const CustomBackgroundRecords = Schema.Array(CustomBackgroundRecord);
export type CustomBackgroundRecords = typeof CustomBackgroundRecords.Type;
