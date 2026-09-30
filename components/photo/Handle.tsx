"use client";

import { useRef, useState } from "react";
import type { Point } from "@/lib/homography";
import type { StageView } from "./PhotoStage";
import { usePointerDrag } from "./usePointerDrag";

const LOUPE = 112; // średnica lupy w px
const ZOOM = 2.5;

interface HandleProps {
    point: Point; // w pikselach zdjęcia
    view: StageView;
    photo: { url: string; width: number; height: number };
    onChange: (p: Point) => void;
    onEnd?: () => void;
    ariaLabel: string;
}

/**
 * Uchwyt do przeciągania punktu na zdjęciu. Podczas przeciągania pokazuje lupę,
 * bo palec zasłania dokładnie to miejsce, które klient chce trafić.
 */
export default function Handle({ point, view, photo, onChange, onEnd, ariaLabel }: HandleProps) {
    const [dragging, setDragging] = useState(false);
    const offset = useRef<Point>({ x: 0, y: 0 });

    const drag = usePointerDrag({
        toImage: view.toImage,
        onStart: (p) => {
            offset.current = { x: p.x - point.x, y: p.y - point.y };
            setDragging(true);
        },
        onMove: (p) => {
            onChange({
                x: Math.min(photo.width, Math.max(0, p.x - offset.current.x)),
                y: Math.min(photo.height, Math.max(0, p.y - offset.current.y)),
            });
        },
        onEnd: () => {
            setDragging(false);
            onEnd?.();
        },
    });

    const sx = point.x * view.scale;
    const sy = point.y * view.scale;
    // Lupa nad palcem (może wejść w czarny pas nad zdjęciem); przy samej górze sceny — pod nim
    const loupeAbove = view.layerTop + sy > LOUPE + 40;

    return (
        <>
            <div
                role="slider"
                aria-label={ariaLabel}
                aria-valuetext={`${Math.round(point.x)}, ${Math.round(point.y)}`}
                tabIndex={0}
                {...drag}
                className="absolute w-12 h-12 -ml-6 -mt-6 flex items-center justify-center cursor-grab active:cursor-grabbing z-20"
                style={{ left: sx, top: sy, touchAction: "none" }}
            >
                <span
                    className={`block rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]
                        transition-transform ${dragging ? "scale-75 bg-white/10" : "bg-white/25"}`}
                    style={{ width: 26, height: 26 }}
                />
                <span className="absolute w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]" />
            </div>

            {dragging && (
                <div
                    aria-hidden
                    className="absolute rounded-full border-2 border-white shadow-[0_6px_24px_rgba(0,0,0,0.6)] pointer-events-none z-30 overflow-hidden"
                    style={{
                        width: LOUPE,
                        height: LOUPE,
                        left: sx - LOUPE / 2,
                        top: loupeAbove ? sy - LOUPE - 36 : sy + 36,
                        backgroundImage: `url("${photo.url}")`,
                        backgroundRepeat: "no-repeat",
                        backgroundSize: `${photo.width * view.scale * ZOOM}px ${photo.height * view.scale * ZOOM}px`,
                        backgroundPosition: `${-(sx * ZOOM - LOUPE / 2)}px ${-(sy * ZOOM - LOUPE / 2)}px`,
                        backgroundColor: "#111",
                    }}
                >
                    <span className="absolute left-1/2 top-2 bottom-2 w-px -ml-px bg-white/80 mix-blend-difference" />
                    <span className="absolute top-1/2 left-2 right-2 h-px -mt-px bg-white/80 mix-blend-difference" />
                </div>
            )}
        </>
    );
}
