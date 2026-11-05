/**
 * lib/load-product.ts — tylko serwer.
 * Najpierw Admin API (aplikacja Wallify z read_products): widzi każdy aktywny produkt,
 * bez względu na kanał sprzedaży Headless. Gdy aplikacja nie ma tego uprawnienia
 * albo Admin API zawiedzie — dotychczasowa droga przez Storefront API (kanał Headless).
 */

import { cache } from "react";
import { getProduct } from "@/lib/shopify";
import { errorCode, getAdminProduct, isAdminConfigured } from "@/lib/shopify-admin";
import { buildProduct } from "@/lib/product";
import type { Product } from "@/types";

export const loadProduct = cache(async (handle: string): Promise<Product | null> => {
    if (isAdminConfigured()) {
        try {
            const raw = await getAdminProduct(handle);
            if (raw) return buildProduct(raw);
            // Brak w Admin API → produkt nie istnieje albo nie jest aktywny
            return null;
        } catch (err) {
            console.warn(`[Wallify] Produkt „${handle}" przez Admin API niedostępny (${errorCode(err)}), próbuję Storefront API`);
        }
    }
    return getProduct(handle);
});
