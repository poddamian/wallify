"use client";

import { useState, useCallback } from "react";
import ARViewer from "@/components/ARViewer";
import { createCart, addToCart } from "@/lib/shopify";
import type { CanvasSize, Product } from "@/types";

const CART_ID_KEY = "wallify_cart_id";

interface ARPageClientProps {
    product: Product;
}

export default function ARPageClient({ product }: ARPageClientProps) {
    const [isAddingToCart, setIsAddingToCart] = useState(false);

    const handleAddToCart = useCallback(
        async (size: CanvasSize) => {
            // Użyj shopifyVariantId z wybranego rozmiaru (ustawionego przez getProduct),
            // albo fallback do wariantu z produktu
            const variantId = size.shopifyVariantId ?? product.shopifyVariantId;

            setIsAddingToCart(true);
            try {
                // Pobierz lub utwórz cartId z localStorage
                let cartId = localStorage.getItem(CART_ID_KEY);
                if (!cartId) {
                    const cart = await createCart();
                    cartId = cart.cartId;
                    localStorage.setItem(CART_ID_KEY, cartId);
                }

                // Dodaj produkt do koszyka i pobierz URL do kasy
                const checkoutUrl = await addToCart(cartId, variantId, 1);

                // Przekieruj do kasy Shopify
                window.location.href = checkoutUrl;
            } catch (err) {
                console.error("[Wallify] Błąd dodawania do koszyka:", err);

                // Jeśli koszyk wygasł (Shopify koszyki wygasają po ~10 dniach),
                // usuń stary cartId i spróbuj ponownie
                localStorage.removeItem(CART_ID_KEY);
                alert("Wystąpił błąd podczas dodawania do koszyka. Spróbuj ponownie.");
            } finally {
                setIsAddingToCart(false);
            }
        },
        [product.shopifyVariantId]
    );

    return (
        <main className="bg-black min-h-dvh">
            <ARViewer
                product={product}
                onAddToCart={handleAddToCart}
                isAddingToCart={isAddingToCart}
            />
        </main>
    );
}
