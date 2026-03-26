"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, RefreshCw } from "lucide-react";

import { useCamera } from "@/hooks/useCamera";
import CanvasOverlay from "./CanvasOverlay";
import SizePicker from "./SizePicker";
import AddToCartButton from "./AddToCartButton";
import type { ARState, CanvasSize, Product } from "@/types";

/** Rozmiary poziome dostępne w sklepie (szerokość × wysokość w cm) */
const SIZES: CanvasSize[] = [
    { id: "s1", label: "30 × 20 cm", widthCm: 30, heightCm: 20 },
    { id: "s2", label: "40 × 30 cm", widthCm: 40, heightCm: 30 },
    { id: "s3", label: "70 × 50 cm", widthCm: 70, heightCm: 50 },
    { id: "s4", label: "90 × 60 cm", widthCm: 90, heightCm: 60 },
    { id: "s5", label: "100 × 70 cm", widthCm: 100, heightCm: 70 },
    { id: "s6", label: "120 × 80 cm", widthCm: 120, heightCm: 80 },
];

interface ARViewerProps {
    product: Product;
    onAddToCart?: (size: CanvasSize) => void;
    /** Przekazywane do AddToCartButton — blokuje przycisk podczas wywołania API */
    isAddingToCart?: boolean;
}

export default function ARViewer({ product, onAddToCart, isAddingToCart = false }: ARViewerProps) {
    const [arState, setArState] = useState<ARState>("idle");
    const [selectedSize, setSelectedSize] = useState<CanvasSize>(SIZES[2]); // 70×50 jako domyślny
    const { videoRef, status, error, startCamera, stopCamera } = useCamera();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (arState !== "requesting") return;
        if (status === "active") setArState("scanning");
        if (status === "denied") setArState("denied");
        if (status === "error") setArState("error");
    }, [status, arState]);

    const handleStart = () => {
        setArState("requesting");
        startCamera();
    };

    const handleReset = () => {
        stopCamera();
        setArState("idle");
    };

    // ─── IDLE ────────────────────────────────────────────────────────────────
    if (arState === "idle") {
        return (
            <motion.div
                className="flex flex-col items-center gap-8 p-8 text-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Camera className="w-9 h-9 text-white/80" />
                </div>

                <div className="space-y-3">
                    <h2 className="text-2xl font-bold text-white leading-tight">
                        Sprawdź, jak to będzie<br />wyglądać na Twojej ścianie
                    </h2>
                    <p className="text-white/50 text-sm max-w-xs leading-relaxed">
                        Skieruj kamerę na ścianę i od razu sprawdź, jak&nbsp;
                        <span className="text-white font-medium">{product.title}</span> będzie
                        prezentować się w Twoim wnętrzu.
                    </p>
                </div>

                <motion.button
                    onClick={handleStart}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.03 }}
                    className="bg-white text-black px-8 py-4 rounded-full text-base font-bold
                     shadow-[0_4px_24px_rgba(255,255,255,0.2)] transition-shadow"
                >
                    Przymierz na ścianie →
                </motion.button>
            </motion.div>
        );
    }

    // ─── REQUESTING ──────────────────────────────────────────────────────────
    if (arState === "requesting") {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-6 bg-black px-8 text-center">
                <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 18 }}
                    className="w-24 h-24 rounded-full bg-white/10 border border-white/20
                     flex items-center justify-center"
                >
                    <Camera className="w-10 h-10 text-white" />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-3"
                >
                    <h2 className="text-2xl font-bold text-white">Potrzebny dostęp do kamery</h2>
                    <p className="text-white/50 text-sm max-w-xs leading-relaxed">
                        Wallify potrzebuje dostępu do kamery, aby na żywo wyświetlić obraz
                        na Twojej ścianie. Obraz z kamery nie opuszcza Twojego urządzenia.
                    </p>
                </motion.div>

                <div className="flex items-center gap-2 text-white/40 text-sm">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Prośba o dostęp…
                </div>
            </div>
        );
    }

    // ─── DENIED / ERROR ───────────────────────────────────────────────────────
    if (arState === "denied" || arState === "error") {
        return (
            <motion.div
                className="flex flex-col items-center justify-center h-screen gap-6 bg-black px-8 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <Camera className="w-9 h-9 text-red-400" />
                </div>

                {arState === "denied" ? (
                    <div className="space-y-2">
                        <p className="text-white font-semibold">Brak dostępu do kamery</p>
                        <p className="text-white/50 text-sm max-w-xs">
                            Zezwól na dostęp do kamery w ustawieniach przeglądarki, a następnie
                            spróbuj ponownie.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-white font-semibold">Coś poszło nie tak</p>
                        <p className="text-white/50 text-sm max-w-xs">{error}</p>
                    </div>
                )}

                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Spróbuj ponownie
                </button>
            </motion.div>
        );
    }

    // ─── ACTIVE AR VIEW ───────────────────────────────────────────────────────
    return (
        <div ref={containerRef} className="relative w-full h-dvh overflow-hidden bg-black">
            {/* Obraz z kamery */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Nakładka z obrazem produktu */}
            <CanvasOverlay imageUrl={product.imageUrl} size={selectedSize} containerRef={containerRef} />

            {/* Dolne sterowanie */}
            <AnimatePresence>
                <motion.div
                    key="controls"
                    className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-16
                     bg-gradient-to-t from-black/85 via-black/40 to-transparent"
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 24 }}
                >
                    <SizePicker
                        sizes={SIZES}
                        selected={selectedSize}
                        onChange={setSelectedSize}
                    />

                    <div className="mt-4">
                        <AddToCartButton size={selectedSize} onAddToCart={onAddToCart} isLoading={isAddingToCart} />
                    </div>

                    <div className="mt-3 text-center">
                        <button
                            onClick={handleReset}
                            className="text-white/40 hover:text-white/70 text-xs transition-colors"
                        >
                            Zamknij podgląd AR
                        </button>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Nazwa produktu – górny lewy róg */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <span className="text-white/80 text-xs font-medium bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    {product.title}
                </span>
            </div>
        </div>
    );
}
