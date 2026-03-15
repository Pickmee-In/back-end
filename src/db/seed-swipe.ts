import "dotenv/config";

import { and, eq, inArray } from "drizzle-orm";

import {
    clothingItemPhotos,
    clothingItems,
    db,
    swipes,
    users,
} from "./index.js";

interface SeedUser {
    email: string;
    name: string;
    googleId: string;
    latitude: string;
    longitude: string;
    locationLabel: string;
}

const seedUsers: SeedUser[] = [
    {
        email: "demo.viewer@pickme.app",
        name: "Demo Viewer",
        googleId: "google-demo-viewer",
        latitude: "-6.2087634",
        longitude: "106.845599",
        locationLabel: "Jakarta Pusat",
    },
    {
        email: "nala.owner@pickme.app",
        name: "Nala Owner",
        googleId: "google-nala-owner",
        latitude: "-6.21462",
        longitude: "106.84513",
        locationLabel: "Menteng",
    },
    {
        email: "rama.owner@pickme.app",
        name: "Rama Owner",
        googleId: "google-rama-owner",
        latitude: "-6.2245",
        longitude: "106.8451",
        locationLabel: "Setiabudi",
    },
    {
        email: "sinta.owner@pickme.app",
        name: "Sinta Owner",
        googleId: "google-sinta-owner",
        latitude: "-6.17511",
        longitude: "106.865039",
        locationLabel: "Cikini",
    },
    {
        email: "batik.klaten@pickme.app",
        name: "Sari Klaten",
        googleId: "google-batik-klaten",
        latitude: "-7.7063",
        longitude: "110.6007",
        locationLabel: "Klaten Kota",
    },
    {
        email: "lurik.gantiwarno@pickme.app",
        name: "Budi Gantiwarno",
        googleId: "google-lurik-gantiwarno",
        latitude: "-7.7438",
        longitude: "110.6187",
        locationLabel: "Gantiwarno, Klaten",
    },
    {
        email: "muruh.seller@pickme.app",
        name: "Dewi Muruh",
        googleId: "google-muruh-seller",
        latitude: "-7.7450",
        longitude: "110.6210",
        locationLabel: "Muruh, Gantiwarno",
    },
    {
        email: "mulwo.fashion@pickme.app",
        name: "Tono Mulwo",
        googleId: "google-mulwo-fashion",
        latitude: "-7.6698",
        longitude: "110.5902",
        locationLabel: "Mulwo, Kebonarum",
    },
];

const itemSeeds = [
    {
        ownerEmail: "nala.owner@pickme.app",
        title: "Vintage Denim Jacket",
        category: "jacket",
        size: "M",
        condition: "excellent",
        listingType: "swap",
        isFree: true,
        price: null,
        latitude: "-6.2135",
        longitude: "106.8430",
        locationLabel: "Menteng",
        imageUrl:
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200",
    },
    {
        ownerEmail: "nala.owner@pickme.app",
        title: "Linen Office Shirt",
        category: "shirt",
        size: "L",
        condition: "like_new",
        listingType: "thrift",
        isFree: false,
        price: "85000",
        latitude: "-6.2148",
        longitude: "106.8471",
        locationLabel: "Menteng",
        imageUrl:
            "https://images.unsplash.com/photo-1602810319428-019690571b5b?w=1200",
    },
    {
        ownerEmail: "rama.owner@pickme.app",
        title: "Eco Knit Sweater",
        category: "sweater",
        size: "S",
        condition: "good",
        listingType: "donate",
        isFree: true,
        price: null,
        latitude: "-6.2238",
        longitude: "106.8457",
        locationLabel: "Setiabudi",
        imageUrl:
            "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=1200",
    },
    {
        ownerEmail: "rama.owner@pickme.app",
        title: "Floral Summer Dress",
        category: "dress",
        size: "M",
        condition: "excellent",
        listingType: "thrift",
        isFree: false,
        price: "120000",
        latitude: "-6.2259",
        longitude: "106.8469",
        locationLabel: "Setiabudi",
        imageUrl:
            "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=1200",
    },
    {
        ownerEmail: "sinta.owner@pickme.app",
        title: "Wide Leg Pants",
        category: "pants",
        size: "L",
        condition: "good",
        listingType: "swap",
        isFree: true,
        price: null,
        latitude: "-6.1767",
        longitude: "106.8662",
        locationLabel: "Cikini",
        imageUrl:
            "https://images.unsplash.com/photo-1475180098004-ca77a66827be?w=1200",
    },
    {
        ownerEmail: "sinta.owner@pickme.app",
        title: "Classic White Sneakers",
        category: "shoes",
        size: "42",
        condition: "fair",
        listingType: "donate",
        isFree: true,
        price: null,
        latitude: "-6.1739",
        longitude: "106.8638",
        locationLabel: "Cikini",
        imageUrl:
            "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=1200",
    },
    {
        ownerEmail: "batik.klaten@pickme.app",
        title: "Batik Tulis Klaten Pria",
        category: "shirt",
        size: "L",
        condition: "like_new",
        listingType: "thrift",
        isFree: false,
        price: "95000",
        latitude: "-7.7063",
        longitude: "110.6007",
        locationLabel: "Klaten Kota",
        imageUrl:
            "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1200",
    },
    {
        ownerEmail: "batik.klaten@pickme.app",
        title: "Kebaya Batik Modern Wanita",
        category: "dress",
        size: "M",
        condition: "excellent",
        listingType: "swap",
        isFree: true,
        price: null,
        latitude: "-7.7078",
        longitude: "110.5993",
        locationLabel: "Klaten Kota",
        imageUrl:
            "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=1200",
    },
    {
        ownerEmail: "lurik.gantiwarno@pickme.app",
        title: "Kemeja Lurik Tradisional",
        category: "shirt",
        size: "M",
        condition: "excellent",
        listingType: "thrift",
        isFree: false,
        price: "75000",
        latitude: "-7.7438",
        longitude: "110.6187",
        locationLabel: "Gantiwarno, Klaten",
        imageUrl:
            "https://images.unsplash.com/photo-1602810319428-019690571b5b?w=1200",
    },
    {
        ownerEmail: "muruh.seller@pickme.app",
        title: "Blus Lurik Pelangi Wanita",
        category: "shirt",
        size: "S",
        condition: "excellent",
        listingType: "thrift",
        isFree: false,
        price: "60000",
        latitude: "-7.7450",
        longitude: "110.6210",
        locationLabel: "Muruh, Gantiwarno",
        imageUrl:
            "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=1200",
    },
    {
        ownerEmail: "mulwo.fashion@pickme.app",
        title: "Sweater Rajut Motif Jawa",
        category: "sweater",
        size: "M",
        condition: "good",
        listingType: "donate",
        isFree: true,
        price: null,
        latitude: "-7.6698",
        longitude: "110.5902",
        locationLabel: "Mulwo, Kebonarum",
        imageUrl:
            "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=1200",
    },
    {
        ownerEmail: "mulwo.fashion@pickme.app",
        title: "Sepatu Batik Khas Klaten",
        category: "shoes",
        size: "40",
        condition: "excellent",
        listingType: "thrift",
        isFree: false,
        price: "130000",
        latitude: "-7.6710",
        longitude: "110.5915",
        locationLabel: "Mulwo, Kebonarum",
        imageUrl:
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200",
    },
];

async function seed() {
    console.log("🌱 Seeding PickMe explore/swipe data...");

    const insertedUsers: Record<string, string> = {};

    for (const user of seedUsers) {
        const [existing] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);

        if (existing) {
            insertedUsers[user.email] = existing.id;
            continue;
        }

        const [created] = await db
            .insert(users)
            .values({
                email: user.email,
                name: user.name,
                googleId: user.googleId,
                emailVerified: true,
                isProfileComplete: true,
                latitude: user.latitude,
                longitude: user.longitude,
                locationLabel: user.locationLabel,
            })
            .returning({ id: users.id });

        insertedUsers[user.email] = created.id;
    }

    const createdItemIds: string[] = [];

    for (const seed of itemSeeds) {
        const ownerId = insertedUsers[seed.ownerEmail];
        if (!ownerId) continue;

        const [existing] = await db
            .select({ id: clothingItems.id })
            .from(clothingItems)
            .where(
                and(
                    eq(clothingItems.ownerId, ownerId),
                    eq(clothingItems.title, seed.title)
                )
            )
            .limit(1);

        let itemId = existing?.id;

        if (!itemId) {
            const [created] = await db
                .insert(clothingItems)
                .values({
                    ownerId,
                    title: seed.title,
                    category: seed.category as (typeof clothingItems.category.enumValues)[number],
                    size: seed.size,
                    condition:
                        seed.condition as (typeof clothingItems.condition.enumValues)[number],
                    listingType:
                        seed.listingType as (typeof clothingItems.listingType.enumValues)[number],
                    isFree: seed.isFree,
                    price: seed.price,
                    status: "active",
                    latitude: seed.latitude,
                    longitude: seed.longitude,
                    locationLabel: seed.locationLabel,
                    publishedAt: new Date(),
                })
                .returning({ id: clothingItems.id });

            itemId = created.id;
        }

        if (itemId) {
            createdItemIds.push(itemId);

            const [photo] = await db
                .select({ id: clothingItemPhotos.id })
                .from(clothingItemPhotos)
                .where(eq(clothingItemPhotos.itemId, itemId))
                .limit(1);

            if (!photo) {
                await db.insert(clothingItemPhotos).values({
                    itemId,
                    url: seed.imageUrl,
                    sortOrder: 0,
                    isPrimary: true,
                });
            }
        }
    }

    const viewerId = insertedUsers["demo.viewer@pickme.app"];

    if (viewerId && createdItemIds.length > 0) {
        const existingSwipes = await db
            .select()
            .from(swipes)
            .where(
                and(
                    eq(swipes.userId, viewerId),
                    inArray(swipes.itemId, createdItemIds)
                )
            );

        const existingMap = new Map(existingSwipes.map((s) => [s.itemId, s.id]));

        for (let i = 0; i < createdItemIds.length; i++) {
            const itemId = createdItemIds[i];
            const shouldPick = i % 2 === 0;
            const action = shouldPick ? "pick" : "skip";

            if (existingMap.has(itemId)) continue;

            await db.insert(swipes).values({
                userId: viewerId,
                itemId,
                action,
            });
        }
    }

    console.log("✅ Seed completed.");
    console.log("Demo login target (Google account should create own user):");
    console.log("- Explore items seeded:", createdItemIds.length);
    process.exit(0);
}

seed().catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
});
