"use client";

import { ChevronDown } from "lucide-react";
import ChipPicker from "./ChipPicker";
import { ORIENTATION_LABEL, orientationOf, type Orientation } from "@/lib/product";
import type { VariantSelection } from "@/hooks/useVariantSelection";
import type { CanvasSize, Product } from "@/types";

/** Powyżej tylu rozmiarów kapsułki pokazują tylko wybór, a resztę daje lista rozwijana */
const MAX_CHIPS = 12;

interface VariantControlsProps {
    product: Product;
    selection: VariantSelection;
    /** Rozmiary polecane (np. pasujące proporcjami do zdjęcia klienta), od najmniejszego */
    recommended?: CanvasSize[];
    /** Rozmiary, dla których jakość druku jest za niska */
    lowQualityIds?: Set<string>;
}

/** Kilka rozmiarów o polu najbliższym wybranemu, w tej samej orientacji */
function nearestSizes(sizes: CanvasSize[], current: CanvasSize, count: number): CanvasSize[] {
    const o = orientationOf(current.widthCm, current.heightCm);
    const area = current.widthCm * current.heightCm;
    return sizes
        .filter((s) => orientationOf(s.widthCm, s.heightCm) === o)
        .sort((a, b) => Math.abs(a.widthCm * a.heightCm - area) - Math.abs(b.widthCm * b.heightCm - area))
        .slice(0, count)
        .sort((a, b) => a.widthCm * a.heightCm - b.widthCm * b.heightCm);
}

/** Wybór rozmiaru i pozostałych opcji (np. materiału) — wspólny dla obu trybów podglądu. */
export default function VariantControls({ product, selection, recommended, lowQualityIds }: VariantControlsProps) {
    const { size, setSizeId, selectedOptions, setOption, isAvailable } = selection;
    const many = product.sizes.length > MAX_CHIPS;

    let chipSizes = product.sizes;
    if (many) {
        chipSizes = recommended?.length ? recommended.slice(0, MAX_CHIPS) : nearestSizes(product.sizes, size, 8);
        if (!chipSizes.some((s) => s.id === size.id)) chipSizes = [size, ...chipSizes];
    }

    const groups = (["landscape", "portrait", "square"] as Orientation[])
        .map((o) => ({ o, sizes: product.sizes.filter((s) => orientationOf(s.widthCm, s.heightCm) === o) }))
        .filter((g) => g.sizes.length > 0);

    return (
        <div className="space-y-2">
            {product.sizes.length > 1 && (
                <ChipPicker
                    ariaLabel="Rozmiar"
                    selectedId={size.id}
                    onChange={setSizeId}
                    items={chipSizes.map((s) => ({
                        id: s.id,
                        label: s.label,
                        muted: !isAvailable(s.id, selectedOptions),
                        warn: lowQualityIds?.has(s.id),
                    }))}
                />
            )}

            {many && (
                <div className="flex justify-center">
                    <label className="relative inline-flex items-center gap-1.5 text-xs font-semibold text-white/75
                                      border border-white/20 rounded-full pl-3 pr-2 py-1.5 hover:border-white/40">
                        {recommended?.length ? "Inny rozmiar" : "Wszystkie rozmiary"} ({product.sizes.length})
                        <ChevronDown className="w-3.5 h-3.5" />
                        <select
                            aria-label="Wszystkie rozmiary"
                            value={size.id}
                            onChange={(e) => setSizeId(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        >
                            {groups.map((g) => (
                                <optgroup key={g.o} label={ORIENTATION_LABEL[g.o]}>
                                    {g.sizes.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.label}
                                            {lowQualityIds?.has(s.id) ? " — niska jakość druku" : ""}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </label>
                </div>
            )}

            {product.options.map((option) =>
                option.values.length > 1 ? (
                    <ChipPicker
                        key={option.name}
                        ariaLabel={option.name}
                        selectedId={selectedOptions[option.name]}
                        onChange={(value) => setOption(option.name, value)}
                        items={option.values.map((value) => ({
                            id: value,
                            label: value,
                            muted: !isAvailable(size.id, { ...selectedOptions, [option.name]: value }),
                        }))}
                    />
                ) : null
            )}
        </div>
    );
}
