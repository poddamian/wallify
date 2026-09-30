"use client";

import ARViewer from "@/components/ARViewer";
import { buildProduct, type RawVariant } from "@/lib/product";
import type { ProductVariant, ViewerMode } from "@/types";

/**
 * Demo produkt w tym samym kształcie, w jakim zwraca go Storefront API
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

const DEMO_VARIANTS: RawVariant[] = DEMO_SIZES.flatMap(([size, canvas, natural], i) => [
    {
        id: `gid://shopify/ProductVariant/demo-${i}-c`,
        title: `${size} / Canvas`,
        availableForSale: true,
        price: { amount: String(canvas), currencyCode: "PLN" },
        selectedOptions: [
            { name: "Size", value: size },
            { name: "Materiał", value: "Canvas" },
        ],
    },
    {
        id: `gid://shopify/ProductVariant/demo-${i}-n`,
        title: `${size} / Canvas naturalny`,
        availableForSale: true,
        price: { amount: String(natural), currencyCode: "PLN" },
        selectedOptions: [
            { name: "Size", value: size },
            { name: "Materiał", value: "Canvas naturalny" },
        ],
    },
]);

const DEMO_PRODUCT = buildProduct({
    id: "demo-1",
    title: "Las o świcie – obraz na płótnie (demo)",
    imageUrl: "/demo-canvas.jpg",
    variants: DEMO_VARIANTS,
});

export default function DemoClient({ aiEnabled = false }: { aiEnabled?: boolean }) {
    const handleAddToCart = (variant: ProductVariant, mode: ViewerMode) => {
        console.log("[Wallify demo] Dodaj do koszyka:", variant.id, variant.options, mode);
        alert(`Demo: do koszyka trafiłby wariant ${variant.id}`);
    };

    return (
        <main className="bg-black min-h-dvh">
            <ARViewer product={DEMO_PRODUCT} onAddToCart={handleAddToCart} aiEnabled={aiEnabled} />
        </main>
    );
}
