/**
 * Swipe Routes
 * Endpoints for individual swipe sessions and matches
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
    startSession,
    getActiveSession,
    swipe,
    completeSession,
    cancelSession,
    getHistory,
    getMatches,
    markVisited,
} from "../controllers/swipe.controller.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Sessions
router.post("/sessions", startSession);
router.get("/sessions/active", getActiveSession);
router.post("/sessions/:id/swipe", swipe);
router.post("/sessions/:id/complete", completeSession);
router.delete("/sessions/:id", cancelSession);

// History
router.get("/history", getHistory);

// Matches
router.get("/matches", getMatches);
router.patch("/matches/:id/visited", markVisited);

export default router;
