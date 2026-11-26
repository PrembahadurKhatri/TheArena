import { Router, Request, Response } from "express";
import { verifyToken } from "../middleware/verifyToken";
import { asyncHandler } from "../utils/asyncHandler";
import { param } from "../utils/params";
import { upload, fileUrl } from "../utils/upload";
import { toPaymentSummary } from "../utils/shapers";
import * as subs from "../services/subscriptionsService";
import * as payments from "../services/paymentsService";

// Mounted at /api: /plans, /subscriptions, /payments/:id/manual-proof, /my/...
const router = Router();

router.get(
  "/plans",
  asyncHandler(async (req: Request, res: Response) => {
    const audience = typeof req.query.audience === "string" ? req.query.audience : undefined;
    res.json({ plans: await subs.listPlans(audience) });
  })
);

router.post(
  "/subscriptions",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { subscription, payment } = await subs.subscribe(req.user!, req.body ?? {});
    res.status(201).json({ subscription: subs.toSubscriptionJSON(subscription), payment: toPaymentSummary(payment) });
  })
);

router.post(
  "/subscriptions/:id/cancel",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ subscription: subs.toSubscriptionJSON(await subs.cancelSubscription(req.user!, param(req, "id"))) });
  })
);

router.get(
  "/my/subscriptions",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ subscriptions: (await subs.mySubscriptions(req.user!)).map(subs.toSubscriptionJSON) });
  })
);

router.get(
  "/my/payments",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ payments: (await payments.listMyPayments(req.user!)).map((p) => toPaymentSummary(p)) });
  })
);

router.post(
  "/payments/:id/manual-proof",
  verifyToken,
  upload.single("proof"),
  asyncHandler(async (req: Request, res: Response) => {
    const p = await payments.submitManualProof(req.user!, param(req, "id"), {
      reference: req.body?.reference,
      proofImage: req.file ? fileUrl(req.file) : null,
    });
    res.json({ payment: toPaymentSummary(p) });
  })
);

export default router;
