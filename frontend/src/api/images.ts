// Shrink photos before upload, so they send quickly on mobile data and stay
// well under the API's 5 MB per-image limit — a product can carry up to 5 phone photos of
// 3–8 MB each. Large photos are scaled to at most MAX_SIDE px on the long edge
// and re-encoded (WebP, or JPEG where WebP encoding isn't supported), which
// keeps each one well under 1 MB with no visible loss at the sizes the site
// shows them. Small files and GIFs (which may be animated) are sent as they are.
const MAX_SIDE = 1920;
const KEEP_UNDER_BYTES = 700 * 1024;
const TARGET_BYTES = 850 * 1024;

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // Not decodable here: let the server decide.
  }
  const longest = Math.max(bitmap.width, bitmap.height);
  if (file.size <= KEEP_UNDER_BYTES && longest <= MAX_SIDE) {
    bitmap.close();
    return file;
  }

  let side = Math.min(MAX_SIDE, longest);
  let best: Blob | null = null;
  for (const quality of [0.86, 0.78, 0.7]) {
    const scale = side / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = await encode(canvas, "image/webp", quality);
    // Safari before 17 silently returns PNG for unsupported WebP: use JPEG then.
    if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", quality);
    if (blob && (!best || blob.size < best.size)) best = blob;
    if (best && best.size <= TARGET_BYTES) break;
    side = Math.round(side * 0.85);
  }
  bitmap.close();

  if (!best || best.size >= file.size) return file;
  const ext = best.type === "image/webp" ? "webp" : "jpg";
  const name = file.name.replace(/\.[^.]+$/, "") + "." + ext;
  return new File([best], name, { type: best.type, lastModified: file.lastModified });
}
