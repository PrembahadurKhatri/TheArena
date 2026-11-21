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

// The server ends a session when the token was revoked (password reset,
// "log out of all devices", suspension) or the account is blocked. Drop the
// stored token and tell AuthContext, so the app shows the signed-out state
// instead of failing on every request.
export const SESSION_ENDED_EVENT = "arena:session-ended";
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const sentToken = !!error?.config?.headers?.Authorization;
    const isLoginCall = /\/auth\/(login|register)$/.test(error?.config?.url ?? "");
    const blocked = status === 403 && error?.response?.data?.code === "ACCOUNT_BLOCKED";
    if (sentToken && !isLoginCall && (status === 401 || blocked)) {
      localStorage.removeItem("arena_token");
      window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: error?.response?.data?.message }));
    }
    return Promise.reject(error);
  }
);

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
