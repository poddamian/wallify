"use client";

import type { QualityLevel } from "@/lib/product";

const COLORS: Record<QualityLevel, string> = {
    excellent: "text-emerald-300",
    good: "text-emerald-300",
    fair: "text-amber-300",
    low: "text-red-300",
};

/** Krótka informacja o jakości druku dla wybranego rozmiaru */
export default function QualityNote({
    quality,
}: {
    quality: { dpi: number; level: QualityLevel; label: string };
}) {
    return (
        <p className={`text-xs ${COLORS[quality.level]}`}>
            Jakość druku: {quality.label} <span className="text-white/35">({quality.dpi} DPI)</span>
        </p>
    );
}
