"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Point } from "@/lib/homography";
import type { LoadedPhoto } from "@/lib/photo";

export type StageView = {
    /** px ekranu na 1 px zdjęcia */
    scale: number;
    /** Punkt ekranu (clientX/Y) → punkt zdjęcia */
    toImage: (clientX: number, clientY: number) => Point;
    /** Odstęp zdjęcia od górnej krawędzi sceny (miejsce na lupę nad zdjęciem) */
    layerTop: number;
};

interface PhotoStageProps {
    photo: LoadedPhoto;
    /** Zdjęcie do pokazania zamiast oryginału (np. wersja AI) */
    displayUrl?: string;
    children?: (view: StageView) => ReactNode;
}

/**
 * Pokazuje zdjęcie dopasowane do dostępnego miejsca (jak object-fit: contain)
 * i daje nakładkom wspólny układ współrzędnych: piksele zdjęcia × scale.
 */
export default function PhotoStage({ photo, displayUrl, children }: PhotoStageProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const layerRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const scale = box.w && box.h ? Math.min(box.w / photo.width, box.h / photo.height) : 0;
    const width = photo.width * scale;
    const height = photo.height * scale;
    const layerTop = (box.h - height) / 2;

    const toImage = useCallback(
        (clientX: number, clientY: number): Point => {
            const rect = layerRef.current?.getBoundingClientRect();
            if (!rect || !scale) return { x: 0, y: 0 };
            return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
        },
        [scale]
    );

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-hidden touch-none select-none">
            {scale > 0 && (
                <div
                    ref={layerRef}
                    className="absolute"
                    style={{
                        width,
                        height,
                        left: (box.w - width) / 2,
                        top: layerTop,
                    }}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element -- lokalny blob: URL */}
                    <img
                        src={displayUrl ?? photo.url}
                        alt="Zdjęcie Twojej ściany"
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-contain"
                    />
                    {children?.({ scale, toImage, layerTop })}
                </div>
            )}
        </div>
    );
}
