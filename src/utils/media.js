function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read this file."));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("QuizPro could not read that image."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareQuizImage(file) {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  // Small files are already cheap enough to keep as-is.
  if (file.size <= 140_000) return readAsDataUrl(file);

  const image = await loadImage(file);
  const longest = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const initialScale = Math.min(1, 1280 / Math.max(1, longest));
  let width = Math.max(1, Math.round((image.naturalWidth || image.width) * initialScale));
  let height = Math.max(1, Math.round((image.naturalHeight || image.height) * initialScale));

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("QuizPro could not prepare that image.");

  const targetBytes = 140_000;
  const qualities = [0.86, 0.78, 0.70, 0.62, 0.54];
  let bestBlob = null;

  // Keep shrinking gently until the image is small enough for the quiz library.
  for (let resizePass = 0; resizePass < 5; resizePass += 1) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, "image/webp", quality);
      if (!blob) continue;
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
      if (blob.size <= targetBytes) return readAsDataUrl(blob);
    }

    width = Math.max(520, Math.round(width * 0.82));
    height = Math.max(360, Math.round(height * 0.82));
  }

  if (!bestBlob) throw new Error("QuizPro could not optimise that image.");
  return readAsDataUrl(bestBlob);
}

export function readMediaAsDataUrl(file) {
  return readAsDataUrl(file);
}
