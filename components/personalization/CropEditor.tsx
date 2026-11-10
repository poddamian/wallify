"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { coverCrop, printQuality } from "@/lib/product";
import type { CanvasSize, CustomerArtwork } from "@/types";
import QualityNote from "./QualityNote";

interface CropEditorProps {
    artwork: CustomerArtwork;
    size: CanvasSize;
    onChange: (focus: { x: number; y: number }) => void;
    onClose: () => void;
}

/**
 * Wybór kadru: całe zdjęcie przygaszone, jasna ramka w proporcjach rozmiaru.
 * Klient przesuwa ramkę — to, co w niej, trafi na płótno.
 */
export default function CropEditor({ artwork, size, onChange, onClose }: CropEditorProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });
    const drag = useRef<{ id: number; x: number; y: number; sx: number; sy: number } | null>(null);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const W = artwork.width;
    const H = artwork.height;
    const scale = box.w && box.h ? Math.min(box.w / W, box.h / H) : 0;
    const offX = (box.w - W * scale) / 2;
    const offY = (box.h - H * scale) / 2;
    const crop = coverCrop(W, H, size.widthCm, size.heightCm, artwork.focus);
    const quality = printQuality(crop.sw, size.widthCm);

    const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: crop.sx, sy: crop.sy };
    };
    const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId || !scale) return;
        const clamp = (v: number) => Math.min(1, Math.max(0, v));
        const freeX = W - crop.sw;
        const freeY = H - crop.sh;
        onChange({
            x: freeX > 0.5 ? clamp((d.sx + (e.clientX - d.x) / scale) / freeX) : 0.5,
            y: freeY > 0.5 ? clamp((d.sy + (e.clientY - d.y) / scale) / freeY) : 0.5,
        });
    };
    const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
        if (drag.current?.id === e.pointerId) drag.current = null;
    };

    return (
        <motion.div
            className="absolute inset-0 z-50 flex flex-col bg-black text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <header className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-white/10">
                <div>
                    <p className="text-sm font-semibold">Kadr zdjęcia</p>
                    <p className="text-[11px] text-white/45">{size.label}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 bg-white text-black text-sm font-bold px-4 py-2 rounded-full"
                >
                    <Check className="w-4 h-4" /> Gotowe
                </button>
            </header>

            <div ref={containerRef} className="relative flex-1 min-h-0 m-4 overflow-hidden touch-none select-none">
                {scale > 0 && (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element -- lokalny blob: URL */}
                        <img
                            src={artwork.previewUrl}
                            alt="Twoje zdjęcie"
                            draggable={false}
                            className="absolute"
                            style={{ left: offX, top: offY, width: W * scale, height: H * scale }}
                        />
                        <div
                            role="slider"
                            aria-label="Ramka kadru — przeciągnij"
                            aria-valuetext={`${Math.round(artwork.focus.x * 100)}% × ${Math.round(artwork.focus.y * 100)}%`}
                            tabIndex={0}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerEnd}
                            onPointerCancel={onPointerEnd}
                            className="absolute border-2 border-white cursor-grab active:cursor-grabbing"
                            style={{
                                left: offX + crop.sx * scale,
                                top: offY + crop.sy * scale,
                                width: crop.sw * scale,
                                height: crop.sh * scale,
                                boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
                                borderRadius: size.round ? "50%" : undefined,
                                touchAction: "none",
                            }}
                        >
                            {/* Siatka trójpodziału */}
                            <span className="absolute inset-y-0 left-1/3 w-px bg-white/35" />
                            <span className="absolute inset-y-0 left-2/3 w-px bg-white/35" />
                            <span className="absolute inset-x-0 top-1/3 h-px bg-white/35" />
                            <span className="absolute inset-x-0 top-2/3 h-px bg-white/35" />
                        </div>
                    </>
                )}
            </div>

            <div className="shrink-0 px-6 pb-6 space-y-1 text-center">
                <p className="text-sm text-white/70">
                    {size.round
                        ? "Przesuń koło — to, co w nim, będzie z przodu obrazu. Brzeg zdjęcia wokół koła zawinie się na boki krosna."
                        : "Przesuń ramkę — to, co w niej, trafi na płótno."}
                </p>
                <QualityNote quality={quality} />
            </div>
        </motion.div>
    );
}
