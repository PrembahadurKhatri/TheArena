import { Router, Request, Response } from "express";
import { verifyToken } from "../middleware/verifyToken";
import { requirePermission, requireStaff, requireSuperAdmin } from "../middleware/requirePermission";
import { asyncHandler } from "../utils/asyncHandler";
import { param } from "../utils/params";
import { parsePage, pageMeta } from "../utils/pagination";
import { PERMISSIONS } from "../config/permissions";
import * as adminService from "../services/adminService";
import * as staffService from "../services/staffService";
import * as blacklistService from "../services/blacklistService";
import * as notificationService from "../services/notificationService";
import { audit } from "../services/auditService";
import * as sportsService from "../services/sportsService";
import * as teamsService from "../services/teamsService";
import * as reportsService from "../services/matchReportsService";
import * as tournamentsService from "../services/tournamentsService";
import * as groundsService from "../services/groundsService";
import * as subscriptionsService from "../services/subscriptionsService";
import * as paymentsService from "../services/paymentsService";
import * as storesService from "../services/storesService";
import * as productsService from "../services/productsService";
import * as ordersService from "../services/ordersService";
import * as reviewsService from "../services/reviewsService";
import { ShopCategory } from "../models/ShopCategory";
import * as moderation from "../services/moderationService";
import * as settingsService from "../services/settingsService";
import { registerShopCategory, SHOP_CATEGORIES } from "../utils/shopCategories";
import { upload, fileUrl } from "../utils/upload";
import { toTeamSummary, toTeamDetail, toMatchReportJSON, toTournamentSummary, toTournamentDetail, toGroundDetail, toPaymentSummary, toStoreDetail, toProductDetail, toSellerOrderJSON, toReviewJSON } from "../utils/shapers";
import { getEffectivePermissions } from "../services/permissionsService";

// Staff-only router: verifyToken + requireStaff run for every route, so a new
// route can't be added without them. Each route then names the permission it
// needs (or requireSuperAdmin for staff management).
const router = Router();
router.use(verifyToken, requireStaff);

// ---------------------------------------------------------------- self

// The permission catalogue and what the caller holds, for the admin UI.
router.get(
  "/me/permissions",
  asyncHandler(async (req: Request, res: Response) => {
    const held = await getEffectivePermissions(req.user!);
    res.json({
      isSuperAdmin: req.user!.role === "admin" && !!req.user!.isSuperAdmin,
      permissions: [...held].sort(),
      catalogue: Object.entries(PERMISSIONS).map(([key, label]) => ({ key, label })),
    });
  })
);

// ---------------------------------------------------------------- users

router.get(
  "/users",
  requirePermission("users.read"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await adminService.listUsers(req.query, parsePage(req.query)));
  })
);

router.patch(
  "/users/:id/status",
  requirePermission("users.suspend"),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.setUserStatus(param(req, "id"), req.user!, req.body ?? {});
    res.json({ user });
  })
);

router.patch(
  "/users/:id/role",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.setUserRole(param(req, "id"), req.user!, req.body ?? {});
    res.json({ user });
  })
);

router.get(
  "/audit-logs",
  requirePermission("audit.read"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await adminService.listAuditLogs(req.query, parsePage(req.query, { defaultLimit: 50, maxLimit: 200 })));
  })
);

// ---------------------------------------------------------------- staff (Super Admin only)

router.get(
  "/staff",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await staffService.listStaff(parsePage(req.query)));
  })
);

router.post(
  "/staff",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ staff: await staffService.addStaff(req.user!, req.body ?? {}) });
  })
);

router.patch(
  "/staff/:id",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ staff: await staffService.updateStaff(req.user!, param(req, "id"), req.body ?? {}) });
  })
);

router.delete(
  "/staff/:id",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: await staffService.removeStaff(req.user!, param(req, "id"), req.body ?? {}) });
  })
);

router.patch(
  "/staff/:id/super-admin",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ staff: await staffService.setSuperAdmin(req.user!, param(req, "id"), req.body ?? {}) });
  })
);

router.get(
  "/staff-roles",
  requireSuperAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ roles: await staffService.listStaffRoles() });
  })
);

router.post(
  "/staff-roles",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ role: await staffService.createStaffRole(req.user!, req.body ?? {}) });
  })
);

router.patch(
  "/staff-roles/:id",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ role: await staffService.updateStaffRole(req.user!, param(req, "id"), req.body ?? {}) });
  })
);

router.delete(
  "/staff-roles/:id",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await staffService.deleteStaffRole(req.user!, param(req, "id")));
  })
);

// ---------------------------------------------------------------- user detail

router.get(
  "/users/:id",
  requirePermission("users.read"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: await adminService.getUserDetail(param(req, "id")) });
  })
);

// ---------------------------------------------------------------- blacklist

router.get(
  "/blacklist",
  requirePermission("users.blacklist"),
  asyncHandler(async (req: Request, res: Response) => {
    const p = parsePage(req.query);
    const { items, total } = await blacklistService.listBlacklist(p.skip, p.limit);
    res.json({ entries: items, ...pageMeta(p, total) });
  })
);

router.delete(
  "/blacklist/:id",
  requirePermission("users.blacklist"),
  asyncHandler(async (req: Request, res: Response) => {
    await blacklistService.removeBlacklistEntry(param(req, "id"));
    await audit({ actor: req.user!._id, actorRole: req.user!.role, action: "blacklist.removed", target: { type: "blacklist", id: param(req, "id") } });
    res.json({ message: "Entry removed" });
  })
);

// ---------------------------------------------------------------- announcements

router.get(
  "/announcements",
  requirePermission("announcements.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await notificationService.adminListAnnouncements(parsePage(req.query)));
  })
);

router.post(
  "/announcements",
  requirePermission("announcements.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ announcement: await notificationService.createAnnouncement(req.user!, req.body ?? {}) });
  })
);

router.patch(
  "/announcements/:id",
  requirePermission("announcements.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ announcement: await notificationService.updateAnnouncement(req.user!, param(req, "id"), req.body ?? {}) });
  })
);

router.delete(
  "/announcements/:id",
  requirePermission("announcements.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await notificationService.deleteAnnouncement(req.user!, param(req, "id")));
  })
);

// ---------------------------------------------------------------- sports

router.get(
  "/sports",
  requirePermission("categories.manage"),
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ sports: await sportsService.listSports(true) });
  })
);

router.post(
  "/sports",
  requirePermission("categories.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ sport: await sportsService.createSport(req.user!, req.body ?? {}) });
  })
);

router.patch(
  "/sports/:slug",
  requirePermission("categories.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ sport: await sportsService.updateSport(req.user!, param(req, "slug"), req.body ?? {}) });
  })
);

// ---------------------------------------------------------------- teams

router.get(
  "/teams",
  requirePermission("teams.moderate"),
  asyncHandler(async (req: Request, res: Response) => {
    const { teams, ...meta } = await teamsService.adminListTeams(req.query, parsePage(req.query));
    res.json({ teams: teams.map(toTeamSummary), ...meta });
  })
);

router.patch(
  "/teams/:id/status",
  requirePermission("teams.moderate"),
  asyncHandler(async (req: Request, res: Response) => {
    const team = await teamsService.adminSetTeamStatus(req.user!, param(req, "id"), req.body ?? {});
    res.json({ team: toTeamDetail(team) });
  })
);

router.delete(
  "/teams/:id",
  requirePermission("teams.moderate"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await teamsService.adminDeleteTeam(req.user!, param(req, "id"), req.body?.reason));
  })
);

// ---------------------------------------------------------------- match results

router.get(
  "/match-reports",
  requirePermission("reports.verify"),
  asyncHandler(async (req: Request, res: Response) => {
    const { reports, ...meta } = await reportsService.adminListReports(req.query, parsePage(req.query));
    res.json({ reports: reports.map(toMatchReportJSON), ...meta });
  })
);

router.post(
  "/match-reports/:id/resolve",
  requirePermission("disputes.resolve"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ report: toMatchReportJSON(await reportsService.resolveDispute(req.user!, param(req, "id"), req.body ?? {})) });
  })
);

// ---------------------------------------------------------------- tournaments

router.get(
  "/tournaments",
  requirePermission("tournaments.review"),
  asyncHandler(async (req: Request, res: Response) => {
    const { items, ...meta } = await tournamentsService.adminListTournaments(req.query, parsePage(req.query));
    res.json({ tournaments: items.map((i) => ({ ...toTournamentSummary(i.tournament), eligibility: i.eligibility })), ...meta });
  })
);

router.post(
  "/tournaments/:id/review",
  requirePermission("tournaments.review"),
  asyncHandler(async (req: Request, res: Response) => {
    const t = await tournamentsService.adminReview(req.user!, param(req, "id"), req.body ?? {});
    res.json({ tournament: toTournamentDetail(t) });
  })
);

router.post(
  "/tournaments/:id/cancel",
  requirePermission("tournaments.review"),
  asyncHandler(async (req: Request, res: Response) => {
    const t = await tournamentsService.cancelTournament(param(req, "id"), req.user!, req.body?.reason, true);
    res.json({ tournament: toTournamentSummary(t) });
  })
);

// ---------------------------------------------------------------- grounds

router.get(
  "/grounds",
  requirePermission("grounds.review"),
  asyncHandler(async (req: Request, res: Response) => {
    const { grounds, ...meta } = await groundsService.adminListGrounds(req.query, parsePage(req.query));
    res.json({ grounds: grounds.map(toGroundDetail), ...meta });
  })
);

router.post(
  "/grounds/:id/review",
  requirePermission("grounds.review"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ ground: toGroundDetail(await groundsService.adminReviewGround(req.user!, param(req, "id"), req.body ?? {})) });
  })
);

router.post(
  "/grounds",
  requirePermission("grounds.manage"),
  upload.array("images", 8),
  asyncHandler(async (req: Request, res: Response) => {
    const images = Array.isArray(req.files) ? req.files.map(fileUrl) : [];
    res.status(201).json({ ground: toGroundDetail(await groundsService.adminCreateGround(req.user!, req.body ?? {}, images)) });
  })
);

router.patch(
  "/grounds/:id",
  requirePermission("grounds.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ ground: toGroundDetail(await groundsService.adminUpdateGround(req.user!, param(req, "id"), req.body ?? {})) });
  })
);

// ---------------------------------------------------------------- plans, subscriptions, payments

router.get(
  "/plans",
  requirePermission("plans.manage"),
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ plans: await subscriptionsService.listPlans(undefined, true) });
  })
);

router.post(
  "/plans",
  requirePermission("plans.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ plan: await subscriptionsService.createPlan(req.user!, req.body ?? {}) });
  })
);

router.patch(
  "/plans/:id",
  requirePermission("plans.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ plan: await subscriptionsService.updatePlan(req.user!, param(req, "id"), req.body ?? {}) });
  })
);

router.get(
  "/subscriptions",
  requirePermission("subscriptions.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    const { subscriptions, ...meta } = await subscriptionsService.adminListSubscriptions(req.query, parsePage(req.query));
    res.json({ subscriptions: subscriptions.map(subscriptionsService.toSubscriptionJSON), ...meta });
  })
);

router.post(
  "/subscriptions/:id/end",
  requirePermission("subscriptions.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 300) : "";
    if (!reason) {
      res.status(400).json({ message: "A reason is required" });
      return;
    }
    if (!/^[a-f0-9]{24}$/i.test(param(req, "id"))) {
      res.status(404).json({ message: "Subscription not found" });
      return;
    }
    const s = await subscriptionsService.endSubscriptionNow(req.user!, param(req, "id"), reason);
    if (!s) {
      res.status(404).json({ message: "Subscription not found" });
      return;
    }
    res.json({ subscription: subscriptionsService.toSubscriptionJSON(s) });
  })
);

router.get(
  "/payments",
  requirePermission("payments.read"),
  asyncHandler(async (req: Request, res: Response) => {
    const { payments, ...meta } = await paymentsService.adminListPayments(req.query, parsePage(req.query));
    res.json({ payments: payments.map((p) => toPaymentSummary(p, true)), ...meta });
  })
);

router.post(
  "/payments/:id/verify",
  requirePermission("payments.verify"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ payment: toPaymentSummary(await paymentsService.adminVerify(req.user!, param(req, "id")), true) });
  })
);

router.post(
  "/payments/:id/reject",
  requirePermission("payments.verify"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ payment: toPaymentSummary(await paymentsService.adminReject(req.user!, param(req, "id"), req.body?.reason), true) });
  })
);

router.post(
  "/payments/:id/refund",
  requirePermission("payments.refund"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ payment: toPaymentSummary(await paymentsService.adminRefund(req.user!, param(req, "id"), req.body?.note), true) });
  })
);

// ---------------------------------------------------------------- shop

router.get(
  "/merchants",
  requirePermission("merchants.review"),
  asyncHandler(async (req: Request, res: Response) => {
    const { stores, ...meta } = await storesService.adminListStores(req.query, parsePage(req.query));
    res.json({ stores: stores.map((s: any) => ({ ...toStoreDetail(s, true), owner: s.owner?.name ? { id: s.owner._id.toString(), name: s.owner.name, email: s.owner.email, phone: s.owner.phone ?? null } : null })), ...meta });
  })
);

router.post(
  "/merchants/:id/review",
  requirePermission("merchants.review"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ store: toStoreDetail(await storesService.adminReviewStore(req.user!, param(req, "id"), req.body ?? {}), true) });
  })
);

router.get(
  "/products",
  requirePermission("products.review"),
  asyncHandler(async (req: Request, res: Response) => {
    const { products, ...meta } = await productsService.adminListProducts(req.query, parsePage(req.query));
    res.json({ products: products.map(toProductDetail), ...meta });
  })
);

router.post(
  "/products/:id/review",
  requirePermission("products.review"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ product: toProductDetail(await productsService.adminReviewProduct(req.user!, param(req, "id"), req.body ?? {})) });
  })
);

router.get(
  "/orders",
  requirePermission("orders.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    const { orders, ...meta } = await ordersService.adminListSellerOrders(req.query, parsePage(req.query));
    res.json({ orders: orders.map(toSellerOrderJSON), ...meta });
  })
);

router.post(
  "/reviews/:id/visibility",
  requirePermission("products.review"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ review: toReviewJSON(await reviewsService.setReviewVisibility(req.user!, param(req, "id"), req.body?.visible === true, req.body?.reason)) });
  })
);

router.get(
  "/shop-categories",
  requirePermission("categories.manage"),
  asyncHandler(async (_req: Request, res: Response) => {
    const custom = await ShopCategory.find().sort({ order: 1, name: 1 }).lean();
    res.json({
      builtIn: SHOP_CATEGORIES,
      categories: custom.map((c: any) => ({ id: c._id.toString(), name: c.name, description: c.description ?? null, active: c.active !== false })),
    });
  })
);

router.post(
  "/shop-categories",
  requirePermission("categories.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (name.length < 2 || name.length > 40) {
      res.status(400).json({ message: "name must be 2 to 40 characters" });
      return;
    }
    if ((SHOP_CATEGORIES as readonly string[]).includes(name) || (await ShopCategory.exists({ name }))) {
      res.status(409).json({ message: "That category already exists" });
      return;
    }
    const c = await ShopCategory.create({ name, description: typeof req.body?.description === "string" ? req.body.description.slice(0, 200) : undefined });
    registerShopCategory(c.name, true);
    await audit({ actor: req.user!._id, actorRole: req.user!.role, action: "shop_category.created", target: { type: "shop_category", id: c._id }, after: { name } });
    res.status(201).json({ category: { id: c._id.toString(), name: c.name, active: true } });
  })
);

router.patch(
  "/shop-categories/:id",
  requirePermission("categories.manage"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!/^[a-f0-9]{24}$/i.test(param(req, "id"))) {
      res.status(404).json({ message: "Category not found" });
      return;
    }
    const c = await ShopCategory.findById(param(req, "id"));
    if (!c) {
      res.status(404).json({ message: "Category not found" });
      return;
    }
    if (req.body?.active !== undefined) c.active = req.body.active === true;
    await c.save();
    registerShopCategory(c.name, c.active);
    await audit({ actor: req.user!._id, actorRole: req.user!.role, action: "shop_category.updated", target: { type: "shop_category", id: c._id }, after: { active: c.active } });
    res.json({ category: { id: c._id.toString(), name: c.name, active: c.active } });
  })
);

// ---------------------------------------------------------------- overview, reports, settings, user edits

router.get(
  "/overview",
  requirePermission("analytics.read"),
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await moderation.overview());
  })
);

router.get(
  "/reports",
  requirePermission("moderation.reports"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await moderation.listReports(req.query, parsePage(req.query)));
  })
);

router.post(
  "/reports/:id/resolve",
  requirePermission("moderation.reports"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await moderation.resolveReport(req.user!, param(req, "id"), req.body ?? {}));
  })
);

router.get(
  "/settings",
  requireSuperAdmin,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ settings: settingsService.listSettings() });
  })
);

router.patch(
  "/settings",
  requireSuperAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ settings: await settingsService.updateSettings(req.user!, req.body ?? {}) });
  })
);

router.patch(
  "/users/:id",
  requirePermission("users.edit"),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await moderation.adminEditUser(req.user!, param(req, "id"), req.body ?? {});
    res.json({ user: adminService.toAdminUser(user) });
  })
);

export default router;
