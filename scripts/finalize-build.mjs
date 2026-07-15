import { copyFile, stat } from "node:fs/promises";

const inputHtml = new URL("../dist/index.dev.html", import.meta.url);
const outputHtml = new URL("../dist/index.html", import.meta.url);

try {
  await stat(inputHtml);
  await copyFile(inputHtml, outputHtml);
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}
