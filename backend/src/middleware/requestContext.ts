import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import { Request, Response, NextFunction } from "express";

// Gives every request an ID (echoed as X-Request-Id) that services can read
// without threading it through every call — used by the audit log and error
// logs so one request can be traced end to end.
interface RequestContext {
  requestId: string;
  ip?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

const INCOMING_ID = /^[A-Za-z0-9-]{8,64}$/;

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  const requestId = incoming && INCOMING_ID.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader("X-Request-Id", requestId);
  storage.run({ requestId, ip: req.ip }, () => next());
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
