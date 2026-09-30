"use client";

import { useMemo, useState } from "react";
import { defaultSelection, findVariant } from "@/lib/product";
import type { CanvasSize, Product, ProductVariant } from "@/types";

export type VariantSelection = {
    size: CanvasSize;
    setSizeId: (id: string) => void;
    selectedOptions: Record<string, string>;
    setOption: (name: string, value: string) => void;
    /** Wariant do koszyka — undefined, gdy takiej kombinacji nie ma w sklepie */
    variant: ProductVariant | undefined;
    /** Czy dana kombinacja (rozmiar + opcje) istnieje i jest dostępna */
    isAvailable: (sizeId: string, options: Record<string, string>) => boolean;
};

/** Wspólny stan wyboru rozmiaru i opcji — dzielony przez tryb na żywo i tryb ze zdjęcia. */
export function useVariantSelection(product: Product): VariantSelection {
    const initial = useMemo(() => defaultSelection(product), [product]);
    const [sizeId, setSizeId] = useState(initial.sizeId);
    const [selectedOptions, setSelectedOptions] = useState(initial.options);

    const size = product.sizes.find((s) => s.id === sizeId) ?? product.sizes[0];
    const variant = findVariant(product, size.id, selectedOptions);

    return {
        size,
        setSizeId,
        selectedOptions,
        setOption: (name, value) => setSelectedOptions((prev) => ({ ...prev, [name]: value })),
        variant,
        isAvailable: (id, options) => Boolean(findVariant(product, id, options)?.availableForSale),
    };
}
