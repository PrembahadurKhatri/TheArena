import { Request, Response, NextFunction, RequestHandler } from "express";

// Wraps an async route/controller so thrown errors (or rejected promises)
// are forwarded to Express's error handler instead of crashing the process.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
