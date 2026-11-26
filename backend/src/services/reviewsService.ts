import { Types } from "mongoose";
import { Review, WishlistItem } from "../models/Review";
import { Product, PUBLIC_PRODUCT } from "../models/Product";
import { Store } from "../models/Store";
import { SellerOrder } from "../models/SellerOrder";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isObjectIdString, optionalString } from "../utils/validation";
import { notify } from "./notificationService";
import { audit } from "./auditService";

/** Recompute a product's (and its shop's) average from visible reviews. */
async function refreshRatings(productId: Types.ObjectId, storeId: Types.ObjectId) {
  for (const [model, field, id] of [
    [Product, "product", productId],
    [Store, "store", storeId],
  ] as const) {
    const [agg] = await Review.aggregate([{ $match: { [field]: id, status: "visible" } }, { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }]);
    await (model as any).updateOne({ _id: id }, { $set: { rating: { avg: agg ? Math.round(agg.avg * 10) / 10 : 0, count: agg?.count ?? 0 } } });
  }
}

export async function listProductReviews(productId: string) {
  if (!isObjectIdString(productId)) throw new AppError(404, "Product not found");
  return Review.find({ product: productId, status: "visible" }).sort({ createdAt: -1 }).limit(100).populate("user", "name username photo");
}

/** Only buyers with a delivered order containing the product may review it, once. */
export async function createReview(user: IUser, productId: string, input: { rating?: unknown; text?: unknown }) {
  if (!isObjectIdString(productId)) throw new AppError(404, "Product not found");
  const product = await Product.findById(productId);
  if (!product) throw new AppError(404, "Product not found");
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError(400, "rating must be a whole number from 1 to 5");
  const delivered = await SellerOrder.findOne({ buyer: user._id, status: "delivered", "items.product": product._id }).sort({ updatedAt: -1 });
  if (!delivered) throw new AppError(403, "You can review a product once it has been delivered to you");
  let review;
  try {
    review = await Review.create({ product: product._id, store: product.store, user: user._id, sellerOrder: delivered._id, rating, text: optionalString(input.text, "text", 2000) });
  } catch (err: any) {
    if (err?.code === 11000) throw new AppError(409, "You've already reviewed this product");
    throw err;
  }
  await refreshRatings(product._id, product.store);
  const store = await Store.findById(product.store).select("owner");
  await notify(store?.owner, { type: "system", title: `New ${rating}-star review on ${product.name}`, link: `/shop/products/${product.slug ?? product._id}`, entity: { type: "product", id: product._id }, actor: user._id });
  return Review.findById(review._id).populate("user", "name username photo");
}

export async function replyToReview(user: IUser, reviewId: string, replyInput: unknown) {
  if (!isObjectIdString(reviewId)) throw new AppError(404, "Review not found");
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError(404, "Review not found");
  const store = await Store.findById(review.store).select("owner");
  if (!store || !store.owner.equals(user._id)) throw new AppError(403, "Only the shop can reply to its reviews");
  const reply = optionalString(replyInput, "reply", 1000);
  if (!reply) throw new AppError(400, "reply is required");
  review.merchantReply = reply;
  review.repliedAt = new Date();
  await review.save();
  return Review.findById(review._id).populate("user", "name username photo");
}

export async function listStoreReviews(user: IUser, storeId: string) {
  const store = await Store.findById(storeId).select("owner");
  if (!store || !store.owner.equals(user._id)) throw new AppError(403, "Only the shop owner can manage its reviews");
  return Review.find({ store: storeId }).sort({ createdAt: -1 }).limit(200).populate("user", "name").populate("product", "name slug");
}

/** Staff hide abusive reviews (or show them again). */
export async function setReviewVisibility(actor: IUser, reviewId: string, visible: boolean, reason?: unknown) {
  if (!isObjectIdString(reviewId)) throw new AppError(404, "Review not found");
  const review = await Review.findById(reviewId);
  if (!review) throw new AppError(404, "Review not found");
  review.status = visible ? "visible" : "hidden";
  await review.save();
  await refreshRatings(review.product, review.store);
  await audit({ actor: actor._id, actorRole: actor.role, action: visible ? "review.shown" : "review.hidden", target: { type: "review", id: review._id }, reason: typeof reason === "string" ? reason : undefined });
  return review;
}

// ---------------------------------------------------------------- wishlist

export async function listWishlist(user: IUser) {
  const items = await WishlistItem.find({ user: user._id }).sort({ createdAt: -1 }).populate({ path: "product", populate: { path: "store", select: "name slug status" } });
  return items.filter((i: any) => i.product);
}

export async function addToWishlist(user: IUser, productId: string) {
  if (!isObjectIdString(productId)) throw new AppError(404, "Product not found");
  if (!(await Product.exists({ _id: productId, ...PUBLIC_PRODUCT }))) throw new AppError(404, "Product not found");
  await WishlistItem.updateOne({ user: user._id, product: productId }, { $setOnInsert: { user: user._id, product: productId } }, { upsert: true });
  return { saved: true };
}

export async function removeFromWishlist(user: IUser, productId: string) {
  if (!isObjectIdString(productId)) throw new AppError(404, "Product not found");
  await WishlistItem.deleteOne({ user: user._id, product: productId });
  return { saved: false };
}
