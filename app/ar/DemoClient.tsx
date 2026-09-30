"use client";

import { useState } from "react";
import ARViewer from "@/components/ARViewer";
import { buildProduct, type RawVariant } from "@/lib/product";
import { uploadCustomerPhoto } from "@/lib/upload-client";
import type { Personalization, ProductVariant, ViewerMode } from "@/types";

/**
 * Demo produkty w tym samym kształcie, w jakim zwraca je Storefront API
 * (rozmiar × materiał), żeby demo przechodziło przez to samo mapowanie co sklep.
 */
const DEMO_SIZES: [string, number, number][] = [
    ["30x20", 68.99, 78.99],
    ["40x30", 88.99, 102.99],
    ["70x50", 153.99, 188.99],
    ["90x60", 198.99, 241.99],
    ["100x70", 228.99, 287.99],
    ["120x80", 278.99, 341.99],
];

/** Rozmiary obrazu ze zdjęcia w sklepie (169 formatów) — do testu personalizacji */
const PHOTO_PRODUCT_SIZES = `
    30x20 40x20 45x20 50x20 40x30 60x20 45x30 70x20 50x30 75x20 80x20 50x35 45x40 60x30 90x20 50x40
    100x20 70x30 110x20 50x45 75x30 60x40 80x30 120x20 55x45 60x45 90x30 70x40 60x50 75x40 100x30
    70x45 80x40 110x30 75x45 70x50 80x45 90x40 120x30 75x50 80x50 100x40 90x45 70x60 110x40 75x60
    90x50 100x45 80x60 120x40 110x45 100x50 75x70 90x60 120x45 110x50 80x70 80x75 100x60 120x50
    90x70 145x45 110x60 90x75 100x70 90x80 120x60 100x75 110x70 100x80 110x75 120x70 110x80 100x90
    120x75 120x80 110x90 120x90 110x100 120x100 20x30 20x40 20x45 20x50 20x60 30x40 30x45 20x70
    20x75 30x50 20x80 35x50 20x90 30x60 40x45 20x100 40x50 30x70 20x110 30x75 45x50 20x120 30x80
    40x60 45x55 30x90 45x60 40x70 30x100 40x75 50x60 45x70 40x80 30x110 45x75 50x70 30x120 40x90
    45x80 50x75 40x100 50x80 45x90 60x70 40x110 45x100 50x90 60x75 40x120 60x80 45x110 50x100 70x75
    45x120 60x90 50x110 70x80 50x120 60x100 75x80 70x90 60x110 75x90 70x100 60x120 80x90 75x100
    70x110 80x100 75x110 70x120 80x110 75x120 90x100 80x120 90x110 90x120 100x110 100x120 20x20
    30x30 40x40 45x45 50x50 60x60 70x70 75x75 80x80 90x90
`.trim().split(/\s+/);

function variantsFor(sizes: [string, number, number][]): RawVariant[] {
    return sizes.flatMap(([size, canvas, natural], i) => [
        {
            id: `gid://shopify/ProductVariant/demo-${i}-c`,
            title: `${size} / Canvas`,
            availableForSale: true,
            price: { amount: canvas.toFixed(2), currencyCode: "PLN" },
            selectedOptions: [
                { name: "Rozmiar", value: size },
                { name: "Materiał", value: "Canvas" },
            ],
        },
        {
            id: `gid://shopify/ProductVariant/demo-${i}-n`,
            title: `${size} / Canvas naturalny`,
            availableForSale: true,
            price: { amount: natural.toFixed(2), currencyCode: "PLN" },
            selectedOptions: [
                { name: "Rozmiar", value: size },
                { name: "Materiał", value: "Canvas naturalny" },
            ],
        },
    ]);
}

const DEMO_PRODUCT = buildProduct({
    id: "demo-1",
    title: "Las o świcie – obraz na płótnie (demo)",
    imageUrl: "/demo-canvas.jpg",
    variants: variantsFor(DEMO_SIZES),
});

const DEMO_PHOTO_PRODUCT = buildProduct({
    id: "demo-2",
    title: "Obraz na płótnie ze zdjęcia (demo)",
    imageUrl: "/demo-canvas.jpg",
    tags: ["personalizowany obraz"],
    variants: variantsFor(
        PHOTO_PRODUCT_SIZES.map((s) => {
            const [w, h] = s.split("x").map(Number);
            const base = 40 + (w * h) / 45; // cena orientacyjna, tylko do demo
            return [s, Math.round(base) - 0.01, Math.round(base * 1.15) - 0.01] as [string, number, number];
        })
    ),
});

interface DemoClientProps {
    aiEnabled?: boolean;
    /** /ar?demo=zdjecie — demo obrazu z własnego zdjęcia klienta */
    personalized?: boolean;
    uploadsEnabled?: boolean;
}

export default function DemoClient({ aiEnabled = false, personalized = false, uploadsEnabled = false }: DemoClientProps) {
    const [status, setStatus] = useState<string | null>(null);
    const product = personalized ? DEMO_PHOTO_PRODUCT : DEMO_PRODUCT;

    const handleAddToCart = async (variant: ProductVariant, mode: ViewerMode, p?: Personalization) => {
        console.log("[Wallify demo] Dodaj do koszyka:", variant.id, variant.options, mode);
        let photo = "";
        if (p && uploadsEnabled) {
            try {
                const uploaded = await uploadCustomerPhoto(p.file, (f) =>
                    setStatus(f === null ? "Wysyłanie zdjęcia…" : `Wysyłanie zdjęcia… ${Math.round(f * 100)}%`)
                );
                photo = ` | zdjęcie: ${uploaded.url}`;
            } catch (err) {
                console.error(err);
                photo = " | BŁĄD wysyłki zdjęcia";
            } finally {
                setStatus(null);
            }
        }
        const crop = p ? ` | kadr: ${p.crop.x},${p.crop.y} ${p.crop.width}×${p.crop.height} | ${p.dpi} DPI` : "";
        alert(`Demo: do koszyka trafiłby wariant ${variant.id}${crop}${photo}`);
    };

    return (
        <main className="bg-black min-h-dvh">
            <ARViewer
                product={product}
                onAddToCart={handleAddToCart}
                isAddingToCart={status !== null}
                cartStatus={status}
                aiEnabled={aiEnabled}
            />
        </main>
    );
}
