import { Router, Request, Response } from "express";
import { actionLimiter } from "../middleware/security";
import { verifyToken, optionalAuth } from "../middleware/verifyToken";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { parsePage } from "../utils/pagination";
import { upload, fieldFile, fileUrl } from "../utils/upload";
import { toStoreSummary, toStoreDetail, toProductDetail, toProductSummary, toOrderSummary, toSellerOrderJSON, toReviewJSON } from "../utils/shapers";
import { SHOP_CATEGORIES } from "../utils/shopCategories";
import { ShopCategory } from "../models/ShopCategory";
import * as storesService from "../services/storesService";
import * as productsService from "../services/productsService";
import * as ordersService from "../services/ordersService";
import * as reviewsService from "../services/reviewsService";

const router = Router();

const storeImages = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "banner", maxCount: 1 },
  { name: "documents", maxCount: 3 },
]);

function storeInput(req: Request) {
  const body = { ...(req.body ?? {}) };
  delete body.documents;
  const logo = fieldFile(req, "logo");
  const banner = fieldFile(req, "banner");
  const docs = (req.files as Record<string, Express.Multer.File[]> | undefined)?.documents ?? [];
  if (logo) body.logo = fileUrl(logo);
  else delete body.logo;
  if (banner) body.banner = fileUrl(banner);
  else delete body.banner;
  if (docs.length) body.documents = docs.map(fileUrl);
  return body;
}

function productInput(req: Request) {
  const body = { ...(req.body ?? {}) };
  const files = req.files as Express.Multer.File[] | undefined;
  if (files?.length) body.images = files.map(fileUrl);
  else delete body.images;
  return body;
}

// ---------------------------------------------------------------- categories

router.get(
  "/categories",
  asyncHandler(async (_req: Request, res: Response) => {
    const extra = await ShopCategory.find({ active: true }).sort({ order: 1, name: 1 }).lean();
    const names = [...new Set([...SHOP_CATEGORIES, ...extra.map((c) => c.name)])];
    const hidden = new Set((await ShopCategory.find({ active: false }).select("name").lean()).map((c) => c.name));
    res.json({ categories: names.filter((n) => !hidden.has(n)) });
  })
);

// ---------------------------------------------------------------- stores

router.get(
  "/stores/mine",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const store = await storesService.getMyStore(req.user!._id.toString());
    res.json({ store: store ? toStoreDetail(store, true) : null });
  })
);

router.get(
  "/stores/:id/orders",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const orders = await ordersService.listStoreOrders(param(req, "id"), req.user!, req.query);
    res.json({ orders: orders.map(toSellerOrderJSON) });
  })
);

router.get(
  "/stores/:id/sales",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await ordersService.salesReport(param(req, "id"), req.user!));
  })
);

router.get(
  "/stores/:id/reviews",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ reviews: (await reviewsService.listStoreReviews(req.user!, param(req, "id"))).map(toReviewJSON) });
  })
);

router.get(
  "/stores/:id",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const store = await storesService.getStoreWithProducts(param(req, "id"), req.user);
    const isOwner = !!req.user && (store.owner?._id ?? store.owner)?.toString() === req.user._id.toString();
    res.json({ store: toStoreDetail(store, isOwner) });
  })
);

router.get(
  "/stores",
  asyncHandler(async (req: Request, res: Response) => {
    const { stores, ...meta } = await storesService.listStores(req.query, parsePage(req.query, { defaultLimit: 24 }));
    res.json({ stores: stores.map(toStoreSummary), ...meta });
  })
);

router.post(
  "/stores",
  verifyToken,
  actionLimiter,
  storeImages,
  asyncHandler(async (req: Request, res: Response) => {
    const store = await storesService.createStore(req.user!, storeInput(req));
    res.status(201).json({ store: toStoreDetail(store, true) });
  })
);

router.patch(
  "/stores/:id",
  verifyToken,
  storeImages,
  asyncHandler(async (req: Request, res: Response) => {
    const store = await storesService.updateStore(param(req, "id"), req.user!, storeInput(req));
    res.json({ store: toStoreDetail(store, true) });
  })
);

// ---------------------------------------------------------------- products

router.get(
  "/products",
  asyncHandler(async (req: Request, res: Response) => {
    const paged = req.query.page !== undefined || req.query.limit !== undefined;
    const { products, ...meta } = await productsService.listProducts(req.query, paged ? parsePage(req.query, { defaultLimit: 24 }) : undefined);
    res.json({ products: products.map(toProductDetail), ...meta });
  })
);

router.get(
  "/products/:id/reviews",
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ reviews: (await reviewsService.listProductReviews(param(req, "id"))).map(toReviewJSON) });
  })
);

router.post(
  "/products/:id/reviews",
  verifyToken,
  actionLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ review: toReviewJSON(await reviewsService.createReview(req.user!, param(req, "id"), req.body ?? {})) });
  })
);

router.get(
  "/products/:id",
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ product: toProductDetail(await productsService.getProductById(param(req, "id"), req.user)) });
  })
);

router.post(
  "/products",
  verifyToken,
  upload.array("images", 5),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json({ product: toProductDetail(await productsService.createProduct(req.user!, productInput(req))) });
  })
);

router.patch(
  "/products/:id",
  verifyToken,
  upload.array("images", 5),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ product: toProductDetail(await productsService.updateProduct(param(req, "id"), req.user!, productInput(req))) });
  })
);

router.delete(
  "/products/:id",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await productsService.deleteProduct(param(req, "id"), req.user!));
  })
);

router.post(
  "/reviews/:id/reply",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ review: toReviewJSON(await reviewsService.replyToReview(req.user!, param(req, "id"), req.body?.reply)) });
  })
);

// ---------------------------------------------------------------- wishlist

router.get(
  "/wishlist",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const items = await reviewsService.listWishlist(req.user!);
    res.json({ products: items.map((i: any) => toProductSummary(i.product)) });
  })
);

router.post(
  "/wishlist/:productId",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await reviewsService.addToWishlist(req.user!, param(req, "productId")));
  })
);

router.delete(
  "/wishlist/:productId",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await reviewsService.removeFromWishlist(req.user!, param(req, "productId")));
  })
);

// ---------------------------------------------------------------- orders

router.post(
  "/orders",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { items, shippingAddress, shippingProvince, contactName, contactPhone, paymentMethod } = req.body ?? {};
    const order = await ordersService.createOrder(req.user!, { items, shippingAddress, shippingProvince, contactName, contactPhone, paymentMethod });
    res.status(201).json({ order: toOrderSummary(order) });
  })
);

router.get(
  "/orders/:id",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ order: toOrderSummary(await ordersService.getMyOrder(req.user!, param(req, "id"))) });
  })
);

router.post(
  "/seller-orders/:id/cancel",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ order: toOrderSummary(await ordersService.cancelSellerOrderByBuyer(req.user!, param(req, "id"), req.body?.reason)) });
  })
);

router.patch(
  "/seller-orders/:id/status",
  verifyToken,
  asyncHandler(async (req: Request, res: Response) => {
    const so = await ordersService.updateSellerOrderStatus(req.user!, param(req, "id"), req.body ?? {});
    if (!so) throw new AppError(404, "Order not found");
    res.json({ order: toSellerOrderJSON(so) });
  })
);

export default router;
