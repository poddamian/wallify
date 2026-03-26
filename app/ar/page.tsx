"use client";

import ARViewer from "@/components/ARViewer";
import type { CanvasSize, Product } from "@/types";

/** Demo produkt — zastąp danymi z Shopify Storefront API */
const DEMO_PRODUCT: Product = {
    id: "demo-1",
    title: "Las o świcie",
    imageUrl: "/demo-canvas.jpg",
    shopifyVariantId: "gid://shopify/ProductVariant/1234567890",
    availableSizes: [
        { id: "s1", label: "30 × 20 cm", widthCm: 30, heightCm: 20 },
        { id: "s2", label: "40 × 30 cm", widthCm: 40, heightCm: 30 },
        { id: "s3", label: "70 × 50 cm", widthCm: 70, heightCm: 50 },
        { id: "s4", label: "90 × 60 cm", widthCm: 90, heightCm: 60 },
        { id: "s5", label: "100 × 70 cm", widthCm: 100, heightCm: 70 },
        { id: "s6", label: "120 × 80 cm", widthCm: 120, heightCm: 80 },
    ],
};

export default function ARPage() {
    const handleAddToCart = (size: CanvasSize) => {
        // TODO: Integracja z Shopify Buy SDK / Storefront API
        // Przykład:
        // await shopifyClient.checkout.addLineItems(checkoutId, [{
        //   variantId: product.shopifyVariantId,
        //   quantity: 1,
        //   customAttributes: [{ key: 'rozmiar', value: size.label }]
        // }])
        console.log("[Wallify] Dodaj do koszyka:", DEMO_PRODUCT.title, size.label);
        alert(`Dodano "${DEMO_PRODUCT.title}" (${size.label}) do koszyka!`);
    };

    return (
        <main className="bg-black min-h-dvh">
            <ARViewer product={DEMO_PRODUCT} onAddToCart={handleAddToCart} />
        </main>
    );
}
