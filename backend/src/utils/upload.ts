import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { AppError } from "./AppError";

// Where uploaded images are written. Defaults to backend/uploads. On Render,
// the normal filesystem is wiped on every deploy/restart — point this at a
// mounted Render Disk (e.g. UPLOADS_DIR=/var/data/uploads) to keep files.
export const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// The stored extension comes from this allow-list, never from the client's
// filename — otherwise "evil.html" sent as image/png would be saved and
// served back as HTML from the API's origin (stored XSS).
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] ?? ".bin";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  if (MIME_TO_EXT[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new AppError(400, "Only JPEG, PNG, WebP or GIF images are allowed"));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 30 },
});

export function fileToUrlPath(filename: string): string {
  return `/uploads/${filename}`;
}
