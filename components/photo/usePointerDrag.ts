"use client";

import { useRef, type PointerEvent } from "react";
import type { Point } from "@/lib/homography";

type DragHandlers = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
};

interface DragOptions {
    toImage: (clientX: number, clientY: number) => Point;
    onStart?: (p: Point) => void;
    /** `p` — bieżący punkt, `start` — punkt początkowy (oba w pikselach zdjęcia) */
    onMove: (p: Point, start: Point) => void;
    onEnd?: () => void;
}

/**
 * Przeciąganie myszą i palcem (Pointer Events + pointer capture).
 * Zwraca handlery do rozłożenia na elemencie: {...drag}.
 */
export function usePointerDrag({ toImage, onStart, onMove, onEnd }: DragOptions): DragHandlers {
    const active = useRef<{ id: number; start: Point } | null>(null);

    const finish = (e: PointerEvent<HTMLElement>) => {
        if (active.current?.id !== e.pointerId) return;
        active.current = null;
        onEnd?.();
    };

    return {
        onPointerDown: (e) => {
            if (active.current) return; // drugi palec ignorujemy
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = toImage(e.clientX, e.clientY);
            active.current = { id: e.pointerId, start: p };
            onStart?.(p);
        },
        onPointerMove: (e) => {
            if (active.current?.id !== e.pointerId) return;
            e.preventDefault();
            onMove(toImage(e.clientX, e.clientY), active.current.start);
        },
        onPointerUp: finish,
        onPointerCancel: finish,
    };
}
