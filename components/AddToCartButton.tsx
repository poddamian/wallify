"use client";

import { motion } from "framer-motion";
import { ShoppingCart, Loader2 } from "lucide-react";
import type { CanvasSize } from "@/types";

interface AddToCartButtonProps {
    size: CanvasSize;
    onAddToCart?: (size: CanvasSize) => void;
    /** true podczas wywołania Shopify API — blokuje przycisk i pokazuje spinner */
    isLoading?: boolean;
}

export default function AddToCartButton({
    size,
    onAddToCart,
    isLoading = false,
}: AddToCartButtonProps) {
    return (
        <motion.button
            onClick={() => !isLoading && onAddToCart?.(size)}
            whileTap={isLoading ? {} : { scale: 0.96 }}
            whileHover={isLoading ? {} : { scale: 1.02 }}
            disabled={isLoading}
            aria-busy={isLoading}
            className="w-full flex items-center justify-center gap-3
                 bg-white text-black py-4 rounded-full
                 font-bold text-lg shadow-[0_4px_24px_rgba(255,255,255,0.25)]
                 active:shadow-none transition-shadow
                 disabled:opacity-70 disabled:cursor-not-allowed"
        >
            {isLoading ? (
                <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Dodawanie…
                </>
            ) : (
                <>
                    <ShoppingCart className="w-5 h-5" />
                    Dodaj do koszyka — {size.label}
                </>
            )}
        </motion.button>
    );
}
