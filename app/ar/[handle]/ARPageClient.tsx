"use client";

import { useState, useCallback } from "react";
import ARViewer from "@/components/ARViewer";
import { createCart, addToCart } from "@/lib/shopify";
import type { Product, ProductVariant, ViewerMode } from "@/types";

const CART_ID_KEY = "wallify_cart_id";

// localStorage w iframe innej domeny bywa zablokowany (np. Safari) — wtedy po prostu tworzymy nowy koszyk
function readCartId(): string | null {
    try {
        return localStorage.getItem(CART_ID_KEY);
    } catch {
        return null;
    }
}

function saveCartId(cartId: string | null) {
    try {
        if (cartId) localStorage.setItem(CART_ID_KEY, cartId);
        else localStorage.removeItem(CART_ID_KEY);
    } catch {
        /* brak dostępu do localStorage — ignorujemy */
    }
}

interface ARPageClientProps {
    product: Product;
    initialMode?: ViewerMode;
    aiEnabled?: boolean;
}

export default function ARPageClient({ product, initialMode, aiEnabled }: ARPageClientProps) {
    const [isAddingToCart, setIsAddingToCart] = useState(false);

    const handleAddToCart = useCallback(async (variant: ProductVariant, mode: ViewerMode) => {
        // Ukryty atrybut linii (klucz z "_") — w zamówieniu widać, z którego podglądu przyszedł klient
        const attributes = [{ key: "_Wallify", value: mode === "photo" ? "ze zdjęcia" : "na żywo" }];

        setIsAddingToCart(true);
        try {
            let checkoutUrl: string;
            const savedCartId = readCartId();

            try {
                if (!savedCartId) throw new Error("Brak koszyka");
                checkoutUrl = await addToCart(savedCartId, variant.id, 1, attributes);
            } catch {
                // Koszyk nie istnieje albo wygasł (Shopify trzyma koszyki ~10 dni) — tworzymy nowy i próbujemy raz jeszcze
                const cart = await createCart();
                saveCartId(cart.cartId);
                checkoutUrl = await addToCart(cart.cartId, variant.id, 1, attributes);
            }

            // Przekieruj do kasy Shopify — window.top, aby wyjść z ramki iframe
            const target = window.top || window;
            target.location.href = checkoutUrl;
        } catch (err) {
            console.error("[Wallify] Błąd dodawania do koszyka:", err);
            saveCartId(null);
            alert("Wystąpił błąd podczas dodawania do koszyka. Spróbuj ponownie.");
        } finally {
            setIsAddingToCart(false);
        }
    }, []);

    return (
        <main className="bg-black min-h-dvh">
            <ARViewer
                product={product}
                onAddToCart={handleAddToCart}
                isAddingToCart={isAddingToCart}
                initialMode={initialMode}
                aiEnabled={aiEnabled}
            />
        </main>
    );
}
