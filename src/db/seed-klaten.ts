import "dotenv/config";

import { and, eq, inArray } from "drizzle-orm";

import {
    clothingItemPhotos,
    clothingItems,
    db,
    swipes,
    users,
} from "./index.js";

// ─── Klaten-area seed data ───────────────────────────────────────────────────
// Villages: Mulwo (Kebonarum), Muruh (Gantiwarno), Gantiwarno, Klaten Kota
// Klaten is famous for Batik and Lurik fabric production in Central Java

interface SeedUser {
    email: string;
    name: string;
    googleId: string;
    latitude: string;
    longitude: string;
    locationLabel: string;
}

const klatenUsers: SeedUser[] = [
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
    {
        email: "demo.klaten@pickme.app",
        name: "Demo Klaten Viewer",
        googleId: "google-demo-klaten",
        latitude: "-7.7063",
        longitude: "110.6007",
        locationLabel: "Klaten Kota",
    },
];

const klatenItems = [
    // ── Klaten Kota items ──────────────────────────────────────────────────
    {
        ownerEmail: "batik.klaten@pickme.app",
        title: "Batik Tulis Klaten Pria",
        category: "shirt" as const,
        size: "L",
        condition: "like_new" as const,
        listingType: "thrift" as const,
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
        category: "dress" as const,
        size: "M",
        condition: "excellent" as const,
        listingType: "swap" as const,
        isFree: true,
        price: null,
        latitude: "-7.7078",
        longitude: "110.5993",
        locationLabel: "Klaten Kota",
        imageUrl:
            "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=1200",
    },
    {
        ownerEmail: "batik.klaten@pickme.app",
        title: "Jaket Batik Kontemporer",
        category: "jacket" as const,
        size: "XL",
        condition: "good" as const,
        listingType: "donate" as const,
        isFree: true,
        price: null,
        latitude: "-7.7049",
        longitude: "110.6018",
        locationLabel: "Klaten Kota",
        imageUrl:
            "https://images.unsplash.com/photo-1548286978-f218023f8d18?w=1200",
    },

    // ── Gantiwarno items ───────────────────────────────────────────────────
    {
        ownerEmail: "lurik.gantiwarno@pickme.app",
        title: "Kemeja Lurik Tradisional",
        category: "shirt" as const,
        size: "M",
        condition: "excellent" as const,
        listingType: "thrift" as const,
        isFree: false,
        price: "75000",
        latitude: "-7.7438",
        longitude: "110.6187",
        locationLabel: "Gantiwarno, Klaten",
        imageUrl:
            "https://images.unsplash.com/photo-1602810319428-019690571b5b?w=1200",
    },
    {
        ownerEmail: "lurik.gantiwarno@pickme.app",
        title: "Celana Lurik Batik Pria",
        category: "pants" as const,
        size: "L",
        condition: "good" as const,
        listingType: "donate" as const,
        isFree: true,
        price: null,
        latitude: "-7.7425",
        longitude: "110.6195",
        locationLabel: "Gantiwarno, Klaten",
        imageUrl:
            "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200",
    },
    {
        ownerEmail: "lurik.gantiwarno@pickme.app",
        title: "Rok Batik Jarik Panjang",
        category: "skirt" as const,
        size: "S",
        condition: "like_new" as const,
        listingType: "swap" as const,
        isFree: true,
        price: null,
        latitude: "-7.7451",
        longitude: "110.6170",
        locationLabel: "Gantiwarno, Klaten",
        imageUrl:
            "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=1200",
    },

    // ── Muruh items ────────────────────────────────────────────────────────
    {
        ownerEmail: "muruh.seller@pickme.app",
        title: "Blus Lurik Pelangi Wanita",
        category: "shirt" as const,
        size: "S",
        condition: "excellent" as const,
        listingType: "thrift" as const,
        isFree: false,
        price: "60000",
        latitude: "-7.7450",
        longitude: "110.6210",
        locationLabel: "Muruh, Gantiwarno",
        imageUrl:
            "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=1200",
    },
    {
        ownerEmail: "muruh.seller@pickme.app",
        title: "Aksesori Batik Klaten Set",
        category: "accessories" as const,
        size: "Free Size",
        condition: "like_new" as const,
        listingType: "donate" as const,
        isFree: true,
        price: null,
        latitude: "-7.7462",
        longitude: "110.6203",
        locationLabel: "Muruh, Gantiwarno",
        imageUrl:
            "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=1200",
    },

    // ── Mulwo items ────────────────────────────────────────────────────────
    {
        ownerEmail: "mulwo.fashion@pickme.app",
        title: "Sweater Rajut Motif Jawa",
        category: "sweater" as const,
        size: "M",
        condition: "good" as const,
        listingType: "donate" as const,
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
        category: "shoes" as const,
        size: "40",
        condition: "excellent" as const,
        listingType: "thrift" as const,
        isFree: false,
        price: "130000",
        latitude: "-7.6710",
        longitude: "110.5915",
        locationLabel: "Mulwo, Kebonarum",
        imageUrl:
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200",
    },
    {
        ownerEmail: "mulwo.fashion@pickme.app",
        title: "Rompi Batik Pria Casual",
        category: "jacket" as const,
        size: "L",
        condition: "like_new" as const,
        listingType: "swap" as const,
        isFree: true,
        price: null,
        latitude: "-7.6685",
        longitude: "110.5890",
        locationLabel: "Mulwo, Kebonarum",
        imageUrl:
            "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=1200",
    },
];

async function seedKlaten() {
    console.log("🌱 Seeding PickMe Klaten-area data...");

    const insertedUsers: Record<string, string> = {};

    for (const user of klatenUsers) {
        const [existing] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, user.email))
            .limit(1);

        if (existing) {
            insertedUsers[user.email] = existing.id;
            console.log(`  ↩  User already exists: ${user.name}`);
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
        console.log(`  ✅ Created user: ${user.name} (${user.locationLabel})`);
    }

    const createdItemIds: string[] = [];

    for (const seed of klatenItems) {
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
                    category: seed.category,
                    size: seed.size,
                    condition: seed.condition,
                    listingType: seed.listingType,
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
            console.log(`  ✅ Created item: ${seed.title}`);
        } else {
            console.log(`  ↩  Item already exists: ${seed.title}`);
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

    // Create demo swipe records for the Klaten demo viewer
    const viewerId = insertedUsers["demo.klaten@pickme.app"];

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
            if (existingMap.has(itemId)) continue;

            // Alternate: pick first, skip second, pick third, etc.
            const action = i % 2 === 0 ? "pick" : "skip";

            await db.insert(swipes).values({
                userId: viewerId,
                itemId,
                action,
            });
        }

        console.log(
            `  ✅ Created demo swipe records for Klaten viewer (${createdItemIds.length} items)`
        );
    }

    console.log("\n🎉 Klaten seed completed!");
    console.log(`   Items seeded: ${createdItemIds.length}`);
    console.log(`   Villages: Klaten Kota, Gantiwarno, Muruh, Mulwo`);
    process.exit(0);
}

seedKlaten().catch((error) => {
    console.error("❌ Klaten seed failed:", error);
    process.exit(1);
});
