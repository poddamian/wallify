"use client";

import { motion } from "framer-motion";
import { ShoppingCart, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/product";
import type { VariantSelection } from "@/hooks/useVariantSelection";

interface AddToCartButtonProps {
    selection: VariantSelection;
    onAddToCart?: () => void;
    /** true podczas wywołania Shopify API — blokuje przycisk i pokazuje spinner */
    isLoading?: boolean;
}

/**
 * Przycisk „Dodaj do koszyka" z ceną wybranego wariantu.
 * Druga linia pokazuje dokładnie to, co trafi do koszyka (rozmiar + opcje).
 */
export default function AddToCartButton({
    selection,
    onAddToCart,
    isLoading = false,
}: AddToCartButtonProps) {
    const { variant, size, selectedOptions } = selection;
    const unavailable = !variant || !variant.availableForSale;
    const disabled = isLoading || unavailable;

    const details = [size.label, ...Object.values(selectedOptions)].join(" · ");
    const mainLabel = !variant
        ? "Niedostępne w tym wariancie"
        : !variant.availableForSale
            ? "Chwilowo niedostępne"
            : variant.price
                ? `Dodaj do koszyka · ${formatPrice(variant.price)}`
                : "Dodaj do koszyka";

    return (
        <motion.button
            type="button"
            onClick={() => !disabled && onAddToCart?.()}
            whileTap={disabled ? {} : { scale: 0.96 }}
            whileHover={disabled ? {} : { scale: 1.02 }}
            disabled={disabled}
            aria-busy={isLoading}
            className="w-full flex items-center justify-center gap-3
                 bg-white text-black py-3 px-5 rounded-full
                 shadow-[0_4px_24px_rgba(255,255,255,0.25)]
                 active:shadow-none transition-shadow
                 disabled:opacity-70 disabled:cursor-not-allowed"
        >
            {isLoading ? (
                <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-bold text-base">Dodawanie…</span>
                </>
            ) : (
                <>
                    {!unavailable && <ShoppingCart className="w-5 h-5 shrink-0" />}
                    <span className="flex flex-col items-start leading-tight text-left min-w-0">
                        <span className="font-bold text-base">{mainLabel}</span>
                        <span className="text-xs text-black/60 truncate max-w-full">{details}</span>
                    </span>
                </>
            )}
        </motion.button>
    );
}
