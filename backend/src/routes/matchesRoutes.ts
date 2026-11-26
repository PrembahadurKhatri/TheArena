import { Router, Request, Response } from "express";
import { optionalAuth, verifyToken } from "../middleware/verifyToken";
import { asyncHandler } from "../utils/asyncHandler";
import { param } from "../utils/params";
import { parsePage } from "../utils/pagination";
import { toMatchJSON, toMatchReportJSON } from "../utils/shapers";
import * as matchesService from "../services/matchesService";
import * as reports from "../services/matchReportsService";
import { statDefinitions } from "../services/statsService";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { matches, ...meta } = await matchesService.listMatches(req.query, parsePage(req.query));
    res.json({ matches: matches.map(toMatchJSON), ...meta });
  })
);

// Match page: the match, its result reports, what the viewer may do, and the
// sport's stat fields for the report form.
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const match = await matchesService.getMatch(param(req, "id"));
    const [list, authority, stats] = await Promise.all([
      reports.listReportsForMatch(param(req, "id")),
      reports.myAuthority(req.user, param(req, "id")),
      statDefinitions(match.sport ?? (match.tournament as any)?.sport ?? ""),
    ]);
    res.json({
      match: toMatchJSON(match),
      reports: list.map(toMatchReportJSON),
      viewerAuthority: authority,
      statDefinitions: stats,
      autoVerifyHours: reports.AUTO_VERIFY_HOURS(),
    });
  })
);

router.post(
  "/:id/reports",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const r = await reports.submitReport(req.user!, param(req, "id"), req.body ?? {});
    res.status(201).json({ report: toMatchReportJSON(r) });
  })
);

router.post(
  "/reports/:rid/confirm",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ report: toMatchReportJSON(await reports.confirmReport(req.user!, param(req, "rid"))) });
  })
);

router.post(
  "/reports/:rid/dispute",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ report: toMatchReportJSON(await reports.disputeReport(req.user!, param(req, "rid"), req.body?.reason)) });
  })
);

router.post(
  "/reports/:rid/withdraw",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ report: toMatchReportJSON(await reports.withdrawReport(req.user!, param(req, "rid"))) });
  })
);

export default router;
