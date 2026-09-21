import {
  CUSTOM_BACKGROUND_FILTERS,
  CUSTOM_BACKGROUND_NAME_MAX_LENGTH,
  CUSTOM_BACKGROUND_ROTATION_MINUTE_OPTIONS,
  CUSTOM_BACKGROUND_ROTATION_ORDERS,
  CUSTOM_BACKGROUND_TRANSITIONS,
  type CustomBackgroundImageId,
  type CustomBackgroundImageSource,
  type CustomBackgroundSource,
  IMAGE_DITHERING_PRESETS,
  type ImageDitheringPreset,
  type CustomBackgroundFilterKind,
  type CustomBackgroundRecord,
  MAX_CUSTOM_BACKGROUND_FADE,
  MIN_CUSTOM_BACKGROUND_FADE,
  defaultCustomBackgroundFilter,
} from "@t3tools/contracts";
import {
  BanIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useBackgroundStudioStore } from "~/customBackground/backgroundStudioStore";
import { storeBackgroundImage } from "~/customBackground/imageStore";
import { stepBackgroundImage } from "~/customBackground/rotationOffsetStore";
import { isWebGlAvailable } from "~/customBackground/webgl";
import {
  type CustomBackgroundLibrary,
  appendBackgroundImage,
  createEmptyBackground,
  sourcesEqual,
  toggleBackgroundImage,
  filtersEqual,
  nextActiveAfterRemove,
  nextNewBackgroundName,
  removeBackground,
  upsertBackground,
  withFilterKind,
} from "~/customBackground/records";
import { getClientSettings, useClientSettings, useUpdateClientSettings } from "~/hooks/useSettings";
import { cn, randomUUID } from "~/lib/utils";
import { ensureLocalApi } from "~/localApi";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { Menu, MenuPopup, MenuTrigger } from "../ui/menu";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
  selectTriggerVariants,
} from "../ui/select";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { BackgroundControls, RangeControl, StudioField } from "./BackgroundControls";
import {
  BackgroundImagePicker,
  BackgroundThumbnail,
  backgroundPickerDeleteButtonClass,
  backgroundPickerMenuGridClass,
  backgroundPickerTileClass,
  backgroundStudioFieldClass,
} from "./BackgroundImagePicker";

const FILTER_LABELS: Readonly<Record<CustomBackgroundFilterKind, string>> = {
  none: "No filter",
  "image-dithering": "Dithering",
};

function uploadLabel(upload: { busy: boolean; done: number; total: number }): string | null {
  if (!upload.busy) return null;
  if (upload.total < 2) return "Preparing image…";
  return `Preparing ${Math.min(upload.done + 1, upload.total)} of ${upload.total}…`;
}

function isFilterKind(value: unknown): value is CustomBackgroundFilterKind {
  return typeof value === "string" && Object.hasOwn(FILTER_LABELS, value);
}

const PERSIST_DEBOUNCE_MS = 150;
const UPLOAD_CONCURRENCY = 4;

const FADE_CONTROLS = [
  { key: "fade", label: "Bottom fade" },
  { key: "fadeHeight", label: "Fade height" },
  { key: "dim", label: "Dim" },
  { key: "opacity", label: "Image opacity" },
] as const satisfies ReadonlyArray<{ key: keyof CustomBackgroundRecord; label: string }>;

function describeUploadFailure(reason: string): string {
  switch (reason) {
    case "too-large":
      return "This image is too large to store. Choose a smaller one.";
    case "quota":
      return "This browser is out of storage for images. Delete unused images and try again.";
    case "unavailable":
      return "Image storage is unavailable in this browser context.";
    default:
      return "Could not read this image.";
  }
}

function NameField({ name, onCommit }: { name: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(name);
  const commit = () => {
    const trimmed = draft.trim().slice(0, CUSTOM_BACKGROUND_NAME_MAX_LENGTH);
    if (trimmed.length === 0) {
      setDraft(name);
      return;
    }
    if (trimmed !== name) onCommit(trimmed);
  };
  return (
    <Input
      aria-label="Background name"
      size="sm"
      unstyled
      className={backgroundStudioFieldClass(
        "[&_[data-slot=input]]:h-full sm:[&_[data-slot=input]]:h-full",
      )}
      value={draft}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function DitheringPresetRow({
  record,
  onPick,
}: {
  record: CustomBackgroundRecord;
  onPick: (preset: ImageDitheringPreset) => void;
}) {
  if (record.filter.kind !== "image-dithering") return null;
  const current = record.filter;
  return (
    <StudioField label="Look" align="start">
      <div
        className="flex min-w-0 flex-1 flex-wrap gap-1.5"
        role="group"
        aria-label="Dithering look"
      >
        {IMAGE_DITHERING_PRESETS.map((preset) => {
          const active =
            filtersEqual(current, preset.filter) &&
            (preset.fade === undefined ||
              (record.fade === preset.fade.fade &&
                record.fadeHeight === preset.fade.fadeHeight &&
                record.dim === preset.fade.dim));
          return (
            <Button
              key={preset.id}
              size="xs"
              variant={active ? "secondary" : "outline"}
              aria-pressed={active}
              onClick={() => onPick(preset)}
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full border border-border/60"
                style={{
                  background: preset.filter.originalColors
                    ? "conic-gradient(#f87171, #facc15, #4ade80, #60a5fa, #c084fc, #f87171)"
                    : `linear-gradient(135deg, ${preset.filter.colorHighlight}, ${preset.filter.colorFront} 55%, ${preset.filter.colorBack})`,
                }}
              />
              {preset.name}
            </Button>
          );
        })}
      </div>
    </StudioField>
  );
}

const ROTATION_ORDER_LABELS: Readonly<Record<CustomBackgroundImageSource["order"], string>> = {
  sequential: "In order",
  shuffle: "Shuffle",
};

const TRANSITION_LABELS: Readonly<Record<CustomBackgroundImageSource["transition"], string>> = {
  cut: "Cut",
  fade: "Fade",
};

function SourceOptionField<Value extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: Value;
  options: ReadonlyArray<Value>;
  labels: Readonly<Record<Value, string>>;
  onChange: (value: Value) => void;
}) {
  return (
    <StudioField label={label}>
      <Select
        value={value}
        onValueChange={(next) => {
          const match = options.find((option) => option === next);
          if (match !== undefined) onChange(match);
        }}
      >
        <SelectTrigger
          size="sm"
          className="min-h-0 h-7.5 min-w-0 flex-1 sm:h-6.5 sm:min-h-0"
          aria-label={label}
        >
          <SelectValue>{labels[value]}</SelectValue>
        </SelectTrigger>
        <SelectPopup align="end" alignItemWithTrigger={false}>
          {options.map((option) => (
            <SelectItem key={option} hideIndicator value={option}>
              {labels[option]}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </StudioField>
  );
}

function RotationFields({
  source,
  onChange,
}: {
  source: CustomBackgroundImageSource;
  onChange: (source: CustomBackgroundImageSource) => void;
}) {
  const rotating = source.imageIds.length > 1;
  return (
    <>
      <h3 className="text-[13px] font-medium">Rotation</h3>
      {rotating ? null : (
        <p className="text-xs text-muted-foreground">
          Pick two or more images to rotate through them. These settings apply once you do.
        </p>
      )}
      <RotationIntervalField source={source} onChange={onChange} />
      <SourceOptionField
        label="Order"
        value={source.order}
        options={CUSTOM_BACKGROUND_ROTATION_ORDERS}
        labels={ROTATION_ORDER_LABELS}
        onChange={(order) => onChange({ ...source, order })}
      />
      <SourceOptionField
        label="Transition"
        value={source.transition}
        options={CUSTOM_BACKGROUND_TRANSITIONS}
        labels={TRANSITION_LABELS}
        onChange={(transition) => onChange({ ...source, transition })}
      />
      {rotating ? <RotationStepRow /> : null}
    </>
  );
}

function RotationStepRow() {
  return (
    <StudioField label="Preview">
      <div className="flex gap-1.5">
        <Button size="xs" variant="outline" onClick={() => stepBackgroundImage(-1)}>
          <ChevronLeftIcon /> Previous
        </Button>
        <Button size="xs" variant="outline" onClick={() => stepBackgroundImage(1)}>
          Next <ChevronRightIcon />
        </Button>
      </div>
    </StudioField>
  );
}

function formatRotationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${minutes / 60} h`;
  return "1 day";
}

function RotationIntervalField({
  source,
  onChange,
}: {
  source: CustomBackgroundImageSource;
  onChange: (source: CustomBackgroundImageSource) => void;
}) {
  return (
    <StudioField label="Change every">
      <Select
        value={String(source.rotationMinutes)}
        onValueChange={(value) => {
          const minutes = Number(value);
          if (Number.isInteger(minutes)) onChange({ ...source, rotationMinutes: minutes });
        }}
      >
        <SelectTrigger
          size="sm"
          className="min-h-0 h-7.5 min-w-0 flex-1 sm:h-6.5 sm:min-h-0"
          aria-label="Rotation interval"
        >
          <SelectValue>{formatRotationMinutes(source.rotationMinutes)}</SelectValue>
        </SelectTrigger>
        <SelectPopup align="end" alignItemWithTrigger={false}>
          {CUSTOM_BACKGROUND_ROTATION_MINUTE_OPTIONS.map((minutes) => (
            <SelectItem key={minutes} hideIndicator value={String(minutes)}>
              {formatRotationMinutes(minutes)}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </StudioField>
  );
}

function libraryPreview(record: CustomBackgroundRecord | null): {
  name: string;
  filter: string;
} {
  if (record === null) return { name: "None", filter: "Plain theme" };
  return { name: record.name, filter: FILTER_LABELS[record.filter.kind] };
}

function LibraryThumb({
  record,
  className,
}: {
  record: CustomBackgroundRecord | null;
  className: string;
}) {
  const imageId = record?.source.kind === "image" ? (record.source.imageIds[0] ?? null) : null;
  if (record === null) {
    return (
      <span
        className={cn(
          "flex items-center justify-center border border-dashed border-border bg-muted/40 text-muted-foreground",
          className,
        )}
      >
        <BanIcon className="size-4" />
      </span>
    );
  }
  return <BackgroundThumbnail imageId={imageId} className={className} />;
}

function LibraryTile({
  record,
  selected,
  onSelect,
  onDelete,
}: {
  record: CustomBackgroundRecord | null;
  selected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const { name, filter } = libraryPreview(record);
  return (
    <div className="group relative min-w-0">
      <button
        type="button"
        aria-label={`${name}, ${filter}`}
        aria-pressed={selected}
        onClick={onSelect}
        className={backgroundPickerTileClass(selected)}
      >
        <LibraryThumb record={record} className="aspect-[4/3] w-full" />
        <span className="block space-y-0.5 px-1.5 py-1.5">
          <span className="block truncate text-xs text-foreground">{name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{filter}</span>
        </span>
      </button>
      {onDelete ? (
        <Button
          size="icon-xs"
          variant="outline"
          className={backgroundPickerDeleteButtonClass}
          aria-label={`Delete background ${name}`}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      ) : null}
    </div>
  );
}

function LibraryPicker({
  library,
  selectedId,
  selectedRecord,
  onSelect,
  onDelete,
}: {
  library: CustomBackgroundLibrary;
  selectedId: string | null;
  selectedRecord: CustomBackgroundRecord | null;
  onSelect: (id: string | null) => void;
  onDelete: (record: CustomBackgroundRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const { name, filter } = libraryPreview(selectedRecord);
  const pick = (id: string | null) => {
    onSelect(id);
    setOpen(false);
  };
  return (
    <Menu open={open} onOpenChange={setOpen}>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={`Background: ${name}, ${filter}`}
            className={cn(
              selectTriggerVariants({ size: "default" }),
              "h-auto w-full items-center py-1.5",
            )}
          >
            <LibraryThumb record={selectedRecord} className="size-8 shrink-0 rounded-md" />
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate text-sm font-medium text-foreground">{name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{filter}</span>
            </span>
            <ChevronsUpDownIcon className="-me-1 size-4 opacity-80" />
          </button>
        }
      />
      <MenuPopup align="start" className="w-(--anchor-width) min-w-80">
        <div className={cn(backgroundPickerMenuGridClass, "gap-2.5")}>
          <LibraryTile
            record={null}
            selected={selectedRecord === null}
            onSelect={() => pick(null)}
          />
          {library.map((entry) => {
            const tileRecord =
              selectedRecord && entry.id === selectedRecord.id ? selectedRecord : entry;
            return (
              <LibraryTile
                key={entry.id}
                record={tileRecord}
                selected={entry.id === selectedId}
                onSelect={() => pick(entry.id)}
                onDelete={() => onDelete(tileRecord)}
              />
            );
          })}
        </div>
      </MenuPopup>
    </Menu>
  );
}

export function BackgroundStudioPanel() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const library = useClientSettings((settings) => settings.customBackgrounds);
  const activeId = useClientSettings((settings) => settings.activeCustomBackgroundId);
  const enabled = useClientSettings((settings) => settings.customBackgroundEnabled);
  const updateSettings = useUpdateClientSettings();

  const selectedId = activeId;
  const liveRecord = useBackgroundStudioStore((store) => store.preview);
  const setLiveRecord = useBackgroundStudioStore((store) => store.setPreview);
  const [upload, setUpload] = useState<{
    busy: boolean;
    error: string | null;
    done: number;
    total: number;
  }>({ busy: false, error: null, done: 0, total: 0 });
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flush the latest edit on unmount without waiting for a React update.
  const pendingRef = useRef<CustomBackgroundRecord | null>(null);

  const storedRecord = useMemo(
    () => (selectedId === null ? null : (library.find((r) => r.id === selectedId) ?? null)),
    [library, selectedId],
  );
  const record = liveRecord && liveRecord.id === selectedId ? liveRecord : storedRecord;
  const persistLibrary = useCallback(
    (next: CustomBackgroundLibrary, nextActiveId?: string | null) => {
      updateSettings(
        nextActiveId === undefined
          ? { customBackgrounds: next }
          : {
              customBackgrounds: next,
              activeCustomBackgroundId: nextActiveId,
            },
      );
    },
    [updateSettings],
  );

  const flushPending = useCallback(() => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) {
      persistLibrary(upsertBackground(getClientSettings().customBackgrounds, pending));
    }
    setLiveRecord(null);
  }, [persistLibrary, setLiveRecord]);

  const commitRecord = useCallback(
    (next: CustomBackgroundRecord) => {
      pendingRef.current = next;
      setLiveRecord(next);
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(flushPending, PERSIST_DEBOUNCE_MS);
    },
    [flushPending, setLiveRecord],
  );

  useEffect(() => flushPending, [flushPending]);

  const selectRow = (id: string | null) => {
    flushPending();
    if (id !== activeId) updateSettings({ activeCustomBackgroundId: id });
  };

  const addRecord = (next: CustomBackgroundRecord) => {
    flushPending();
    persistLibrary(upsertBackground(getClientSettings().customBackgrounds, next), next.id);
  };

  // A few files encode at once; each decode holds a full bitmap in memory, so
  // the pool stays small. Results keep the order the files were picked in.
  const uploadImages = async (files: ReadonlyArray<File>) => {
    setUpload({ busy: true, error: null, done: 0, total: files.length });
    const stored: Array<CustomBackgroundImageId | null> = files.map(() => null);
    let error: string | null = null;
    let next = 0;
    const worker = async () => {
      while (next < files.length && mounted.current) {
        const index = next;
        next += 1;
        const result = await storeBackgroundImage(files[index]!);
        if (result.ok) stored[index] = result.image.id;
        else error = describeUploadFailure(result.reason);
        if (mounted.current) setUpload((previous) => ({ ...previous, done: previous.done + 1 }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker));
    if (!mounted.current) return [];
    setUpload({ busy: false, error, done: 0, total: 0 });
    return stored.filter((id) => id !== null);
  };

  const createBackground = () => {
    addRecord(
      createEmptyBackground({
        id: randomUUID(),
        name: nextNewBackgroundName(getClientSettings().customBackgrounds),
        filter: defaultCustomBackgroundFilter("none"),
        createdAt: new Date().toISOString(),
      }),
    );
  };

  const deleteBackground = async (record: CustomBackgroundRecord) => {
    const confirmed = await ensureLocalApi().dialogs.confirm(
      `Delete background "${record.name}"?\nIts image stays available to other backgrounds.`,
      { variant: "destructive" },
    );
    if (!confirmed || !mounted.current) return;
    flushPending();
    const current = getClientSettings();
    persistLibrary(
      removeBackground(current.customBackgrounds, record.id),
      nextActiveAfterRemove(current.activeCustomBackgroundId, record.id),
    );
  };

  const referencedImageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of library) {
      if (entry.source.kind === "image") for (const id of entry.source.imageIds) ids.add(id);
    }
    return ids;
  }, [library]);

  const filtersAvailable = isWebGlAvailable();
  const filterIsDefault =
    record !== null &&
    filtersEqual(record.filter, defaultCustomBackgroundFilter(record.filter.kind));

  return (
    <div className="@container/studio flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            Enable custom background
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => updateSettings({ customBackgroundEnabled: checked })}
            />
          </label>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-foreground">Playlist</span>
          <Button size="xs" variant="outline" aria-label="Add playlist" onClick={createBackground}>
            <PlusIcon /> New playlist
          </Button>
        </div>
        <LibraryPicker
          library={library}
          selectedId={selectedId}
          selectedRecord={record}
          onSelect={selectRow}
          onDelete={(entry) => void deleteBackground(entry)}
        />
      </div>
      {record ? (
        <div className="space-y-4">
          <StudioField label="Name">
            <NameField
              key={record.id}
              name={record.name}
              onCommit={(name) =>
                commitRecord({
                  ...record,
                  name,
                })
              }
            />
          </StudioField>
          <BackgroundImagePicker
            selectedImageIds={record.source.kind === "image" ? record.source.imageIds : []}
            referencedImageIds={referencedImageIds}
            busy={upload.busy}
            busyLabel={uploadLabel(upload)}
            onToggle={(imageId) =>
              commitRecord({
                ...record,
                source: toggleBackgroundImage(record.source, imageId),
              })
            }
            onUpload={(files) => {
              void uploadImages(files).then((imageIds) => {
                if (imageIds.length > 0) {
                  flushPending();
                  const current = getClientSettings().customBackgrounds;
                  // Add the image only to a surviving record whose images
                  // did not change meanwhile. Edits made during encoding,
                  // including edits to another selection, win.
                  persistLibrary(
                    current.map((entry) =>
                      entry.id === record.id && sourcesEqual(entry.source, record.source)
                        ? {
                            ...entry,
                            source: imageIds.reduce<CustomBackgroundSource>(
                              appendBackgroundImage,
                              entry.source,
                            ),
                          }
                        : entry,
                    ),
                  );
                }
              });
            }}
          />
          {record.source.kind === "image" ? (
            <RotationFields
              source={record.source}
              onChange={(source) => commitRecord({ ...record, source })}
            />
          ) : null}

          <h3 className="text-[13px] font-medium">Filter</h3>
          {!filtersAvailable ? (
            <p role="status" className="text-xs text-muted-foreground">
              Filters need WebGL to be active.
            </p>
          ) : null}
          <StudioField label="Filter">
            <Select
              disabled={!filtersAvailable}
              value={record.filter.kind}
              onValueChange={(kind) => {
                if (isFilterKind(kind)) commitRecord(withFilterKind(record, kind));
              }}
            >
              <SelectTrigger
                size="sm"
                className="min-h-0 h-7.5 min-w-0 flex-1 sm:h-6.5 sm:min-h-0"
                aria-label="Filter"
              >
                <SelectValue>{FILTER_LABELS[record.filter.kind]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                <SelectItem hideIndicator value="none">
                  {FILTER_LABELS.none}
                </SelectItem>
                {CUSTOM_BACKGROUND_FILTERS.map(({ kind }) => (
                  <SelectItem key={kind} hideIndicator value={kind}>
                    {FILTER_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            {filtersAvailable && !filterIsDefault && record.filter.kind !== "none" ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-sm"
                      variant="ghost-muted"
                      aria-label="Reset filter to defaults"
                      onClick={() =>
                        commitRecord({
                          ...record,
                          filter: defaultCustomBackgroundFilter(record.filter.kind),
                        })
                      }
                    >
                      <Undo2Icon />
                    </Button>
                  }
                />
                <TooltipPopup side="top">Reset filter to defaults</TooltipPopup>
              </Tooltip>
            ) : null}
          </StudioField>

          {upload.error ? (
            <p role="alert" className="text-xs text-destructive">
              {upload.error}
            </p>
          ) : null}

          {FADE_CONTROLS.map(({ key, label }) => (
            <RangeControl
              key={key}
              label={label}
              min={MIN_CUSTOM_BACKGROUND_FADE}
              max={MAX_CUSTOM_BACKGROUND_FADE}
              step={1}
              value={record[key]}
              format={(value) => `${Math.round(value)}%`}
              onChange={(value) =>
                commitRecord({
                  ...record,
                  [key]: Math.round(value),
                })
              }
            />
          ))}

          {filtersAvailable ? (
            <DitheringPresetRow
              record={record}
              onPick={(preset) =>
                commitRecord({ ...record, filter: preset.filter, ...preset.fade })
              }
            />
          ) : null}

          {filtersAvailable ? (
            <BackgroundControls
              filter={record.filter}
              onChange={(filter) =>
                commitRecord({
                  ...record,
                  filter,
                })
              }
            />
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-[13px] text-muted-foreground">
          Add a playlist to get started, or pick one to edit.
        </div>
      )}
    </div>
  );
}
