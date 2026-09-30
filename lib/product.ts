/**
 * lib/product.ts
 * Czyste funkcje (bez fetch i bez Reacta) do mapowania wariantów Shopify
 * na rozmiary, opcje i konkretny wariant, który trafia do koszyka.
 */

import type { CanvasSize, Money, Product, ProductOption, ProductVariant } from "@/types";

/** Kształt wariantu zwracany przez Storefront API (po spłaszczeniu edges). */
export type RawVariant = {
    id: string;
    title: string;
    availableForSale?: boolean | null;
    price?: { amount: string; currencyCode: string } | null;
    selectedOptions: { name: string; value: string }[];
};

export type RawProduct = {
    id: string;
    title: string;
    imageUrl: string;
    variants: RawVariant[];
};

const SIZE_OPTION_NAME = /rozmiar|size|wymiar|format/i;

/** Rozmiar używany, gdy produkt nie ma opcji rozmiaru — tylko orientacyjnie. */
const FALLBACK_SIZE: CanvasSize = {
    id: "default",
    label: "70 × 50 cm",
    widthCm: 70,
    heightCm: 50,
    approximate: true,
};

/**
 * Parsuje wartość rozmiaru wariantu (np. "70x50", "70x50 cm", "70 × 50 cm")
 * i zwraca { widthCm, heightCm } lub null, jeśli nie da się jej odczytać.
 */
export function parseSize(value: string): { widthCm: number; heightCm: number } | null {
    const match = value.replace(/\s/g, "").match(/^(\d+(?:[.,]\d+)?)[xX×](\d+(?:[.,]\d+)?)/);
    if (!match) return null;
    const widthCm = Number(match[1].replace(",", "."));
    const heightCm = Number(match[2].replace(",", "."));
    if (!widthCm || !heightCm) return null;
    return { widthCm, heightCm };
}

function sizeLabel(widthCm: number, heightCm: number): string {
    const fmt = (n: number) => String(n).replace(".", ",");
    return `${fmt(widthCm)} × ${fmt(heightCm)} cm`;
}

/**
 * Buduje Product z surowych wariantów Shopify:
 * - opcja rozmiaru → lista unikalnych rozmiarów,
 * - pozostałe opcje (np. Materiał) → lista opcji do wyboru,
 * - każdy wariant zachowuje swoje prawdziwe ID, cenę i dostępność.
 */
export function buildProduct(raw: RawProduct): Product {
    const sizes: CanvasSize[] = [];
    const options: ProductOption[] = [];
    const variants: ProductVariant[] = [];

    for (const v of raw.variants) {
        let sizeId: string | null = null;
        const opts: Record<string, string> = {};

        for (const { name, value } of v.selectedOptions) {
            const dims = SIZE_OPTION_NAME.test(name) ? parseSize(value) : null;

            if (dims && sizeId === null) {
                sizeId = `${dims.widthCm}x${dims.heightCm}`;
                if (!sizes.some((s) => s.id === sizeId)) {
                    sizes.push({
                        id: sizeId,
                        label: sizeLabel(dims.widthCm, dims.heightCm),
                        widthCm: dims.widthCm,
                        heightCm: dims.heightCm,
                    });
                }
                continue;
            }

            // Produkt bez wariantów ma w Shopify opcję "Title: Default Title" — pomijamy ją
            if (name === "Title" && value === "Default Title") continue;

            opts[name] = value;
            let option = options.find((o) => o.name === name);
            if (!option) {
                option = { name, values: [] };
                options.push(option);
            }
            if (!option.values.includes(value)) option.values.push(value);
        }

        variants.push({
            id: v.id,
            sizeId,
            options: opts,
            price: v.price
                ? { amount: Number(v.price.amount), currencyCode: v.price.currencyCode }
                : null,
            availableForSale: v.availableForSale ?? true,
        });
    }

    if (sizes.length === 0) {
        sizes.push(FALLBACK_SIZE);
        for (const v of variants) v.sizeId = FALLBACK_SIZE.id;
    }

    return { id: raw.id, title: raw.title, imageUrl: raw.imageUrl, sizes, options, variants };
}

/** Wariant pasujący do wybranego rozmiaru i opcji (albo undefined, jeśli takiej kombinacji nie ma). */
export function findVariant(
    product: Product,
    sizeId: string,
    selectedOptions: Record<string, string>
): ProductVariant | undefined {
    return product.variants.find(
        (v) =>
            v.sizeId === sizeId &&
            product.options.every((o) => v.options[o.name] === selectedOptions[o.name])
    );
}

/** Domyślny wybór: 70 × 50 cm (albo środkowy rozmiar) i pierwsze dostępne wartości opcji. */
export function defaultSelection(product: Product): {
    sizeId: string;
    options: Record<string, string>;
} {
    const preferred =
        product.sizes.find((s) => s.id === "70x50") ??
        product.sizes[Math.floor((product.sizes.length - 1) / 2)];

    const firstAvailable = product.variants.find((v) => v.availableForSale) ?? product.variants[0];
    const options: Record<string, string> = {};
    for (const o of product.options) {
        options[o.name] = firstAvailable?.options[o.name] ?? o.values[0];
    }

    return { sizeId: preferred.id, options };
}

export function formatPrice(money: Money): string {
    try {
        return new Intl.NumberFormat("pl-PL", {
            style: "currency",
            currency: money.currencyCode,
        }).format(money.amount);
    } catch {
        return `${money.amount.toFixed(2)} ${money.currencyCode}`;
    }
}

/**
 * Skraca długi tytuł SEO do nazwy obrazu:
 * "Obraz Na Płótnie Kwiaty Magnolii – subtelny realizm…" → "Obraz Na Płótnie Kwiaty Magnolii"
 */
export function shortTitle(title: string, max = 48): string {
    const head = title.split(/\s[–—-]\s/)[0].trim();
    return head.length > max ? `${head.slice(0, max - 1).trimEnd()}…` : head;
}
