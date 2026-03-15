import { del, put } from "@vercel/blob";

import { config } from "../config/index.js";
import { BadRequestError } from "../utils/errors.js";

function ensureBlobConfigured() {
    if (!config.blob.readWriteToken) {
        throw new BadRequestError(
            "Vercel Blob is not configured. Set BLOB_READ_WRITE_TOKEN",
            "BLOB_NOT_CONFIGURED"
        );
    }
}

class BlobStorageService {
    async uploadPublicFile(options: {
        folder: string;
        filename: string;
        buffer: Buffer;
        contentType: string;
    }) {
        ensureBlobConfigured();
        const pathname = `${options.folder}/${Date.now()}-${options.filename}`;
        const blob = await put(pathname, options.buffer, {
            access: "public",
            addRandomSuffix: true,
            contentType: options.contentType,
            token: config.blob.readWriteToken,
        });

        return {
            url: blob.url,
            pathname: blob.pathname,
        };
    }

    async deleteByUrl(url?: string | null) {
        if (!url) return;
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            return;
        }
        ensureBlobConfigured();
        try {
            await del(url, { token: config.blob.readWriteToken });
        } catch {
            // ignore best-effort cleanup failures
        }
    }
}

export const blobStorageService = new BlobStorageService();
