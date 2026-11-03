/**
 * lib/upload-shared.ts — stałe wspólne dla klienta i serwera wysyłki zdjęć klientów.
 */

/** Formaty, które Shopify Files przyjmuje jako obraz bez konwersji */
export const UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Maksymalny rozmiar oryginału wysyłanego prosto do Shopify */
export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

/** Maksymalny rozmiar pliku wysyłanego awaryjnie przez serwer Wallify (limit Vercel ok. 4,5 MB) */
export const MAX_PROXY_BYTES = 4_000_000;

export function extensionFor(mimeType: string): string {
    return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
}

/** Nazwa pliku w Shopify Files: wallify-2026-09-30-a1b2c3d4.jpg — łatwo znaleźć i posprzątać */
export function wallifyFilename(mimeType: string): string {
    const date = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID().slice(0, 8);
    return `wallify-${date}-${id}.${extensionFor(mimeType)}`;
}
