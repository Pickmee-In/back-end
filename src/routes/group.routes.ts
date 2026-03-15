/**
 * Group Routes
 * Endpoints for group management, voting, and chat
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
    createGroup,
    getGroup,
    getGroupByCode,
    joinGroup,
    leaveGroup,
    setReady,
    submitMemberPreferences,
    startVoting,
    getVotingRestaurants,
    submitVote,
    completeVoting,
    forceCompleteVoting,
    getVotingProgress,
    checkAndAutoComplete,
    getMatchedRestaurant,
    updateLocation,
    updatePreferences,
    deleteGroup,
    getUserGroups,
    sendMessage,
    getMessages,
} from "../controllers/group.controller.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Group CRUD
router.get("/", getUserGroups);
router.post("/", createGroup);
router.get("/code/:code", getGroupByCode);
router.get("/:id", getGroup);
router.delete("/:id", deleteGroup);

// Join/Leave
router.post("/join/:code", joinGroup);
router.post("/:id/leave", leaveGroup);

// Ready status & Member Preferences
router.patch("/:id/ready", setReady);
router.post("/:id/member-preferences", submitMemberPreferences);

// Location & Preferences
router.patch("/:id/location", updateLocation);
router.patch("/:id/preferences", updatePreferences);

// Voting
router.post("/:id/start-voting", startVoting);
router.get("/:id/restaurants", getVotingRestaurants);
router.post("/:id/vote", submitVote);
router.post("/:id/complete", completeVoting);
router.post("/:id/force-complete", forceCompleteVoting);
router.get("/:id/voting-progress", getVotingProgress);
router.post("/:id/check-complete", checkAndAutoComplete);
router.get("/:id/match", getMatchedRestaurant);

// Chat
router.get("/:id/messages", getMessages);
router.post("/:id/messages", sendMessage);

export default router;
