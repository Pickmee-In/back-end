import { randomUUID } from "node:crypto";

import sharp from "sharp";
import { and, desc, eq, inArray } from "drizzle-orm";

import {
    clothingAiAnalyses,
    clothingItemPhotos,
    clothingItems,
    db,
    notifications,
} from "../db/index.js";
import { blobStorageService } from "./blob-storage.service.js";
import { config } from "../config/index.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";

type ListingType = "swap" | "donate" | "thrift";
type Category =
    | "jacket"
    | "shirt"
    | "sweater"
    | "dress"
    | "pants"
    | "skirt"
    | "shoes"
    | "accessories"
    | "other";
type Condition = "like_new" | "excellent" | "good" | "fair";

export interface CreateItemInput {
    title?: string;
    description?: string;
    category: Category;
    size: string;
    condition: Condition;
    listingType: ListingType;
    isFree: boolean;
    price?: string | null;
    locationLabel?: string;
    latitude?: string;
    longitude?: string;
    photos: Express.Multer.File[];
}

export interface AiDetectResult {
    success: boolean;
    category?: Category;
    condition?: Condition;
    confidence?: number;
    rawText?: string;
    errorCode?: string;
    errorMessage?: string;
}

const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/png",
    "image/webp",
    "application/octet-stream",
]);

function detectImageType(buffer: Buffer): "jpeg" | "png" | "webp" | null {
    if (buffer.length < 12) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return "jpeg";
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
    ) {
        return "png";
    }

    // WEBP: RIFF....WEBP
    if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
    ) {
        return "webp";
    }

    return null;
}

function canonicalMimeFromType(type: "jpeg" | "png" | "webp"): string {
    switch (type) {
        case "jpeg":
            return "image/jpeg";
        case "png":
            return "image/png";
        case "webp":
            return "image/webp";
    }
}

async function runAntivirusScan(buffer: Buffer): Promise<{
    scanned: boolean;
    clean: boolean;
    detail?: string;
}> {
    if (!config.antivirus.enabled) {
        return { scanned: false, clean: true };
    }

    if (!config.antivirus.scanUrl) {
        // Enabled but no scanner configured: fail-safe
        return {
            scanned: false,
            clean: false,
            detail: "Antivirus is enabled but ANTIVIRUS_SCAN_URL is not configured",
        };
    }

    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        config.antivirus.timeoutMs
    );

    try {
        const resp = await fetch(config.antivirus.scanUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/octet-stream",
            },
            body: buffer,
            signal: controller.signal,
        });

        if (!resp.ok) {
            return {
                scanned: true,
                clean: false,
                detail: `Scanner HTTP ${resp.status}`,
            };
        }

        const json = (await resp.json()) as { clean?: boolean; detail?: string };
        return {
            scanned: true,
            clean: Boolean(json.clean),
            detail: json.detail,
        };
    } catch (error) {
        return {
            scanned: true,
            clean: false,
            detail:
                error instanceof Error ? error.message : "Unknown AV scan error",
        };
    } finally {
        clearTimeout(timeout);
    }
}

function safeDecimalOrNull(value?: string): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (Number.isNaN(num) || num < 0) {
        throw new BadRequestError("Invalid decimal value", "INVALID_DECIMAL");
    }
    return trimmed;
}

/** Like safeDecimalOrNull but allows negative values (for lat/lng coordinates). */
function safeCoordinateOrNull(value?: string): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (Number.isNaN(num)) {
        throw new BadRequestError("Invalid coordinate value", "INVALID_COORDINATE");
    }
    return trimmed;
}

/** Prefix a stored relative path with the server's APP_URL so clients always receive absolute URLs. */
function toAbsoluteUrl(relPath: string | null | undefined): string | null {
    if (!relPath) return null;
    if (relPath.startsWith("http://") || relPath.startsWith("https://")) return relPath;
    return `${config.appUrl}${relPath}`;
}

function normalizeCategory(raw: string): Category {
    const v = raw.trim().toLowerCase();
    const allowed: Category[] = [
        "jacket",
        "shirt",
        "sweater",
        "dress",
        "pants",
        "skirt",
        "shoes",
        "accessories",
        "other",
    ];
    if (!allowed.includes(v as Category)) {
        throw new BadRequestError("Invalid category", "INVALID_CATEGORY");
    }
    return v as Category;
}

function normalizeCondition(raw: string): Condition {
    const v = raw.trim().toLowerCase();
    const allowed: Condition[] = ["like_new", "excellent", "good", "fair"];
    if (!allowed.includes(v as Condition)) {
        throw new BadRequestError("Invalid condition", "INVALID_CONDITION");
    }
    return v as Condition;
}

function normalizeListingType(raw: string): ListingType {
    const v = raw.trim().toLowerCase();
    const allowed: ListingType[] = ["swap", "donate", "thrift"];
    if (!allowed.includes(v as ListingType)) {
        throw new BadRequestError("Invalid listing type", "INVALID_LISTING_TYPE");
    }
    return v as ListingType;
}

async function processAndSavePhoto(file: Express.Multer.File) {
    const normalizedMime = file.mimetype.toLowerCase();
    if (!ALLOWED_MIME.has(normalizedMime)) {
        throw new BadRequestError(
            `Unsupported image type: ${file.mimetype}`,
            "INVALID_IMAGE_TYPE"
        );
    }

    const detectedType = detectImageType(file.buffer);
    if (!detectedType) {
        throw new BadRequestError("Invalid image payload", "INVALID_IMAGE_PAYLOAD");
    }

    const av = await runAntivirusScan(file.buffer);
    if (!av.clean) {
        throw new BadRequestError(
            `File rejected by antivirus scanner: ${av.detail ?? "unknown reason"}`,
            "MALICIOUS_FILE_BLOCKED"
        );
    }

    const image = sharp(file.buffer, { failOn: "error" }).rotate();

    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
        throw new BadRequestError("Unable to read image metadata", "INVALID_IMAGE");
    }

    // Guard absurd resolutions (security/perf)
    if (metadata.width > 12000 || metadata.height > 12000) {
        throw new BadRequestError("Image resolution too large", "IMAGE_TOO_LARGE");
    }

    const id = randomUUID();
    const fileName = `${id}.webp`;

    // Convert to WebP + quality 80
    const outputBuffer = await image
        .webp({ quality: 80, effort: 4 })
        .toBuffer();

    const uploaded = await blobStorageService.uploadPublicFile({
        folder: "items",
        filename: fileName,
        buffer: outputBuffer,
        contentType: "image/webp",
    });

    return {
        fileName,
        publicUrl: uploaded.url,
        sourceMime: canonicalMimeFromType(detectedType),
        width: metadata.width,
        height: metadata.height,
        size: outputBuffer.length,
    };
}

function parseGeminiJson(text: string): {
    category?: string;
    condition?: string;
    confidence?: number;
} {
    const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    try {
        return JSON.parse(cleaned) as {
            category?: string;
            condition?: string;
            confidence?: number;
        };
    } catch {
        // last attempt: extract object-like region
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
            const slice = cleaned.slice(start, end + 1);
            return JSON.parse(slice) as {
                category?: string;
                condition?: string;
                confidence?: number;
            };
        }
        throw new BadRequestError("Invalid AI response format", "AI_INVALID_FORMAT");
    }
}

const modelCooldownUntil = new Map<string, number>();

export class ItemService {
    async analyzePhotoWithGemini(
        file: Express.Multer.File
    ): Promise<AiDetectResult> {
        if (!config.geminiApiKey) {
            return {
                success: false,
                errorCode: "GEMINI_NOT_CONFIGURED",
                errorMessage:
                    "Gemini API key is missing. User must fill fields manually.",
            };
        }

        let analysisBuffer = file.buffer;
        let canonicalMime = "image/jpeg";

        try {
            analysisBuffer = await sharp(file.buffer, { failOn: "none" })
                .rotate()
                .resize({
                    width: 768,
                    height: 768,
                    fit: "inside",
                    withoutEnlargement: true,
                })
                .jpeg({ quality: 80 })
                .toBuffer();
            canonicalMime = "image/jpeg";
        } catch {
            const detectedType = detectImageType(file.buffer);
            if (!detectedType) {
                return {
                    success: false,
                    errorCode: "INVALID_IMAGE",
                    errorMessage: "Invalid image format. Please upload JPG/PNG/WEBP.",
                };
            }
            canonicalMime = canonicalMimeFromType(detectedType);
        }

        const prompt =
            "You analyze fashion item images. Return JSON only with keys: category, condition, confidence. " +
            "Allowed category: jacket, shirt, sweater, dress, pants, skirt, shoes, accessories, other. " +
            "Allowed condition: like_new, excellent, good, fair. " +
            "confidence is 0..1.";

        try {
            const allModels = Array.from(
                new Set([
                    config.geminiModel,
                    "gemini-3.8-flash",
                    "gemini-3.5-flash-lite",
                    "gemini-3.5-flash",
                    "gemini-3-flash-preview",
                ].filter(Boolean))
            );

            const now = Date.now();
            const activeModels = allModels.filter(
                (m) => (modelCooldownUntil.get(m) ?? 0) <= now
            );
            const candidateModels =
                activeModels.length > 0 ? activeModels : allModels;

            const requestBody = JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: canonicalMime,
                                    data: analysisBuffer.toString("base64"),
                                },
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 1024,
                    responseMimeType: "application/json",
                },
            });

            let resp: Response | null = null;
            let lastErrorStatus = 0;
            let lastErrorText = "";

            for (const modelName of candidateModels) {
                const cleanModel = modelName.replace(/^models\//, "");
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`;
                const timeoutMs = cleanModel.includes("3.8") ? 4500 : 15000;

                try {
                    const currentResp = await fetch(endpoint, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-goog-api-key": config.geminiApiKey,
                        },
                        signal: AbortSignal.timeout(timeoutMs),
                        body: requestBody,
                    });

                    if (currentResp.ok) {
                        resp = currentResp;
                        modelCooldownUntil.delete(modelName);
                        break;
                    }

                    lastErrorStatus = currentResp.status;
                    lastErrorText = await currentResp.text();

                    if (
                        currentResp.status === 503 ||
                        currentResp.status === 429 ||
                        currentResp.status === 404 ||
                        currentResp.status >= 500
                    ) {
                        modelCooldownUntil.set(modelName, Date.now() + 3 * 60_000);
                        continue;
                    }

                    break;
                } catch (fetchErr) {
                    // Timeout or network error on this model: put on short cooldown and try next fallback model
                    lastErrorStatus = 504;
                    lastErrorText =
                        fetchErr instanceof Error
                            ? fetchErr.message
                            : "Model request timed out";
                    modelCooldownUntil.set(modelName, Date.now() + 3 * 60_000);
                    continue;
                }
            }

            if (!resp || !resp.ok) {
                return {
                    success: false,
                    errorCode: "GEMINI_HTTP_ERROR",
                    errorMessage: `Gemini error ${lastErrorStatus}: ${lastErrorText}`,
                };
            }

            const json = (await resp.json()) as any;
            const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
            const textPart =
                parts.find((p: any) => typeof p?.text === "string" && !p?.thought) ??
                parts.find((p: any) => typeof p?.text === "string");
            const text = textPart?.text ?? "";

            if (!text) {
                return {
                    success: false,
                    errorCode: "GEMINI_EMPTY",
                    errorMessage: "Gemini returned empty analysis.",
                };
            }

            const parsed = parseGeminiJson(text);

            let category: Category | undefined;
            if (parsed.category) {
                try {
                    category = normalizeCategory(parsed.category);
                } catch {
                    category = "other";
                }
            }

            let condition: Condition | undefined;
            if (parsed.condition) {
                try {
                    condition = normalizeCondition(parsed.condition);
                } catch {
                    condition = "good";
                }
            }

            return {
                success: true,
                category,
                condition,
                confidence:
                    typeof parsed.confidence === "number"
                        ? parsed.confidence
                        : undefined,
                rawText: text,
            };
        } catch (error) {
            return {
                success: false,
                errorCode: "GEMINI_RUNTIME_ERROR",
                errorMessage:
                    error instanceof Error
                        ? error.message
                        : "Unknown AI runtime error",
            };
        }
    }

    async createItem(userId: string, input: CreateItemInput) {
        if (!input.photos || input.photos.length === 0) {
            throw new BadRequestError("At least 1 photo is required", "PHOTO_REQUIRED");
        }

        if (input.photos.length > 5) {
            throw new BadRequestError("Maximum 5 photos allowed", "PHOTO_LIMIT_EXCEEDED");
        }

        const size = input.size?.trim();
        if (!size) {
            throw new BadRequestError("Size is required", "SIZE_REQUIRED");
        }

        const title =
            input.title?.trim() ||
            `${input.category.charAt(0).toUpperCase()}${input.category.slice(1)} Item`;

        // Optimize and persist all photos first
        const processed = [] as Array<{
            fileName: string;
            publicUrl: string;
            sourceMime: string;
            width: number;
            height: number;
            size: number;
        }>;

        for (const file of input.photos) {
            processed.push(await processAndSavePhoto(file));
        }

        const [created] = await db
            .insert(clothingItems)
            .values({
                ownerId: userId,
                title,
                description: input.description?.trim() || null,
                category: normalizeCategory(input.category),
                size,
                condition: normalizeCondition(input.condition),
                listingType: normalizeListingType(input.listingType),
                isFree: input.isFree,
                price: input.isFree ? null : safeDecimalOrNull(input.price ?? undefined),
                status: "active",
                locationLabel: input.locationLabel?.trim() || null,
                latitude: safeCoordinateOrNull(input.latitude),
                longitude: safeCoordinateOrNull(input.longitude),
                publishedAt: new Date(),
            })
            .returning({ id: clothingItems.id });

        const itemId = created.id;

        for (let i = 0; i < processed.length; i++) {
            const p = processed[i];
            await db.insert(clothingItemPhotos).values({
                itemId,
                url: p.publicUrl,
                sortOrder: i,
                isPrimary: i === 0,
            });
        }

        await db.insert(notifications).values({
            userId,
            type: "item",
            title: "Item berhasil dipublikasikan",
            body: `${title} sekarang tampil di PickMe`,
            data: { itemId },
        });

        // Optional AI analysis from first photo
        let aiDetect: AiDetectResult | undefined;
        if (input.photos.length > 0) {
            aiDetect = await this.analyzePhotoWithGemini(input.photos[0]);
            if (aiDetect.success) {
                await db.insert(clothingAiAnalyses).values({
                    itemId,
                    detectedCategory: aiDetect.category,
                    estimatedCondition: aiDetect.condition,
                    confidence:
                        aiDetect.confidence != null
                            ? aiDetect.confidence.toFixed(2)
                            : null,
                    recommendation: "Gemini auto-analysis",
                    rawResult: {
                        rawText: aiDetect.rawText,
                        confidence: aiDetect.confidence,
                    },
                });
            }
        }

        const photos = await db
            .select()
            .from(clothingItemPhotos)
            .where(eq(clothingItemPhotos.itemId, itemId))
            .orderBy(clothingItemPhotos.sortOrder);

        return {
            itemId,
            photos: photos.map((p) => ({ ...p, url: toAbsoluteUrl(p.url) ?? p.url })),
            aiAnalysis: aiDetect ?? {
                success: false,
                errorCode: "AI_NOT_RUN",
                errorMessage: "AI analysis not executed",
            },
        };
    }

    async updateItem(
        userId: string,
        itemId: string,
        input: Partial<CreateItemInput> & { photos?: Express.Multer.File[] }
    ) {
        const [existing] = await db
            .select()
            .from(clothingItems)
            .where(and(eq(clothingItems.id, itemId), eq(clothingItems.ownerId, userId)))
            .limit(1);

        if (!existing) {
            throw new NotFoundError("Item not found");
        }

        const patch: Partial<typeof clothingItems.$inferInsert> = {};

        if (input.title != null) patch.title = input.title.trim() || existing.title;
        if (input.description != null) patch.description = input.description.trim() || null;
        if (input.category != null) patch.category = normalizeCategory(input.category);
        if (input.size != null) patch.size = input.size.trim() || existing.size;
        if (input.condition != null) patch.condition = normalizeCondition(input.condition);
        if (input.listingType != null) {
            patch.listingType = normalizeListingType(input.listingType);
        }
        if (input.isFree != null) patch.isFree = input.isFree;
        if (input.price != null) patch.price = safeDecimalOrNull(input.price ?? undefined);
        if (input.locationLabel != null) patch.locationLabel = input.locationLabel.trim() || null;
        if (input.latitude != null) patch.latitude = safeCoordinateOrNull(input.latitude);
        if (input.longitude != null) patch.longitude = safeCoordinateOrNull(input.longitude);
        patch.updatedAt = new Date();

        if (Object.keys(patch).length > 0) {
            await db.update(clothingItems).set(patch).where(eq(clothingItems.id, itemId));
        }

        if (input.photos && input.photos.length > 0) {
            if (input.photos.length > 5) {
                throw new BadRequestError(
                    "Maximum 5 photos allowed",
                    "PHOTO_LIMIT_EXCEEDED"
                );
            }

            const oldPhotos = await db
                .select()
                .from(clothingItemPhotos)
                .where(eq(clothingItemPhotos.itemId, itemId));

            const processed: Array<{
                fileName: string;
                publicUrl: string;
                sourceMime: string;
                width: number;
                height: number;
                size: number;
            }> = [];

            for (const file of input.photos) {
                processed.push(await processAndSavePhoto(file));
            }

            await db.delete(clothingItemPhotos).where(eq(clothingItemPhotos.itemId, itemId));

            for (let i = 0; i < processed.length; i++) {
                const p = processed[i];
                await db.insert(clothingItemPhotos).values({
                    itemId,
                    url: p.publicUrl,
                    sortOrder: i,
                    isPrimary: i === 0,
                });
            }

            // best-effort cleanup old files
            await Promise.all(oldPhotos.map((photo) => blobStorageService.deleteByUrl(photo.url)));
        }

        return this.getMyItemById(userId, itemId);
    }

    async deleteItem(userId: string, itemId: string) {
        const [existing] = await db
            .select()
            .from(clothingItems)
            .where(and(eq(clothingItems.id, itemId), eq(clothingItems.ownerId, userId)))
            .limit(1);

        if (!existing) {
            throw new NotFoundError("Item not found");
        }

        const photos = await db
            .select()
            .from(clothingItemPhotos)
            .where(eq(clothingItemPhotos.itemId, itemId));

        await db
            .update(clothingItems)
            .set({ status: "removed", updatedAt: new Date() })
            .where(eq(clothingItems.id, itemId));

        await Promise.all(photos.map((photo) => blobStorageService.deleteByUrl(photo.url)));

        return { success: true };
    }

    async getMyItemById(userId: string, itemId: string) {
        const [item] = await db
            .select()
            .from(clothingItems)
            .where(
                and(
                    eq(clothingItems.id, itemId),
                    eq(clothingItems.ownerId, userId),
                    inArray(clothingItems.status, ["active", "completed"])
                )
            )
            .limit(1);

        if (!item) {
            throw new NotFoundError("Item not found");
        }

        const photos = await db
            .select()
            .from(clothingItemPhotos)
            .where(eq(clothingItemPhotos.itemId, itemId))
            .orderBy(clothingItemPhotos.sortOrder);

        return {
            item: {
                id: item.id,
                title: item.title,
                description: item.description,
                category: item.category,
                size: item.size,
                condition: item.condition,
                listingType: item.listingType,
                status: item.status,
                isCompleted: item.status === "completed",
                isFree: item.isFree,
                price: item.price,
                locationLabel: item.locationLabel,
                latitude: item.latitude,
                longitude: item.longitude,
                photos: photos.map((p) => ({ ...p, url: toAbsoluteUrl(p.url) ?? p.url })),
                updatedAt: item.updatedAt,
            },
        };
    }

    async listMyItems(userId: string) {
        const rows = await db
            .select()
            .from(clothingItems)
            .where(
                and(
                    eq(clothingItems.ownerId, userId),
                    inArray(clothingItems.status, ["active", "completed"])
                )
            )
            .orderBy(desc(clothingItems.createdAt));

        if (!rows.length) return { items: [] };

        const ids = rows.map((r) => r.id);
        const photos = await db
            .select()
            .from(clothingItemPhotos)
            .where(inArray(clothingItemPhotos.itemId, ids));

        const photoMap = new Map<string, string>();
        for (const p of photos) {
            const current = photoMap.get(p.itemId);
            if (!current || p.isPrimary) photoMap.set(p.itemId, p.url);
        }

        return {
            items: rows.map((r) => ({
                id: r.id,
                title: r.title,
                category: r.category,
                condition: r.condition,
                listingType: r.listingType,
                status: r.status,
                isCompleted: r.status === "completed",
                size: r.size,
                isFree: r.isFree,
                price: r.price,
                imageUrl: toAbsoluteUrl(photoMap.get(r.id) ?? null),
                createdAt: r.createdAt,
            })),
        };
    }
}

export const itemService = new ItemService();
