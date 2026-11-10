/** Rozmiar obrazu (unikalny w obrębie produktu), np. id "100x70". */
export type CanvasSize = {
    id: string;
    label: string; // np. "100 × 70 cm"
    widthCm: number;
    heightCm: number;
    /** true, gdy produkt nie ma opcji rozmiaru i wymiary są tylko orientacyjne */
    approximate?: boolean;
    /** true dla obrazu okrągłego (wariant „⌀40”): widthCm = heightCm = średnica */
    round?: boolean;
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
    /** Obraz z własnego zdjęcia klienta (tag produktu „personalizowany obraz" lub „wallify-wlasne-zdjecie") */
    personalized: boolean;
};

/** Zdjęcie klienta do druku — oryginał zostaje w pamięci przeglądarki do chwili zamówienia */
export type CustomerArtwork = {
    file: File;
    /** blob: URL zmniejszonej kopii do podglądu */
    previewUrl: string;
    /** Wymiary oryginału (po obróceniu wg EXIF) */
    width: number;
    height: number;
    /** Położenie kadru, 0–1 w poziomie i pionie (jak object-position) */
    focus: { x: number; y: number };
};

/** Dane personalizacji wysyłane razem z pozycją koszyka */
export type Personalization = {
    file: File;
    /** Kadr w pikselach oryginału */
    crop: { x: number; y: number; width: number; height: number };
    original: { width: number; height: number };
    dpi: number;
    qualityLabel: string;
    /** Obraz okrągły — kadr to front koła */
    round?: boolean;
};

/** Tryb podglądu, z którego klient dodał produkt do koszyka */
export type ViewerMode = "live" | "photo";

export type ARState =
    | "idle"        // App not started
    | "requesting"  // Asking for camera permission
    | "denied"      // Permission denied
    | "scanning"    // Camera active, looking for wall
    | "placed"      // Canvas placed on wall
    | "photo"       // Tryb ze zdjęcia ściany
    | "error";      // Something went wrong

export type CameraStatus = "idle" | "loading" | "active" | "denied" | "error";
