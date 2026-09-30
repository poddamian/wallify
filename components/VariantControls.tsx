"use client";

import ChipPicker from "./ChipPicker";
import type { VariantSelection } from "@/hooks/useVariantSelection";
import type { Product } from "@/types";

interface VariantControlsProps {
    product: Product;
    selection: VariantSelection;
}

/** Wybór rozmiaru i pozostałych opcji (np. materiału) — wspólny dla obu trybów podglądu. */
export default function VariantControls({ product, selection }: VariantControlsProps) {
    const { size, setSizeId, selectedOptions, setOption, isAvailable } = selection;

    return (
        <div className="space-y-2">
            {product.sizes.length > 1 && (
                <ChipPicker
                    ariaLabel="Rozmiar"
                    selectedId={size.id}
                    onChange={setSizeId}
                    items={product.sizes.map((s) => ({
                        id: s.id,
                        label: s.label,
                        muted: !isAvailable(s.id, selectedOptions),
                    }))}
                />
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
