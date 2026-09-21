import { expect, it } from "vite-plus/test";

import { imagesFromDrop, imagesFromFiles } from "./importFiles";

function file(name: string, type: string, relativePath = ""): File {
  const picked = new File(["x"], name, { type });
  Object.defineProperty(picked, "webkitRelativePath", { value: relativePath });
  return picked;
}

type FakeEntry = File | { readonly name: string; readonly children: ReadonlyArray<FakeEntry> };

// Mirrors the browser's entry API, including readEntries paging through a
// directory in small batches before returning an empty one.
function entry(node: FakeEntry, parentPath: string): FileSystemEntry {
  const fullPath = `${parentPath}/${node.name}`;
  if (node instanceof File) {
    const fileEntry = {
      isFile: true,
      isDirectory: false,
      fullPath,
      file: (resolve: (file: File) => void) => resolve(node),
    };
    return fileEntry as unknown as FileSystemEntry;
  }
  const children = node.children.map((child) => entry(child, fullPath));
  const directoryEntry = {
    isFile: false,
    isDirectory: true,
    fullPath,
    createReader: () => {
      let offset = 0;
      return {
        readEntries: (resolve: (entries: ReadonlyArray<FileSystemEntry>) => void) => {
          const batch = children.slice(offset, offset + 2);
          offset += batch.length;
          resolve(batch);
        },
      };
    },
  };
  return directoryEntry as unknown as FileSystemEntry;
}

it("keeps a folder's supported images in file name order", () => {
  const picked = imagesFromFiles([
    file("shot-10.jpg", "image/jpeg", "Walls/shot-10.jpg"),
    file(".DS_Store", "", "Walls/.DS_Store"),
    file("shot-2.png", "image/png", "Walls/shot-2.png"),
    file("notes.txt", "text/plain", "Walls/notes.txt"),
    file("shot-1.webp", "image/webp", "Walls/shot-1.webp"),
  ]);
  expect(picked.map((image) => image.name)).toEqual(["shot-1.webp", "shot-2.png", "shot-10.jpg"]);
});

it("collects images from dropped folders at any depth", async () => {
  const dropped = {
    name: "Walls",
    children: [
      file("b.jpg", "image/jpeg"),
      { name: "Night", children: [file("c.png", "image/png"), file("d.gif", "image/gif")] },
      file("a.webp", "image/webp"),
      file("e.jpg", "image/jpeg"),
    ],
  };
  const loose = file("z.png", "image/png");
  const images = await imagesFromDrop([
    { webkitGetAsEntry: () => entry(dropped, "") },
    { webkitGetAsEntry: () => entry(loose, "") },
    { webkitGetAsEntry: () => null },
  ]);
  expect(images.map((image) => image.name)).toEqual(["a.webp", "b.jpg", "e.jpg", "c.png", "z.png"]);
});
