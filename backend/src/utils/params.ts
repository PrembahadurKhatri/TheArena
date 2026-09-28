import { Request } from "express";

// Express 5's ParamsDictionary types values as `string | string[]` (to
// support wildcard routes like `/:id*`). None of our routes use wildcards,
// so every param is always a plain string at runtime — this narrows the
// type accordingly instead of sprinkling `as string` everywhere.
export function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}
