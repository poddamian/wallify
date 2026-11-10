"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ImagePlus, RefreshCw } from "lucide-react";

import { useCamera } from "@/hooks/useCamera";
import { useVariantSelection } from "@/hooks/useVariantSelection";
import { useCustomerArtwork } from "@/hooks/useCustomerArtwork";
import { coverCrop, printQuality, recommendSizes, shortTitle } from "@/lib/product";
import CanvasOverlay from "./CanvasOverlay";
import VariantControls from "./VariantControls";
import AddToCartButton from "./AddToCartButton";
import PhotoViewer from "./photo/PhotoViewer";
import PersonalizationBar from "./personalization/PersonalizationBar";
import CropEditor from "./personalization/CropEditor";
import type { ARState, CanvasSize, Personalization, Product, ProductVariant, ViewerMode } from "@/types";

/** Docelowe pole obrazu przy automatycznym wyborze rozmiaru (ok. 70 × 50 cm) */
const DEFAULT_AREA_CM2 = 3500;

interface ARViewerProps {
    product: Product;
    /** Dostaje dokładnie ten wariant (rozmiar + opcje), który wybrał klient, i ewentualne zdjęcie klienta */
    onAddToCart?: (variant: ProductVariant, mode: ViewerMode, personalization?: Personalization) => void;
    /** Przekazywane do AddToCartButton — blokuje przycisk podczas wywołania API */
    isAddingToCart?: boolean;
    /** Postęp dodawania, np. „Wysyłanie zdjęcia… 40%" */
    cartStatus?: string | null;
    /** "photo" otwiera od razu tryb ze zdjęcia (np. z linku ?tryb=zdjecie) */
    initialMode?: ViewerMode;
    /** Czy serwer ma włączone ulepszenie AI */
    aiEnabled?: boolean;
}

export default function ARViewer({
    product,
    onAddToCart,
    isAddingToCart = false,
    cartStatus = null,
    initialMode = "live",
    aiEnabled = false,
}: ARViewerProps) {
    const [arState, setArState] = useState<ARState>(initialMode === "photo" ? "photo" : "idle");
    // Na komputerze (bez ekranu dotykowego) kamera tylnia nie istnieje — tam głównym przyciskiem jest zdjęcie
    const [prefersPhoto, setPrefersPhoto] = useState(false);
    const selection = useVariantSelection(product);
    const { attachVideo, status, error, startCamera, stopCamera } = useCamera();
    const containerRef = useRef<HTMLDivElement>(null);

    // ─── Zdjęcie klienta (produkty personalizowane) ─────────────────────────
    const custom = useCustomerArtwork();
    const artwork = product.personalized ? custom.artwork : null;
    const [cropOpen, setCropOpen] = useState(false);

    const qualityFor = (s: CanvasSize) =>
        artwork
            ? printQuality(coverCrop(artwork.width, artwork.height, s.widthCm, s.heightCm).sw, s.widthCm)
            : null;
    const quality = qualityFor(selection.size);

    const artworkAspect = artwork ? artwork.width / artwork.height : null;
    const recommended = useMemo(
        () => (artworkAspect ? recommendSizes(product.sizes, artworkAspect) : undefined),
        [artworkAspect, product.sizes]
    );
    const lowQualityIds = useMemo(() => {
        if (!artwork) return undefined;
        return new Set(
            product.sizes
                .filter((s) => printQuality(coverCrop(artwork.width, artwork.height, s.widthCm, s.heightCm).sw, s.widthCm).level === "low")
                .map((s) => s.id)
        );
    }, [artwork, product.sizes]);

    // Po wybraniu zdjęcia: rozmiar o pasujących proporcjach, dobrej jakości, najbliższy ok. 70 × 50 cm
    const artworkUrl = artwork?.previewUrl;
    useEffect(() => {
        if (!artworkUrl || !recommended?.length) return;
        const fits = recommended.some((s) => s.id === selection.size.id) && !lowQualityIds?.has(selection.size.id);
        if (fits) return;
        const good = recommended.filter((s) => !lowQualityIds?.has(s.id));
        const pool = good.length ? good : recommended;
        const best = pool.reduce((a, b) =>
            Math.abs(a.widthCm * a.heightCm - DEFAULT_AREA_CM2) <= Math.abs(b.widthCm * b.heightCm - DEFAULT_AREA_CM2) ? a : b
        );
        selection.setSizeId(best.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [artworkUrl]);

    const buildPersonalization = (): Personalization | undefined => {
        if (!artwork || !quality) return undefined;
        const { size } = selection;
        const c = coverCrop(artwork.width, artwork.height, size.widthCm, size.heightCm, artwork.focus);
        return {
            file: artwork.file,
            crop: { x: Math.round(c.sx), y: Math.round(c.sy), width: Math.round(c.sw), height: Math.round(c.sh) },
            original: { width: artwork.width, height: artwork.height },
            dpi: quality.dpi,
            qualityLabel: quality.label,
            ...(size.round ? { round: true } : {}),
        };
    };

    const handleAdd = (variant: ProductVariant, mode: ViewerMode) =>
        onAddToCart?.(variant, mode, buildPersonalization());

    const blockedReason = product.personalized && !artwork ? "Najpierw wybierz zdjęcie" : undefined;

    const personalizationBar = product.personalized ? (
        <PersonalizationBar
            artwork={artwork}
            size={selection.size}
            quality={quality}
            loading={custom.loading}
            error={custom.error}
            onChooseFile={custom.choose}
            onOpenCrop={() => setCropOpen(true)}
        />
    ) : null;

    const cropOverlay =
        cropOpen && artwork ? (
            <CropEditor
                artwork={artwork}
                size={selection.size}
                onChange={custom.setFocus}
                onClose={() => setCropOpen(false)}
            />
        ) : null;

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

    const openPhotoMode = () => {
        stopCamera();
        setArState("photo");
    };

    useEffect(() => {
        setPrefersPhoto(!window.matchMedia("(pointer: coarse)").matches);
    }, []);

    // ─── ZE ZDJĘCIA ──────────────────────────────────────────────────────────
    if (arState === "photo") {
        return (
            <div className="relative w-full h-dvh">
                <PhotoViewer
                    product={product}
                    selection={selection}
                    onAddToCart={handleAdd}
                    isAddingToCart={isAddingToCart}
                    onExit={() => setArState("idle")}
                    aiEnabled={aiEnabled}
                    artworkUrl={artwork?.previewUrl}
                    artworkFocus={artwork?.focus}
                    extraPanel={personalizationBar}
                    recommended={recommended}
                    lowQualityIds={lowQualityIds}
                    cartStatus={cartStatus}
                    blockedReason={blockedReason}
                />
                {cropOverlay}
            </div>
        );
    }

    // ─── IDLE ────────────────────────────────────────────────────────────────
    if (arState === "idle" && product.personalized && !artwork) {
        return (
            <motion.div
                className="flex flex-col items-center gap-8 p-8 text-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <ImagePlus className="w-9 h-9 text-white/80" />
                </div>
                <div className="space-y-3">
                    <h2 className="text-2xl font-bold text-white leading-tight">
                        Zobacz swoje zdjęcie<br />na ścianie
                    </h2>
                    <p className="text-white/50 text-sm max-w-xs leading-relaxed">
                        Wybierz zdjęcie do druku, a pokażemy je na Twojej ścianie w wybranym rozmiarze.
                        Bez wysyłania maili — zdjęcie dołączymy do zamówienia.
                    </p>
                </div>
                <label
                    className={`inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full text-base font-bold
                        shadow-[0_4px_24px_rgba(255,255,255,0.2)] cursor-pointer ${custom.loading ? "opacity-70" : ""}`}
                >
                    <ImagePlus className="w-5 h-5" />
                    {custom.loading ? "Wczytywanie…" : "Wybierz zdjęcie do druku"}
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={custom.loading}
                        onChange={(e) => {
                            void custom.choose(e.target.files?.[0]);
                            e.target.value = "";
                        }}
                    />
                </label>
                {custom.error && <p className="text-red-300 text-sm max-w-xs">{custom.error}</p>}
            </motion.div>
        );
    }

    if (arState === "idle") {
        return (
            <motion.div
                className="relative min-h-dvh flex flex-col items-center gap-8 p-8 text-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {artwork ? (
                    <div className="w-full max-w-sm">{personalizationBar}</div>
                ) : (
                    <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <Camera className="w-9 h-9 text-white/80" />
                    </div>
                )}

                <div className="space-y-3">
                    <h2 className="text-2xl font-bold text-white leading-tight">
                        Sprawdź, jak to będzie<br />wyglądać na Twojej ścianie
                    </h2>
                    <p className="text-white/50 text-sm max-w-xs leading-relaxed">
                        Skieruj kamerę na ścianę i od razu sprawdź, jak&nbsp;
                        <span className="text-white font-medium">{artwork ? "Twoje zdjęcie" : shortTitle(product.title)}</span> będzie
                        prezentować się w Twoim wnętrzu.
                    </p>
                </div>

                <div className={`flex flex-col items-center gap-3 ${prefersPhoto ? "flex-col-reverse" : ""}`}>
                    <motion.button
                        onClick={handleStart}
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.03 }}
                        className={`inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-bold transition-shadow
                            ${prefersPhoto
                                ? "border border-white/25 text-white hover:border-white/50"
                                : "bg-white text-black shadow-[0_4px_24px_rgba(255,255,255,0.2)]"}`}
                    >
                        <Camera className="w-5 h-5" />
                        Przymierz na ścianie →
                    </motion.button>
                    <motion.button
                        onClick={openPhotoMode}
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.03 }}
                        className={`inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-bold transition-shadow
                            ${prefersPhoto
                                ? "bg-white text-black shadow-[0_4px_24px_rgba(255,255,255,0.2)]"
                                : "border border-white/25 text-white hover:border-white/50"}`}
                    >
                        <ImagePlus className="w-5 h-5" />
                        Użyj zdjęcia ściany
                    </motion.button>
                    <p className="text-white/40 text-xs">
                        {prefersPhoto
                            ? "Na komputerze najwygodniej ze zdjęcia pokoju."
                            : "Nie stoisz przed ścianą? Wgraj jej zdjęcie."}
                    </p>
                </div>
                {cropOverlay}
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
                    onClick={openPhotoMode}
                    className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full text-sm font-bold"
                >
                    <ImagePlus className="w-4 h-4" />
                    Użyj zdjęcia ściany
                </button>

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
                ref={attachVideo}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Nakładka z obrazem produktu */}
            <CanvasOverlay
                imageUrl={artwork?.previewUrl ?? product.imageUrl}
                focus={artwork?.focus}
                size={selection.size}
                containerRef={containerRef}
            />

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
                    {personalizationBar && <div className="mb-3">{personalizationBar}</div>}
                    <VariantControls
                        product={product}
                        selection={selection}
                        recommended={recommended}
                        lowQualityIds={lowQualityIds}
                    />

                    <div className="mt-4">
                        <AddToCartButton
                            selection={selection}
                            isLoading={isAddingToCart}
                            statusText={cartStatus}
                            blockedReason={blockedReason}
                            onAddToCart={() => selection.variant && handleAdd(selection.variant, "live")}
                        />
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
                <span className="max-w-full truncate text-white/80 text-xs font-medium bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    {shortTitle(product.title)}
                </span>
            </div>

            {cropOverlay}
        </div>
    );
}
