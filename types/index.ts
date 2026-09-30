/** Rozmiar obrazu (unikalny w obrębie produktu), np. id "100x70". */
export type CanvasSize = {
    id: string;
    label: string; // np. "100 × 70 cm"
    widthCm: number;
    heightCm: number;
    /** true, gdy produkt nie ma opcji rozmiaru i wymiary są tylko orientacyjne */
    approximate?: boolean;
};

export type Money = {
    amount: number;
    currencyCode: string;
};

/** Opcja produktu inna niż rozmiar, np. { name: "Materiał", values: ["Canvas", "Canvas naturalny"] } */
export type ProductOption = {
    name: string;
    values: string[];
};

/** Wariant Shopify — to jego ID trafia do koszyka. */
export type ProductVariant = {
    id: string; // GID, np. "gid://shopify/ProductVariant/123"
    sizeId: string | null;
    /** Wartości opcji innych niż rozmiar, np. { "Materiał": "Canvas" } */
    options: Record<string, string>;
    price: Money | null;
    availableForSale: boolean;
};

export type Product = {
    id: string;
    title: string;
    imageUrl: string;
    sizes: CanvasSize[];
    options: ProductOption[];
    variants: ProductVariant[];
};

/** Tryb podglądu, z którego klient dodał produkt do koszyka */
export type ViewerMode = "live" | "photo";

export type ARState =
    | "idle"        // App not started
    | "requesting"  // Asking for camera permission
    | "denied"      // Permission denied
    | "scanning"    // Camera active, looking for wall
    | "placed"      // Canvas placed on wall
    | "error";      // Something went wrong

export type CameraStatus = "idle" | "loading" | "active" | "denied" | "error";
