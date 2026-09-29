import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { toProductDetail } from "../utils/shapers";
import { fileToUrlPath } from "../utils/upload";
import * as productsService from "../services/productsService";

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const { sport, category, search, storeId } = req.query as {
    sport?: string;
    category?: string;
    search?: string;
    storeId?: string;
  };
  const products = await productsService.listProducts({ sport, category, search, storeId });
  res.status(200).json({ products: products.map(toProductDetail) });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await productsService.getProductById(param(req, "id"));
  res.status(200).json({ product: toProductDetail(product) });
});

function extractImages(req: Request): string[] | undefined {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) return undefined;
  return files.map((f) => fileToUrlPath(f.filename));
}

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { name, description, category, sport, price, stock } = req.body;
  const images = extractImages(req);
  const product = await productsService.createProduct(req.user, {
    name,
    description,
    category,
    sport,
    price,
    stock,
    images,
  });
  res.status(201).json({ product: toProductDetail(product) });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { name, description, category, sport, price, stock } = req.body;
  const images = extractImages(req);
  const product = await productsService.updateProduct(param(req, "id"), req.user, {
    name,
    description,
    category,
    sport,
    price,
    stock,
    images,
  });
  res.status(200).json({ product: toProductDetail(product) });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const result = await productsService.deleteProduct(param(req, "id"), req.user);
  res.status(200).json(result);
});
