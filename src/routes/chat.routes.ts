import { Router } from "express";

import {
    getConversationDetail,
    listConversations,
    sendConversationMessage,
    startConversation,
} from "../controllers/chat.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);
router.get("/", listConversations);
router.post("/start", startConversation);
router.get("/:id", getConversationDetail);
router.post("/:id/messages", sendConversationMessage);

export default router;
