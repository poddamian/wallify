"use client";

import { useState, useCallback } from "react";
import ARViewer from "@/components/ARViewer";
import { createCart, addToCart } from "@/lib/shopify";
import CheckoutReady from "@/components/personalization/CheckoutReady";
import { addToShopCart } from "@/lib/cart-bridge";
import { ROUND_WRAP_CM } from "@/lib/product";
import { UploadError, uploadCustomerPhoto, type UploadedPhoto } from "@/lib/upload-client";
import type { Personalization, Product, ProductVariant, ViewerMode } from "@/types";

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
    /** Czy serwer ma dostęp do Shopify Files (zdjęcia klientów trafiają wtedy do zamówienia) */
    uploadsEnabled?: boolean;
}

type CartAttribute = { key: string; value: string };

function personalizationAttributes(p: Personalization, uploaded: UploadedPhoto): CartAttribute[] {
    return [
        { key: "Personalizacja", value: "Twoje zdjęcie" },
        // Klucze z "_" są ukryte dla klienta, ale widoczne w zamówieniu w panelu Shopify
        { key: "_Zdjęcie", value: uploaded.url },
        { key: "_Zdjęcie w panelu", value: uploaded.adminUrl },
        {
            key: "_Kadr",
            value: `x ${p.crop.x}, y ${p.crop.y}, ${p.crop.width} × ${p.crop.height} px (oryginał ${p.original.width} × ${p.original.height} px)`,
        },
        { key: "_Jakość druku", value: `${p.qualityLabel} (${p.dpi} DPI)` },
        ...(p.round
            ? [{
                  key: "_Kształt",
                  value: `okrągły — kadr to front koła, ok. ${ROUND_WRAP_CM} cm zdjęcia wokół kadru zawija się na boki krosna`,
              }]
            : []),
    ];
}

async function addLine(variantId: string, attributes: CartAttribute[]): Promise<string> {
    const savedCartId = readCartId();
    try {
        if (!savedCartId) throw new Error("Brak koszyka");
        return await addToCart(savedCartId, variantId, 1, attributes);
    } catch {
        // Koszyk nie istnieje albo wygasł (Shopify trzyma koszyki ~10 dni) — tworzymy nowy i próbujemy raz jeszcze
        const cart = await createCart();
        saveCartId(cart.cartId);
        return addToCart(cart.cartId, variantId, 1, attributes);
    }
}

export default function ARPageClient({ product, initialMode, aiEnabled, uploadsEnabled = false }: ARPageClientProps) {
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [cartStatus, setCartStatus] = useState<string | null>(null);
    /** Po wysyłce zdjęcia klient sam klika „Przejdź do kasy" — przeglądarki blokują
     *  automatyczne przejście z ramki iframe, gdy od kliknięcia minęło za dużo czasu */
    const [checkout, setCheckout] = useState<{
        url: string;
        photoFailed: boolean;
        personalized: boolean;
        inShopCart: boolean;
    } | null>(null);

    const handleAddToCart = useCallback(
        async (variant: ProductVariant, mode: ViewerMode, personalization?: Personalization) => {
            // Ukryty atrybut linii — w zamówieniu widać, z którego podglądu przyszedł klient
            const attributes: CartAttribute[] = [
                { key: "_Wallify", value: mode === "photo" ? "ze zdjęcia" : "na żywo" },
            ];

            setIsAddingToCart(true);
            try {
                let photoFailed = false;
                if (personalization && uploadsEnabled) {
                    setCartStatus("Wysyłanie zdjęcia… 0%");
                    try {
                        const uploaded = await uploadCustomerPhoto(personalization.file, (f) =>
                            setCartStatus(f === null ? "Wysyłanie zdjęcia…" : `Wysyłanie zdjęcia… ${Math.round(f * 100)}%`)
                        );
                        attributes.push(...personalizationAttributes(personalization, uploaded));
                    } catch (err) {
                        // Nieudana wysyłka nie może blokować zakupu — klient prześle zdjęcie mailem,
                        // a w zamówieniu zostaje kod błędu (szczegóły: /api/upload/status)
                        console.error("[Wallify] Wysyłka zdjęcia nie powiodła się:", err);
                        photoFailed = true;
                        attributes.push(
                            { key: "Personalizacja", value: "zdjęcie prześlę mailem" },
                            { key: "_Błąd wysyłki zdjęcia", value: err instanceof UploadError ? err.code : "nieznany" }
                        );
                    }
                } else if (personalization) {
                    // Wysyłka do Shopify nieskonfigurowana — zostaje dotychczasowa droga mailowa
                    attributes.push({ key: "Personalizacja", value: "zdjęcie prześlę mailem" });
                }

                setCartStatus("Dodawanie do koszyka…");

                // 1) Prawdziwy koszyk sklepu (przez stronę sklepu) — produkt widać w ikonce koszyka
                const shop = await addToShopCart(variant.id, attributes);
                if (shop) {
                    setCheckout({
                        url: `${shop.shopOrigin}/checkout`,
                        photoFailed,
                        personalized: Boolean(personalization),
                        inShopCart: true,
                    });
                    return;
                }

                // 2) Zapasowo: osobny koszyk Storefront API (gdy w sklepie nie ma skryptu mostka)
                const url = await addLine(variant.id, attributes);

                if (personalization && uploadsEnabled) {
                    setCheckout({ url, photoFailed, personalized: true, inShopCart: false });
                } else {
                    // Przekieruj do kasy Shopify — window.top, aby wyjść z ramki iframe
                    (window.top || window).location.href = url;
                }
            } catch (err) {
                console.error("[Wallify] Błąd dodawania do koszyka:", err);
                saveCartId(null);
                alert("Nie udało się dodać do koszyka. Sprawdź połączenie i spróbuj ponownie.");
            } finally {
                setIsAddingToCart(false);
                setCartStatus(null);
            }
        },
        [uploadsEnabled]
    );

    return (
        <main className="relative bg-black min-h-dvh">
            <ARViewer
                product={product}
                onAddToCart={handleAddToCart}
                isAddingToCart={isAddingToCart}
                cartStatus={cartStatus}
                initialMode={initialMode}
                aiEnabled={aiEnabled}
            />
            {checkout && (
                <CheckoutReady
                    url={checkout.url}
                    photoFailed={checkout.photoFailed}
                    personalized={checkout.personalized}
                    inShopCart={checkout.inShopCart}
                    onClose={() => setCheckout(null)}
                />
            )}
        </main>
    );
}
