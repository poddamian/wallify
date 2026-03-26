"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getOverlayDimensions } from "@/lib/ar-utils";
import type { CanvasSize } from "@/types";
import type { RefObject } from "react";
import Image from "next/image";

interface CanvasOverlayProps {
    imageUrl: string;
    size: CanvasSize;
    /** Ref to the AR container div — used as drag boundary */
    containerRef: RefObject<HTMLDivElement | null>;
    scaleFactor?: number;
}

/**
 * CanvasOverlay
 *
 * Renders the product image over the camera feed.
 * - Draggable: user can reposition the image anywhere on screen
 * - Realistic multi-layer shadow: simulates canvas hanging on a wall
 *   with top-down ambient lighting
 */
export default function CanvasOverlay({
    imageUrl,
    size,
    containerRef,
    scaleFactor = 1,
}: CanvasOverlayProps) {
    const { widthPx: baseWidth, heightPx: baseHeight } = getOverlayDimensions(
        size.widthCm,
        size.heightCm,
        scaleFactor
    );

    const [globalScale, setGlobalScale] = useState<number>(1);

    useEffect(() => {
        const updateScale = () => {
            // Największy rozmiar w sklepie to 120cm szerokości (lub 120cm wysokości, liczymy max)
            // Przy CM_TO_PX_RATIO = 5.8, 120cm to około 696px.
            const MAX_CANVAS_PX = 120 * 5.8; 
            
            // Chcemy, aby te 120cm zajmowało maksymalnie 75% (3/4) szerokości telefonu
            const maxAllowedWidth = window.innerWidth * 0.75;
            
            if (MAX_CANVAS_PX > maxAllowedWidth) {
                // Obliczamy jeden stały współczynnik pomniejszenia dla całej aplikacji
                setGlobalScale(maxAllowedWidth / MAX_CANVAS_PX);
            } else {
                setGlobalScale(1);
            }
        };

        updateScale();
        window.addEventListener("resize", updateScale);
        return () => window.removeEventListener("resize", updateScale);
    }, []);

    // Stosujemy ten sam współczynnik globalScale do KAŻDEGO z rozmiarów.
    // Dzięki temu 30x20 wciąż będzie malutkie, a 120x80 zajmie max 3/4 ekranu.
    const finalWidth = Math.round(baseWidth * globalScale);
    const finalHeight = Math.round(baseHeight * globalScale);

    const dragRef = useRef<HTMLDivElement>(null);

    return (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none pb-[20vh]">
            <AnimatePresence mode="wait">
                <motion.div
                    ref={dragRef}
                    className="relative pointer-events-auto shadow-2xl"
                    style={{ cursor: "grab" }}
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1, width: finalWidth, height: finalHeight }}
                    exit={{ opacity: 0, scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 260, damping: 22 }}
                    // ─── Drag ─────────────────────────────────────────────
                    drag
                    dragConstraints={containerRef}
                    dragElastic={0.06}
                    dragMomentum={false}
                    whileDrag={{ cursor: "grabbing", scale: 1.02 }}
                >
                    {/* Canvas frame with realistic depth shadow */}
                    <div
                        className="w-full h-full relative overflow-hidden"
                        style={{
                            borderRadius: "2px",
                            boxShadow: [
                                "0 0 0 1.5px rgba(255,255,255,0.18)",   // biała krawędź
                                "3px 3px 0 0 rgba(0,0,0,0.55)",          // głębia blejtramu
                                "0 8px 20px rgba(0,0,0,0.5)",            // cień bliski
                                "0 24px 48px rgba(0,0,0,0.3)",           // cień otoczenia
                            ].join(", "),
                        }}
                    >
                        <Image
                            src={imageUrl}
                            alt="Canvas preview"
                            fill
                            className="object-cover"
                            style={{
                                filter: "contrast(1.05)",
                            }}
                            draggable={false}
                            priority
                        />
                    </div>

                    {/* Size badge */}
                    <motion.div
                        className="absolute -bottom-8 left-1/2 -translate-x-1/2
                         bg-white/90 text-black text-xs font-bold
                         px-3 py-1 rounded-full whitespace-nowrap shadow-lg"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                    >
                        {size.label}
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
