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

    const [maxWidth, setMaxWidth] = useState<number>(1000);

    useEffect(() => {
        setMaxWidth(window.innerWidth * 0.85); // Na start 85% szerokości ekranu
        const handleResize = () => setMaxWidth(window.innerWidth * 0.85);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    let adjustedScale = 1;
    if (baseWidth > maxWidth) {
        adjustedScale = maxWidth / baseWidth;
    }

    const finalWidth = Math.round(baseWidth * adjustedScale);
    const finalHeight = Math.round(baseHeight * adjustedScale);

    const dragRef = useRef<HTMLDivElement>(null);

    return (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none pb-[20vh]">
            <AnimatePresence mode="wait">
                <motion.div
                    // Removed key={size.id} so the element doesn't unmount on size change,
                    // preserving its drag x/y position on the wall!
                    ref={dragRef}
                    className="relative pointer-events-auto"
                    style={{
                        cursor: "grab",
                        // Kontekst nakładania mieszania musi być na samym szczycie drzewa dom (na elemencie z drag),
                        // inaczej iOS safari zaizoluje tło!
                        mixBlendMode: "multiply"
                    }}
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
