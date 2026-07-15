import { copyFile, cp, mkdir, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);

await copyFile(new URL("index.html", dist), new URL("index.html", root));

await rm(new URL("assets/", root), { force: true, recursive: true });
await mkdir(new URL("assets/", root), { recursive: true });
await cp(new URL("assets/", dist), new URL("assets/", root), { recursive: true });
