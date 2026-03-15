import multer from "multer";

import { BadRequestError } from "../utils/errors.js";

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();

    // Keep gate broad to avoid false-negative JPEG variants from some devices.
    // Strict type verification still happens in item.service.ts via magic bytes.
    const looksLikeImage =
        mime.startsWith("image/") || mime === "application/octet-stream";

    if (!looksLikeImage) {
        cb(
            new BadRequestError(
                "Only image files are allowed",
                "INVALID_IMAGE_TYPE"
            )
        );
        return;
    }
    cb(null, true);
};

export const uploadItemPhotos = multer({
    storage,
    fileFilter,
    limits: {
        // 8MB each photo
        fileSize: 8 * 1024 * 1024,
        // hard limit max 5 files
        files: 5,
    },
});

/** Single-file avatar upload (5 MB max, image only). */
export const avatarUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
    },
});
