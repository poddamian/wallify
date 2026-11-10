"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight,
    ImagePlus,
    Images,
    Loader2,
    Move3d,
    RotateCcw,
    Ruler,
    Share2,
    Sparkles,
    Sun,
    X,
} from "lucide-react";

import { applyH, localPxPerCm, quadFor, similarity, type Mat3, type Point } from "@/lib/homography";
import {
    NEUTRAL_LIGHT,
    canvasToJpeg,
    composeImage,
    estimateLight,
    loadArtwork,
    loadPhoto,
    shareOrDownload,
    shopifySized,
    type LoadedPhoto,
} from "@/lib/photo";
import { shortTitle } from "@/lib/product";
import type { VariantSelection } from "@/hooks/useVariantSelection";
import type { CanvasSize, Product, ProductVariant, ViewerMode } from "@/types";

import PhotoStage from "./PhotoStage";
import CalibrationRuler from "./CalibrationRuler";
import PlacedArtwork from "./PlacedArtwork";
import VariantControls from "../VariantControls";
import AddToCartButton from "../AddToCartButton";

type Step = "pick" | "calibrate" | "place";

/** Gotowe wymiary do kalibracji — przedmioty, które prawie każdy ma na ścianie */
const PRESETS = [
    { label: "Drzwi", cm: 80 },
    { label: "Kartka A4", cm: 29.7 },
];

/** Gdy klient pominie kalibrację: zakładamy, że zdjęcie obejmuje ok. 3,5 m ściany */
const ASSUMED_WALL_WIDTH_CM = 350;

interface PhotoViewerProps {
    product: Product;
    selection: VariantSelection;
    onAddToCart?: (variant: ProductVariant, mode: ViewerMode) => void;
    isAddingToCart?: boolean;
    onExit: () => void;
    /** Czy serwer ma skonfigurowane ulepszenie AI (GEMINI_API_KEY) */
    aiEnabled?: boolean;
    /** Grafika zamiast zdjęcia produktu — np. zdjęcie klienta (blob: URL) */
    artworkUrl?: string;
    /** Położenie kadru grafiki (0–1) */
    artworkFocus?: { x: number; y: number };
    /** Dodatkowy pasek nad wyborem rozmiaru (np. zdjęcie klienta i jakość druku) */
    extraPanel?: ReactNode;
    recommended?: CanvasSize[];
    lowQualityIds?: Set<string>;
    cartStatus?: string | null;
    blockedReason?: string;
}

function parseCm(value: string): number | null {
    const n = Number(value.replace(",", ".").trim());
    return Number.isFinite(n) && n >= 3 && n <= 2000 ? n : null;
}

const fmtCm = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export default function PhotoViewer({
    product,
    selection,
    onAddToCart,
    isAddingToCart = false,
    onExit,
    aiEnabled = false,
    artworkUrl,
    artworkFocus,
    extraPanel,
    recommended,
    lowQualityIds,
    cartStatus,
    blockedReason,
}: PhotoViewerProps) {
    const { size } = selection;
    const imageUrl = artworkUrl ?? product.imageUrl;
    const [step, setStep] = useState<Step>("pick");
    const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
    const [loadingPhoto, setLoadingPhoto] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [ruler, setRuler] = useState<{ a: Point; b: Point } | null>(null);
    const [lengthInput, setLengthInput] = useState("");
    const [approximate, setApproximate] = useState(false);

    const [h, setH] = useState<Mat3 | null>(null);
    const hRef = useRef<Mat3 | null>(null);
    hRef.current = h;
    const [settledH, setSettledH] = useState<Mat3 | null>(null);
    const [perspective, setPerspective] = useState(false);
    const [lightOn, setLightOn] = useState(true);
    const [hintVisible, setHintVisible] = useState(true);

    const [busy, setBusy] = useState<null | "save" | "ai">(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [ai, setAi] = useState<{ url: string; key: string } | null>(null);
    const [showAi, setShowAi] = useState(false);
    // Zdjęcie wysyłamy do AI dopiero po wyraźnej zgodzie klienta
    const [aiConsent, setAiConsent] = useState(false);
    const [aiConsentOpen, setAiConsentOpen] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const artworkRef = useRef<{ url: string; image: Promise<HTMLImageElement> } | null>(null);
    const composedRef = useRef<{ key: string; blob: Promise<Blob> } | null>(null);

    const caption = `${shortTitle(product.title)} · ${size.label}`;
    const lengthCm = parseCm(lengthInput);
    // Zbyt krótka miarka = bardzo niedokładna skala
    const rulerTooShort = ruler ? Math.hypot(ruler.b.x - ruler.a.x, ruler.b.y - ruler.a.y) < 20 : true;
    const canConfirm = Boolean(lengthCm) && !rulerTooShort;

    // Zwalniamy pamięć po poprzednim zdjęciu / wyniku AI
    useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
    useEffect(() => () => { if (ai) URL.revokeObjectURL(ai.url); }, [ai]);

    // Światło liczymy po zakończeniu przesuwania (nie przy każdym ruchu palca)
    const light = useMemo(() => {
        if (!lightOn || !photo || !settledH) return null;
        return estimateLight(photo, quadFor(settledH, size.widthCm, size.heightCm));
    }, [lightOn, photo, settledH, size.widthCm, size.heightCm]);

    const sceneKey = JSON.stringify([h, size.id, light, photo?.url, imageUrl, artworkFocus]);
    const aiValid = Boolean(ai && ai.key === sceneKey);
    const showingAi = showAi && aiValid;

    // ─── Zdjęcie ─────────────────────────────────────────────────────────────
    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        setError(null);
        setLoadingPhoto(true);
        try {
            const p = await loadPhoto(file);
            setPhoto(p);
            const y = p.height * 0.5;
            setRuler({ a: { x: p.width * 0.35, y }, b: { x: p.width * 0.65, y } });
            setH(null);
            setSettledH(null);
            setPerspective(false);
            setAi(null);
            setShowAi(false);
            setNotice(null);
            setStep("calibrate");
        } catch {
            setError("Nie udało się otworzyć zdjęcia. Spróbuj innego pliku (JPG lub PNG).");
        } finally {
            setLoadingPhoto(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const openFilePicker = () => fileInputRef.current?.click();

    // ─── Kalibracja ──────────────────────────────────────────────────────────
    const confirmScale = (skip: boolean) => {
        if (!photo || !ruler) return;
        const { a, b } = ruler;
        const rulerPx = Math.hypot(b.x - a.x, b.y - a.y);
        const pxPerCm = skip || !lengthCm ? photo.width / ASSUMED_WALL_WIDTH_CM : rulerPx / lengthCm;

        // Przy ponownej kalibracji obraz zostaje tam, gdzie był. Za pierwszym razem: środek kadru,
        // na wysokości miarki, ale nie niżej niż ok. 40% zdjęcia (typowo nad sofą lub komodą)
        const center = h
            ? applyH(h, { x: 0, y: 0 })
            : {
                x: photo.width / 2,
                y: skip
                    ? photo.height * 0.38
                    : Math.min(photo.height * 0.42, Math.max(photo.height * 0.2, (a.y + b.y) / 2)),
            };

        const next = similarity(pxPerCm, center.x, center.y);
        setH(next);
        setSettledH(next);
        setApproximate(skip || !lengthCm);
        setPerspective(false);
        setStep("place");
    };

    // ─── Składanie obrazu (zapis / AI) ───────────────────────────────────────
    const getArtwork = () => {
        if (artworkRef.current?.url !== imageUrl) {
            const image = loadArtwork(imageUrl).catch((err) => {
                artworkRef.current = null;
                throw err;
            });
            artworkRef.current = { url: imageUrl, image };
        }
        return artworkRef.current.image;
    };

    const compose = useCallback(
        async (withCaption: boolean) => {
            const current = hRef.current;
            if (!photo || !current) throw new Error("Brak zdjęcia");
            return composeImage({
                photo,
                artwork: await getArtwork(),
                h: current,
                widthCm: size.widthCm,
                heightCm: size.heightCm,
                round: size.round,
                light: light ?? NEUTRAL_LIGHT,
                focus: artworkFocus,
                caption: withCaption ? caption : undefined,
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [photo, size.widthCm, size.heightCm, size.round, light, caption, imageUrl, artworkFocus]
    );

    /** Gotowy JPG do zapisu — przygotowany zawczasu, żeby menu „Udostępnij" otworzyło się od razu */
    const getComposedBlob = useCallback(() => {
        if (composedRef.current?.key !== sceneKey) {
            const blob = compose(true).then((c) => canvasToJpeg(c, 0.9));
            blob.catch(() => {
                if (composedRef.current?.key === sceneKey) composedRef.current = null;
            });
            composedRef.current = { key: sceneKey, blob };
        }
        return composedRef.current.blob;
    }, [compose, sceneKey]);

    useEffect(() => {
        if (step !== "place" || !settledH) return;
        const t = setTimeout(() => void getComposedBlob().catch(() => undefined), 900);
        return () => clearTimeout(t);
    }, [step, settledH, getComposedBlob]);

    const handleSave = async () => {
        setBusy("save");
        setNotice(null);
        try {
            const blob = showingAi && ai ? await (await fetch(ai.url)).blob() : await getComposedBlob();
            const ext = blob.type === "image/png" ? "png" : "jpg";
            const fileName = `${product.id.split("/").pop() ?? "obraz"}-${size.id}${showingAi ? "-ai" : ""}.${ext}`;
            const result = await shareOrDownload(blob, fileName, caption);
            if (result === "downloaded") setNotice("Zdjęcie zapisane w pobranych plikach.");
        } catch (err) {
            console.error("[Wallify] Zapis zdjęcia:", err);
            setNotice("Nie udało się zapisać zdjęcia. Spróbuj ponownie.");
        } finally {
            setBusy(null);
        }
    };

    const handleAi = async (consented = aiConsent) => {
        if (aiValid) {
            setShowAi((v) => !v);
            return;
        }
        if (!consented) {
            setAiConsentOpen(true);
            return;
        }
        setAiConsentOpen(false);
        setBusy("ai");
        setNotice(null);
        const key = sceneKey;
        try {
            const canvas = await compose(false);
            const res = await fetch("/api/enhance", {
                method: "POST",
                headers: { "Content-Type": "image/jpeg" },
                body: await canvasToJpeg(canvas, 0.88),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
            const out = await res.blob();
            setAi({ url: URL.createObjectURL(out), key });
            setShowAi(true);
        } catch (err) {
            console.error("[Wallify] Ulepszenie AI:", err);
            setNotice("Ulepszenie AI jest chwilowo niedostępne. Podgląd bez AI działa normalnie.");
        } finally {
            setBusy(null);
        }
    };

    const updateH = (next: Mat3) => {
        setH(next);
        setHintVisible(false);
    };

    /** Usuwa perspektywę: ta sama skala i środek, prostokąt bez przechyłu */
    const straighten = () => {
        if (!h) return;
        const c = applyH(h, { x: 0, y: 0 });
        const next = similarity(localPxPerCm(h), c.x, c.y);
        setH(next);
        setSettledH(next);
    };

    // ─── Widok ───────────────────────────────────────────────────────────────
    const stepTitle = { pick: "Zdjęcie ściany", calibrate: "Ustaw skalę", place: "Dopasuj obraz" }[step];
    const stepNo = { pick: 1, calibrate: 2, place: 3 }[step];

    return (
        <div className="relative w-full h-dvh flex flex-col bg-black text-white overflow-hidden">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {/* ── Górny pasek ── */}
            <header className="shrink-0 flex items-center gap-3 px-4 h-12 border-b border-white/10">
                <button
                    type="button"
                    onClick={onExit}
                    aria-label="Zamknij podgląd ze zdjęcia"
                    className="w-9 h-9 -ml-2 flex items-center justify-center rounded-full hover:bg-white/10"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{stepTitle}</p>
                    <p className="text-[11px] text-white/45 truncate">
                        Krok {stepNo} z 3 · {shortTitle(product.title)}
                    </p>
                </div>
                {step === "place" && approximate && (
                    <button
                        type="button"
                        onClick={() => setStep("calibrate")}
                        className="shrink-0 text-[11px] font-semibold bg-amber-400/15 text-amber-200 border border-amber-300/30 px-2.5 py-1 rounded-full"
                    >
                        Skala orientacyjna
                    </button>
                )}
            </header>

            {/* ── Krok 1: wybór zdjęcia ── */}
            {step === "pick" && (
                <motion.div
                    className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <ImagePlus className="w-9 h-9 text-white/80" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold leading-tight">
                            Zobacz obraz na zdjęciu<br />swojej ściany
                        </h2>
                        <p className="text-white/50 text-sm max-w-xs mx-auto leading-relaxed">
                            Działa też z dala od domu — wystarczy zdjęcie zrobione wcześniej.
                        </p>
                    </div>

                    <ul className="text-left text-sm text-white/65 space-y-2 max-w-xs">
                        <li>• Stań na wprost ściany, 2–3 m od niej.</li>
                        <li>• Niech w kadrze będą drzwi, kartka A4 albo inny przedmiot o znanym wymiarze.</li>
                        <li>
                            • Zdjęcie zostaje w Twoim urządzeniu
                            {aiEnabled ? " — wysyłamy je tylko, jeśli sam wybierzesz ulepszenie AI." : " — nigdzie go nie wysyłamy."}
                        </li>
                    </ul>

                    <motion.button
                        type="button"
                        onClick={openFilePicker}
                        disabled={loadingPhoto}
                        whileTap={{ scale: 0.95 }}
                        className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-bold
                                   shadow-[0_4px_24px_rgba(255,255,255,0.2)] disabled:opacity-70"
                    >
                        {loadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Images className="w-5 h-5" />}
                        {loadingPhoto ? "Wczytywanie…" : "Wybierz lub zrób zdjęcie"}
                    </motion.button>

                    {error && <p className="text-red-300 text-sm max-w-xs">{error}</p>}
                </motion.div>
            )}

            {/* ── Krok 2 i 3: zdjęcie z nakładkami ── */}
            {step !== "pick" && photo && (
                <div className="relative flex-1 min-h-0 bg-neutral-950">
                    <PhotoStage photo={photo} displayUrl={showingAi ? ai?.url : undefined}>
                        {(view) => (
                            <>
                                {step === "calibrate" && ruler && (
                                    <CalibrationRuler
                                        a={ruler.a}
                                        b={ruler.b}
                                        onChange={(a, b) => setRuler({ a, b })}
                                        view={view}
                                        photo={photo}
                                        label={rulerTooShort ? "Rozsuń końce miarki" : lengthCm ? `${fmtCm(lengthCm)} cm` : "? cm"}
                                    />
                                )}
                                {step === "place" && h && !showingAi && (
                                    <PlacedArtwork
                                        h={h}
                                        onChange={updateH}
                                        onInteractionEnd={() => setSettledH(hRef.current)}
                                        size={size}
                                        imageUrl={artworkUrl ?? shopifySized(product.imageUrl, 1600)}
                                        focus={artworkFocus}
                                        light={light}
                                        view={view}
                                        photo={photo}
                                        perspective={perspective}
                                    />
                                )}
                            </>
                        )}
                    </PhotoStage>

                    <AnimatePresence>
                        {step === "place" && hintVisible && !showingAi && (
                            <motion.div
                                key="hint"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none
                                           bg-black/60 backdrop-blur-sm text-xs text-white/85 px-3 py-1.5 rounded-full whitespace-nowrap"
                            >
                                Przeciągnij obraz, żeby go przesunąć
                            </motion.div>
                        )}
                        {showingAi && (
                            <motion.div
                                key="ai-badge"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none
                                           bg-black/60 backdrop-blur-sm text-xs text-white/85 px-3 py-1.5 rounded-full whitespace-nowrap"
                            >
                                Wersja AI (poglądowa)
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* ── Panel kalibracji ── */}
            {step === "calibrate" && (
                <div className="shrink-0 border-t border-white/10">
                    <div className="px-6 pt-4 pb-6 space-y-3 w-full max-w-xl mx-auto">
                        <p className="text-sm text-white/70 leading-snug">
                            Przeciągnij końce miarki do krawędzi czegoś na ścianie, czego wymiar znasz, i wpisz go.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.label}
                                    type="button"
                                    onClick={() => setLengthInput(fmtCm(p.cm))}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
                                        ${lengthCm === p.cm
                                            ? "bg-white text-black border-white"
                                            : "bg-white/10 border-white/20 text-white hover:bg-white/20"}`}
                                >
                                    {p.label} · {fmtCm(p.cm)} cm
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex-1 flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 h-12 focus-within:border-white/60">
                                <Ruler className="w-4 h-4 text-white/50 shrink-0" />
                                <input
                                    inputMode="decimal"
                                    placeholder="Długość"
                                    aria-label="Długość miarki w centymetrach"
                                    value={lengthInput}
                                    onChange={(e) => setLengthInput(e.target.value.replace(/[^\d.,]/g, ""))}
                                    onKeyDown={(e) => e.key === "Enter" && canConfirm && confirmScale(false)}
                                    className="w-full bg-transparent outline-none text-base font-semibold placeholder:text-white/35 placeholder:font-normal"
                                />
                                <span className="text-white/50 text-sm">cm</span>
                            </label>
                            <motion.button
                                type="button"
                                whileTap={{ scale: 0.95 }}
                                disabled={!canConfirm}
                                onClick={() => confirmScale(false)}
                                className="h-12 px-5 rounded-full bg-white text-black font-bold inline-flex items-center gap-1.5 disabled:opacity-40"
                            >
                                Dalej <ArrowRight className="w-4 h-4" />
                            </motion.button>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <button type="button" onClick={() => confirmScale(true)} className="text-white/50 hover:text-white underline underline-offset-2">
                                Nie znam wymiaru — pokaż orientacyjnie
                            </button>
                            <button type="button" onClick={openFilePicker} className="text-white/50 hover:text-white">
                                Inne zdjęcie
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Panel dopasowania ── */}
            {step === "place" && (
                <div className="shrink-0 border-t border-white/10">
                    <div className="px-6 pt-3 pb-5 w-full max-w-xl mx-auto">
                        {extraPanel && <div className="mb-3">{extraPanel}</div>}
                        <VariantControls
                            product={product}
                            selection={selection}
                            recommended={recommended}
                            lowQualityIds={lowQualityIds}
                        />

                        <div className="flex flex-wrap justify-center gap-2 mt-3">
                            <ToggleChip
                                active={perspective}
                                onClick={() => {
                                    setPerspective((v) => !v);
                                    setShowAi(false);
                                }}
                                icon={<Move3d className="w-3.5 h-3.5" />}
                                label="Perspektywa"
                            />
                            {perspective && (
                                <ToggleChip
                                    active={false}
                                    onClick={straighten}
                                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                                    label="Wyprostuj"
                                />
                            )}
                            <ToggleChip
                                active={lightOn}
                                onClick={() => setLightOn((v) => !v)}
                                icon={<Sun className="w-3.5 h-3.5" />}
                                label="Światło"
                            />
                            {aiEnabled && (
                                <ToggleChip
                                    active={showingAi}
                                    disabled={busy === "ai"}
                                    onClick={() => handleAi()}
                                    icon={busy === "ai"
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <Sparkles className="w-3.5 h-3.5" />}
                                    label={busy === "ai" ? "AI pracuje…" : aiValid ? "Wersja AI" : "Ulepsz AI"}
                                />
                            )}
                        </div>

                        <div className="mt-3">
                            <AddToCartButton
                                selection={selection}
                                isLoading={isAddingToCart}
                                statusText={cartStatus}
                                blockedReason={blockedReason}
                                onAddToCart={() => selection.variant && onAddToCart?.(selection.variant, "photo")}
                            />
                        </div>

                        <div className="mt-3 flex items-center justify-center gap-5 text-xs text-white/55">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={busy === "save"}
                                className="inline-flex items-center gap-1.5 hover:text-white disabled:opacity-50"
                            >
                                {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                                Zapisz / wyślij
                            </button>
                            <button type="button" onClick={() => setStep("calibrate")} className="inline-flex items-center gap-1.5 hover:text-white">
                                <Ruler className="w-3.5 h-3.5" /> Zmień skalę
                            </button>
                            <button type="button" onClick={openFilePicker} className="inline-flex items-center gap-1.5 hover:text-white">
                                <ImagePlus className="w-3.5 h-3.5" /> Inne zdjęcie
                            </button>
                        </div>

                        {aiConsentOpen && (
                            <div className="mt-3 rounded-2xl border border-white/15 bg-white/5 p-3 text-xs text-white/75 space-y-2">
                                <p>
                                    Ulepszenie AI wyśle ten podgląd (zdjęcie ściany z obrazem) do Google Gemini,
                                    żeby dopasować światło i cień. Nie zapisujemy go u siebie.
                                </p>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAiConsentOpen(false)}
                                        className="px-3 py-1.5 rounded-full text-white/70 hover:text-white"
                                    >
                                        Anuluj
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAiConsent(true);
                                            void handleAi(true);
                                        }}
                                        className="px-3 py-1.5 rounded-full bg-white text-black font-semibold"
                                    >
                                        Wyślij do AI
                                    </button>
                                </div>
                            </div>
                        )}

                        {notice && <p className="mt-2 text-center text-xs text-white/60">{notice}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

function ToggleChip({
    active,
    onClick,
    icon,
    label,
    disabled,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap
                disabled:opacity-60
                ${active
                    ? "bg-white/90 text-black border-white"
                    : "bg-transparent text-white/75 border-white/25 hover:border-white/50"}`}
        >
            {icon}
            {label}
        </button>
    );
}
