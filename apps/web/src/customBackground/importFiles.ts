import { CUSTOM_BACKGROUND_ACCEPTED_TYPES } from "./imageStore";

interface PickedFile {
  readonly path: string;
  readonly file: File;
}

const ACCEPTED_TYPES: ReadonlySet<string> = new Set(CUSTOM_BACKGROUND_ACCEPTED_TYPES);
const pathOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Supported images sorted by path, so a sequential playlist follows the folder's file names. */
function orderedImages(picked: ReadonlyArray<PickedFile>): Array<File> {
  return picked
    .filter(({ file }) => ACCEPTED_TYPES.has(file.type))
    .sort((a, b) => pathOrder.compare(a.path, b.path))
    .map(({ file }) => file);
}

export function imagesFromFiles(files: ArrayLike<File>): Array<File> {
  return orderedImages(
    Array.from(files, (file) => ({ path: file.webkitRelativePath || file.name, file })),
  );
}

/** Must be called synchronously inside the drop handler; the browser clears the items after it returns. */
export function imagesFromDrop(
  items: ArrayLike<Pick<DataTransferItem, "webkitGetAsEntry">>,
): Promise<Array<File>> {
  const entries = Array.from(items, (item) => item.webkitGetAsEntry()).filter(
    (entry) => entry !== null,
  );
  return Promise.all(entries.map(collectFiles)).then((picked) => orderedImages(picked.flat()));
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

function isDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

async function collectFiles(entry: FileSystemEntry): Promise<Array<PickedFile>> {
  if (isFileEntry(entry)) {
    const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
    return [{ path: entry.fullPath, file }];
  }
  if (!isDirectoryEntry(entry)) return [];
  const children = await readAllEntries(entry.createReader());
  return (await Promise.all(children.map(collectFiles))).flat();
}

// readEntries hands back at most 100 entries per call and an empty batch at the end.
async function readAllEntries(reader: FileSystemDirectoryReader): Promise<Array<FileSystemEntry>> {
  const entries: Array<FileSystemEntry> = [];
  for (;;) {
    const batch = await new Promise<Array<FileSystemEntry>>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) return entries;
    entries.push(...batch);
  }
}
