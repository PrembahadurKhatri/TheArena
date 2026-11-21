import { queryString } from "./validation";

export interface Page {
  page: number;
  limit: number;
  skip: number;
}

/** Parse ?page=&limit= safely (1-based page, limit capped). */
export function parsePage(query: Record<string, unknown>, { defaultLimit = 20, maxLimit = 100 } = {}): Page {
  const page = Math.max(1, Math.floor(Number(queryString(query.page)) || 1));
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(Number(queryString(query.limit)) || defaultLimit)));
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(p: Page, total: number) {
  return { page: p.page, limit: p.limit, total, pages: Math.max(1, Math.ceil(total / p.limit)) };
}
