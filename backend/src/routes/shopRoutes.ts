import { Router } from "express";
import * as storesController from "../controllers/storesController";
import * as productsController from "../controllers/productsController";
import * as ordersController from "../controllers/ordersController";
import { verifyToken } from "../middleware/verifyToken";
import { upload } from "../utils/upload";

const router = Router();

// Stores
router.get("/stores/mine", verifyToken, storesController.getMyStore);
router.get("/stores/:id/orders", verifyToken, ordersController.listStoreOrders);
router.get("/stores/:id", storesController.getStore);
router.get("/stores", storesController.listStores);
router.post("/stores", verifyToken, upload.single("logo"), storesController.createStore);
router.patch("/stores/:id", verifyToken, upload.single("logo"), storesController.updateStore);

// Products
router.get("/products", productsController.listProducts);
router.get("/products/:id", productsController.getProduct);
router.post("/products", verifyToken, upload.array("images", 5), productsController.createProduct);
router.patch("/products/:id", verifyToken, upload.array("images", 5), productsController.updateProduct);
router.delete("/products/:id", verifyToken, productsController.deleteProduct);

// Orders
router.post("/orders", verifyToken, ordersController.createOrder);

export default router;
