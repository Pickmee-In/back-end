import { del, put } from "@vercel/blob";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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
        if (config.storage.provider === "local") {
            const folder = options.folder.replace(/^\/+|\/+$/g, "");
            if (!/^[a-zA-Z0-9_/-]+$/.test(folder)) {
                throw new BadRequestError("Invalid upload folder", "INVALID_UPLOAD_FOLDER");
            }
            const filename = `${randomUUID()}-${path.basename(options.filename).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
            const pathname = `${folder}/${filename}`;
            const destination = path.join(config.storage.uploadDir, pathname);
            await mkdir(path.dirname(destination), { recursive: true });
            await writeFile(destination, options.buffer, { flag: "wx", mode: 0o640 });
            return { url: `${config.appUrl.replace(/\/$/, "")}/uploads/${pathname}`, pathname };
        }
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
        if (config.storage.provider === "local") {
            const prefix = `${config.appUrl.replace(/\/$/, "")}/uploads/`;
            if (!url.startsWith(prefix)) return;
            try {
                const relative = decodeURIComponent(url.slice(prefix.length));
                const destination = path.resolve(config.storage.uploadDir, relative);
                if (!destination.startsWith(config.storage.uploadDir + path.sep)) return;
                await unlink(destination);
            } catch {
                // Best-effort cleanup, including files already removed.
            }
            return;
        }
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
