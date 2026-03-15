import { Router } from "express";

import {
    getExploreItems,
    getFavorites,
    removeFavorite,
    swipeItem,
} from "../controllers/explore.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/items", getExploreItems);
router.post("/swipe", swipeItem);

router.get("/favorites", getFavorites);
router.delete("/favorites/:itemId", removeFavorite);

export default router;
