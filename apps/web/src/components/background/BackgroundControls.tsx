import {
  type BooleanControlSpec,
  type ColorControlSpec,
  CustomBackgroundFilter,
  type CustomBackgroundControlSpec,
  type NumberControlSpec,
  customBackgroundFilterControls,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { type CSSProperties, type ReactNode, useId, useMemo } from "react";

import { cn } from "~/lib/utils";
import { ThemeColorPicker } from "../settings/ThemeColorPicker";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

const decodeFilter = Schema.decodeUnknownSync(CustomBackgroundFilter);

function withParam(
  filter: CustomBackgroundFilter,
  key: string,
  value: unknown,
): CustomBackgroundFilter | null {
  try {
    return decodeFilter({ ...filter, [key]: value });
  } catch {
    return null;
  }
}

const SELECT_LABELS: Readonly<Record<string, string>> = {
  linesIrregular: "Irregular lines",
  "2x2": "2×2 Bayer",
  "4x4": "4×4 Bayer",
  "8x8": "8×8 Bayer",
};

function optionLabel(option: string): string {
  const known = SELECT_LABELS[option];
  if (known) return known;
  return option.charAt(0).toUpperCase() + option.slice(1);
}

function formatNumber(value: number, spec: NumberControlSpec): string {
  if (spec.integer) return String(Math.round(value));
  const decimals = spec.step >= 1 ? 0 : spec.step >= 0.1 ? 1 : spec.step >= 0.01 ? 2 : 3;
  return value.toFixed(decimals);
}

/**
 * One labelled control. The studio lives in the sidebar, which the user can
 * drag from 13rem up, so the label sits above its control until the container
 * is wide enough to put the two on one line.
 */
export function StudioField({
  label,
  htmlFor,
  align = "center",
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  /** `start` keeps a tall control, such as a wrapping button group, top-aligned. */
  align?: "center" | "start";
  children: ReactNode;
}) {
  const Label = htmlFor === undefined ? "span" : "label";
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 @sm/studio:flex-row @sm/studio:gap-3",
        align === "center" ? "@sm/studio:items-center" : "@sm/studio:items-start",
      )}
    >
      <Label
        htmlFor={htmlFor}
        className={cn(
          "truncate text-[13px] text-muted-foreground @sm/studio:w-28 @sm/studio:shrink-0",
          align === "start" && "@sm/studio:pt-1",
        )}
      >
        {label}
      </Label>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

export function RangeControl({
  id,
  label,
  min,
  max,
  step,
  value,
  format,
  onChange,
}: {
  id?: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const ratio = max === min ? 0 : (value - min) / (max - min);
  const style = {
    "--settings-slider-progress": `${ratio * 100}%`,
    "--settings-slider-fill-offset": `${0.5 - ratio}rem`,
  } as CSSProperties;
  return (
    <StudioField label={label} htmlFor={inputId}>
      <input
        aria-label={label}
        className="settings-slider min-w-0 flex-1"
        id={inputId}
        max={max}
        min={min}
        step={step}
        style={style}
        type="range"
        value={value}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
      <output
        className="min-w-12 shrink-0 rounded-md bg-muted px-2 py-1 text-center font-mono text-xs font-medium tabular-nums text-foreground"
        htmlFor={inputId}
      >
        {format(value)}
      </output>
    </StudioField>
  );
}

function BooleanControl({
  spec,
  value,
  onChange,
}: {
  spec: BooleanControlSpec;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <StudioField label={spec.label} htmlFor={id}>
      <Switch id={id} size="sm" checked={value} onCheckedChange={onChange} />
    </StudioField>
  );
}

function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 py-0.5 pr-2 pl-0.5">
      <ThemeColorPicker label={label} value={value} onChange={onChange} />
      <span className="max-w-24 truncate text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function isColorSpec(spec: CustomBackgroundControlSpec): spec is ColorControlSpec {
  return spec.kind === "color";
}

export function BackgroundControls({
  filter,
  onChange,
  className,
}: {
  filter: CustomBackgroundFilter;
  onChange: (filter: CustomBackgroundFilter) => void;
  className?: string;
}) {
  const controls = useMemo(
    () => (filter.kind === "none" ? {} : customBackgroundFilterControls(filter.kind)),
    [filter.kind],
  );
  const entries = Object.entries(controls);
  const colorEntries = entries.filter(([, spec]) => isColorSpec(spec));
  const otherEntries = entries.filter(([, spec]) => !isColorSpec(spec));
  const palettesHidden =
    "originalColors" in filter && typeof filter.originalColors === "boolean"
      ? filter.originalColors
      : false;

  const set = (key: string, value: unknown) => {
    const next = withParam(filter, key, value);
    if (next) onChange(next);
  };

  if (filter.kind === "none") return null;

  return (
    <div className={cn("space-y-3", className)}>
      {otherEntries.map(([key, spec]) => {
        const current: unknown = Reflect.get(filter, key);
        switch (spec.kind) {
          case "number":
            return (
              <RangeControl
                key={key}
                label={spec.label}
                min={spec.min}
                max={spec.max}
                step={spec.step}
                format={(value) => formatNumber(value, spec)}
                value={typeof current === "number" ? current : spec.default}
                onChange={(value) => set(key, value)}
              />
            );
          case "select":
            return (
              <StudioField key={key} label={spec.label}>
                <Select
                  value={typeof current === "string" ? current : spec.default}
                  onValueChange={(value) => {
                    if (typeof value === "string") set(key, value);
                  }}
                >
                  <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={spec.label}>
                    <SelectValue>
                      {optionLabel(typeof current === "string" ? current : spec.default)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="end" alignItemWithTrigger={false}>
                    {spec.options.map((option) => (
                      <SelectItem key={option} hideIndicator value={option}>
                        {optionLabel(option)}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </StudioField>
            );
          case "boolean":
            return (
              <BooleanControl
                key={key}
                spec={spec}
                value={typeof current === "boolean" ? current : spec.default}
                onChange={(value) => set(key, value)}
              />
            );
          default:
            return null;
        }
      })}
      {colorEntries.length > 0 && !palettesHidden ? (
        <StudioField label="Colors" align="start">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {colorEntries.map(([key, spec]) => {
              const current: unknown = Reflect.get(filter, key);
              if (spec.kind === "color") {
                return (
                  <ColorSwatch
                    key={key}
                    label={spec.label}
                    value={typeof current === "string" ? current : spec.default}
                    onChange={(value) => set(key, value)}
                  />
                );
              }
              return null;
            })}
          </div>
        </StudioField>
      ) : null}
    </div>
  );
}
