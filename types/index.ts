export type CanvasSize = {
    id: string;
    label: string; // e.g. "60 × 80 cm"
    widthCm: number;
    heightCm: number;
    /** GID wariantu Shopify — obecne gdy CanvasSize pochodzi z getProduct() */
    shopifyVariantId?: string;
};

export type ARState =
    | "idle"        // App not started
    | "requesting"  // Asking for camera permission
    | "denied"      // Permission denied
    | "scanning"    // Camera active, looking for wall
    | "placed"      // Canvas placed on wall
    | "error";      // Something went wrong

export type Product = {
    id: string;
    title: string;
    imageUrl: string;
    availableSizes: CanvasSize[];
    shopifyVariantId: string;
};

export type CameraStatus = "idle" | "loading" | "active" | "denied" | "error";
