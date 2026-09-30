"use client";

import { useRef } from "react";
import {
    cssMatrix3d,
    isReasonableQuad,
    quadFor,
    rectCorners,
    solveHomography,
    translate,
    type Mat3,
    type Quad,
} from "@/lib/homography";
import { lightToCss, type LightFactors } from "@/lib/photo";
import type { CanvasSize } from "@/types";
import type { StageView } from "./PhotoStage";
import Handle from "./Handle";
import { usePointerDrag } from "./usePointerDrag";

/** Rozdzielczość elementu w px na 1 cm — sam element jest potem skalowany macierzą. */
const BOX_PX_PER_CM = 4;

interface PlacedArtworkProps {
    h: Mat3;
    onChange: (h: Mat3) => void;
    onInteractionEnd?: () => void;
    size: CanvasSize;
    imageUrl: string;
    light: LightFactors | null;
    view: StageView;
    photo: { url: string; width: number; height: number };
    /** Pokazuje 4 uchwyty narożników do dopasowania perspektywy */
    perspective: boolean;
    /** Położenie kadru grafiki (0–1) — dla zdjęcia klienta */
    focus?: { x: number; y: number };
}

/**
 * Obraz „powieszony" na zdjęciu ściany: prawdziwa grafika produktu, bez generowania,
 * w skali z kalibracji i (opcjonalnie) w perspektywie.
 */
export default function PlacedArtwork({
    h,
    onChange,
    onInteractionEnd,
    size,
    imageUrl,
    light,
    view,
    photo,
    perspective,
    focus,
}: PlacedArtworkProps) {
    const startH = useRef<Mat3>(h);
    const quad = quadFor(h, size.widthCm, size.heightCm);
    const s = view.scale;
    const displayQuad = quad.map((p) => ({ x: p.x * s, y: p.y * s })) as Quad;

    const boxW = size.widthCm * BOX_PX_PER_CM;
    const boxH = size.heightCm * BOX_PX_PER_CM;
    const transform = cssMatrix3d(boxW, boxH, displayQuad);

    const drag = usePointerDrag({
        toImage: view.toImage,
        onStart: () => {
            startH.current = h;
        },
        onMove: (p, start) => onChange(translate(startH.current, p.x - start.x, p.y - start.y)),
        onEnd: onInteractionEnd,
    });

    const moveCorner = (index: number, p: { x: number; y: number }) => {
        const next = [...quad] as Quad;
        next[index] = p;
        if (!isReasonableQuad(next, 12)) return;
        const solved = solveHomography(rectCorners(size.widthCm, size.heightCm), next);
        if (solved) onChange(solved);
    };

    const bottomMid = {
        x: (displayQuad[2].x + displayQuad[3].x) / 2,
        y: Math.max(displayQuad[2].y, displayQuad[3].y),
    };

    if (!transform) return null;

    return (
        <>
            <div
                {...drag}
                role="img"
                aria-label={`Obraz ${size.label} — przeciągnij, aby przesunąć`}
                className="absolute left-0 top-0 cursor-grab active:cursor-grabbing"
                style={{
                    width: boxW,
                    height: boxH,
                    transformOrigin: "0 0",
                    transform,
                    touchAction: "none",
                    isolation: "isolate",
                    willChange: "transform",
                    // Cień krosna: ok. 1,2 cm w dół, rozmycie ok. 3 cm (w jednostkach elementu)
                    boxShadow: `0 ${1.2 * BOX_PX_PER_CM}px ${3 * BOX_PX_PER_CM}px rgba(0,0,0,0.38),
                                0 ${0.3 * BOX_PX_PER_CM}px ${0.6 * BOX_PX_PER_CM}px rgba(0,0,0,0.3)`,
                }}
            >
                {/* eslint-disable-next-line @next/next/no-img-element -- element jest skalowany macierzą 3D */}
                <img
                    src={imageUrl}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    style={focus ? { objectPosition: `${focus.x * 100}% ${focus.y * 100}%` } : undefined}
                />
                {light && (
                    <div
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: lightToCss(light), mixBlendMode: "multiply" }}
                    />
                )}
            </div>

            <div
                className="absolute -translate-x-1/2 pointer-events-none z-10
                           bg-white/90 text-black text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-lg"
                style={{ left: bottomMid.x, top: bottomMid.y + 10 }}
            >
                {size.label}
            </div>

            {perspective &&
                quad.map((p, i) => (
                    <Handle
                        key={i}
                        ariaLabel={`Narożnik ${i + 1}`}
                        point={p}
                        view={view}
                        photo={photo}
                        onChange={(np) => moveCorner(i, np)}
                        onEnd={onInteractionEnd}
                    />
                ))}
        </>
    );
}
