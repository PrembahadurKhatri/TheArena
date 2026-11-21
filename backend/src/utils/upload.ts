import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { Request, Response, NextFunction, RequestHandler } from "express";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { AppError } from "./AppError";

// Two storage back ends, picked by environment:
//  - Cloudinary (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET set): files are held
//    in memory, streamed to Cloudinary, and the stored URL is the https URL
//    Cloudinary returns. Required on Vercel, whose filesystem is read-only and
//    wiped between requests.
//  - Local disk (no Cloudinary keys, local development): files go to
//    backend/uploads (or UPLOADS_DIR) and are served by app.ts at /uploads.
export const useCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Every Arena image goes under this Cloudinary folder.
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "thearena";

export const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, "..", "..", "uploads");

if (!useCloudinary && !fs.existsSync(uploadsDir)) {
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

const storage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
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

const parser = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 30 },
});

// Where the uploaded file ended up (set by sendToCloudinary).
type UploadedFile = Express.Multer.File & { cloudUrl?: string };

function uploadBuffer(file: Express.Multer.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
      },
      (err?: unknown, result?: UploadApiResponse) => {
        if (err || !result) reject(err ?? new Error("Cloudinary upload failed"));
        else resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

/** After multer has parsed the files into memory, push them to Cloudinary. */
async function sendToCloudinary(req: Request, _res: Response, next: NextFunction) {
  if (!useCloudinary) return next();
  const files: UploadedFile[] = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  try {
    await Promise.all(
      files.map(async (file) => {
        file.cloudUrl = await uploadBuffer(file);
      })
    );
    next();
  } catch (err: any) {
    console.error("[upload] Cloudinary upload failed:", err?.message ?? err);
    next(new AppError(502, "Image upload failed, please try again"));
  }
}

// Same surface the routes already used (upload.single / upload.array), each
// now returning [parse, store] middleware — Express accepts the array as is.
export const upload = {
  single(field: string): RequestHandler[] {
    return [parser.single(field), sendToCloudinary];
  },
  array(field: string, maxCount?: number): RequestHandler[] {
    return [parser.array(field, maxCount), sendToCloudinary];
  },
};

/** The URL to store for an uploaded file: Cloudinary's https URL, or /uploads/<file> locally. */
export function fileUrl(file: Express.Multer.File): string {
  const cloudUrl = (file as UploadedFile).cloudUrl;
  return cloudUrl ?? `/uploads/${file.filename}`;
}
