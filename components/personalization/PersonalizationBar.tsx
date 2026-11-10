"use client";

import { useRef } from "react";
import { Crop, ImagePlus, Loader2 } from "lucide-react";
import type { QualityLevel } from "@/lib/product";
import type { CanvasSize, CustomerArtwork } from "@/types";
import QualityNote from "./QualityNote";

interface PersonalizationBarProps {
    artwork: CustomerArtwork | null;
    size: CanvasSize;
    quality: { dpi: number; level: QualityLevel; label: string } | null;
    loading: boolean;
    error: string | null;
    onChooseFile: (file: File | undefined) => void;
    onOpenCrop: () => void;
}

/** Pasek z miniaturą zdjęcia klienta, jakością druku oraz przyciskami „Kadr" i „Zmień". */
export default function PersonalizationBar({
    artwork,
    size,
    quality,
    loading,
    error,
    onChooseFile,
    onOpenCrop,
}: PersonalizationBarProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const input = (
        <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
                onChooseFile(e.target.files?.[0]);
                e.target.value = "";
            }}
        />
    );

    if (!artwork) {
        return (
            <div className="flex flex-col items-center gap-1.5">
                {input}
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 bg-white/10 border border-white/25 text-white text-sm font-semibold
                               px-4 py-2 rounded-full hover:bg-white/15 disabled:opacity-60"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    {loading ? "Wczytywanie…" : "Wybierz zdjęcie do druku"}
                </button>
                {error && <p className="text-xs text-red-300">{error}</p>}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 rounded-2xl bg-black/55 backdrop-blur-md border border-white/15 px-3 py-2 text-left">
            {input}
            {/* eslint-disable-next-line @next/next/no-img-element -- lokalny blob: URL */}
            <img
                src={artwork.previewUrl}
                alt="Twoje zdjęcie"
                className={`${size.round ? "rounded-full" : "rounded-[3px]"} object-cover shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.5)]`}
                style={{
                    // Miniatura w proporcjach wybranego rozmiaru, z tym samym kadrem co na płótnie
                    width: size.widthCm >= size.heightCm ? 44 : (44 * size.widthCm) / size.heightCm,
                    height: size.widthCm >= size.heightCm ? (44 * size.heightCm) / size.widthCm : 44,
                    objectPosition: `${artwork.focus.x * 100}% ${artwork.focus.y * 100}%`,
                }}
            />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">Twoje zdjęcie</p>
                {quality && <QualityNote quality={quality} />}
                {error && <p className="text-xs text-red-300">{error}</p>}
            </div>
            <div className="shrink-0 flex flex-col items-stretch gap-0.5">
                <button
                    type="button"
                    onClick={onOpenCrop}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-white/80 hover:text-white px-2 py-1 rounded-full hover:bg-white/10"
                >
                    <Crop className="w-3.5 h-3.5" /> Kadr
                </button>
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={loading}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-white/80 hover:text-white px-2 py-1 rounded-full hover:bg-white/10 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />} Zmień
                </button>
            </div>
        </div>
    );
}
