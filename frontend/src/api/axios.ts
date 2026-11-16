import axios from "axios";

// Backend origin, e.g. https://the-arena-api.onrender.com (no trailing
// slash). Empty in local dev, where Vite proxies /api and /uploads to
// localhost:5050 (see vite.config.ts).
export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  // Render's free tier can take ~1 minute to wake from sleep; don't give up
  // before that.
  timeout: 70000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("arena_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Uploaded images are stored by the backend as "/uploads/<file>". In
// production the backend is on a different domain than the site, so prefix
// those paths with the API origin. Anything else (full URLs, /sports/*.jpg
// from this site's public folder, blob: previews) is returned unchanged.
export function assetUrl<T extends string | null | undefined>(path: T): T | string {
  if (!path) return path;
  if (path.startsWith("/uploads/")) return `${API_ORIGIN}${path}`;
  return path;
}

export default api;
