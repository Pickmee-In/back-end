import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
    analyzeItemPhoto,
    createItem,
    deleteItem,
    getMyItemDetail,
    listMyItems,
    updateItem,
} from "../controllers/item.controller.js";
import { authenticate } from "../middleware/auth.js";
import { uploadItemPhotos } from "../middleware/upload.js";

const router = Router();

router.use(authenticate);

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: "Too many upload requests, please try again in a minute",
        code: "UPLOAD_RATE_LIMIT",
    },
});

// Analyze a single image with Gemini. If AI fails, frontend should require manual input.
router.post(
    "/analyze",
    uploadLimiter,
    uploadItemPhotos.single("photo"),
    analyzeItemPhoto
);

// Create item with max 5 images.
router.post("/", uploadLimiter, uploadItemPhotos.array("photos", 5), createItem);

// My active listed items.
router.get("/mine", listMyItems);
router.get("/mine/:id", getMyItemDetail);
router.patch("/:id", uploadLimiter, uploadItemPhotos.array("photos", 5), updateItem);
router.delete("/:id", deleteItem);

export default router;
