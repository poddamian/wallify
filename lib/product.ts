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
    tags?: string[];
    variants: RawVariant[];
};

/** Tagi produktu, które włączają wgrywanie własnego zdjęcia klienta */
export const PERSONALIZED_TAGS = ["wallify-wlasne-zdjecie", "personalizowany obraz", "personalizowany"];

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

    const personalized = (raw.tags ?? []).some((t) => PERSONALIZED_TAGS.includes(t.trim().toLowerCase()));

    return { id: raw.id, title: raw.title, imageUrl: raw.imageUrl, sizes, options, variants, personalized };
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

// ─── Rozmiary i zdjęcie klienta ──────────────────────────────────────────────

export type Orientation = "landscape" | "portrait" | "square";

export function orientationOf(widthCm: number, heightCm: number): Orientation {
    const r = Math.log(widthCm / heightCm);
    if (Math.abs(r) < 0.03) return "square";
    return r > 0 ? "landscape" : "portrait";
}

export const ORIENTATION_LABEL: Record<Orientation, string> = {
    landscape: "Poziome",
    portrait: "Pionowe",
    square: "Kwadratowe",
};

/**
 * Rozmiary o proporcjach najbliższych zdjęciu (najmniej przycinania), maks. `max` sztuk,
 * posortowane od najmniejszego. Tolerancja rośnie, dopóki nie znajdzie się kilka propozycji.
 * Gdy żaden nie pasuje (np. panorama) — rozmiary w tej samej orientacji.
 */
export function recommendSizes(sizes: CanvasSize[], aspect: number, max = 12): CanvasSize[] {
    const byArea = (a: CanvasSize, b: CanvasSize) => a.widthCm * a.heightCm - b.widthCm * b.heightCm;
    const misfit = (s: CanvasSize) => Math.abs(Math.log(s.widthCm / s.heightCm / aspect));

    for (const tolerance of [0.06, 0.1, 0.15]) {
        const close = sizes.filter((s) => misfit(s) <= tolerance);
        if (close.length >= 6 || tolerance === 0.15) {
            if (close.length === 0) break;
            return [...close].sort((a, b) => misfit(a) - misfit(b)).slice(0, max).sort(byArea);
        }
    }
    const o = orientationOf(aspect, 1);
    return sizes.filter((s) => orientationOf(s.widthCm, s.heightCm) === o).sort(byArea).slice(0, max);
}

export type QualityLevel = "excellent" | "good" | "fair" | "low";

/**
 * Jakość druku wg rozdzielczości: ile pikseli zdjęcia przypada na cal płótna.
 * Na płótnie (ogląda się je z dystansu) 100+ DPI to bardzo dobrze, poniżej ok. 45 widać rozmycie.
 */
export function printQuality(pixelsAcross: number, cmAcross: number): {
    dpi: number;
    level: QualityLevel;
    label: string;
} {
    const dpi = Math.round(pixelsAcross / (cmAcross / 2.54));
    if (dpi >= 100) return { dpi, level: "excellent", label: "bardzo dobra" };
    if (dpi >= 65) return { dpi, level: "good", label: "dobra" };
    if (dpi >= 45) return { dpi, level: "fair", label: "średnia — z bliska może być lekko miękka" };
    return { dpi, level: "low", label: "za niska na ten rozmiar" };
}

/**
 * Wycinek obrazu o proporcjach rozmiaru (jak object-fit: cover), przesunięty wg `focus` (0–1).
 * Zwraca prostokąt w pikselach obrazu.
 */
export function coverCrop(
    imgW: number,
    imgH: number,
    widthCm: number,
    heightCm: number,
    focus: { x: number; y: number } = { x: 0.5, y: 0.5 }
) {
    const target = widthCm / heightCm;
    const source = imgW / imgH;
    if (source > target) {
        const sw = imgH * target;
        return { sx: (imgW - sw) * focus.x, sy: 0, sw, sh: imgH };
    }
    const sh = imgW / target;
    return { sx: 0, sy: (imgH - sh) * focus.y, sw: imgW, sh };
}
