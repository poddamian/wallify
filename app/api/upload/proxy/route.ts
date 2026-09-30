/**
 * POST /api/upload/proxy
 * Awaryjna wysyłka zdjęcia klienta przez serwer Wallify — gdy przeglądarka nie może wysłać
 * pliku prosto do Shopify. Plik musi mieścić się w limicie żądania (ok. 4 MB), więc klient
 * wcześniej zapisuje go jako JPG w wysokiej jakości.
 *
 * Body: surowy obraz (Content-Type: image/jpeg | image/png | image/webp)
 * Odpowiedź: { resourceUrl, ticket }
 */

import { checkOrigin, clientIp, json, rateLimited, text } from "@/lib/api-guard";
import { createStagedUpload, isAdminConfigured, signResourceUrl, uploadToStagedTarget } from "@/lib/shopify-admin";
import { MAX_PROXY_BYTES, UPLOAD_MIME_TYPES, wallifyFilename } from "@/lib/upload-shared";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
    if (!isAdminConfigured()) return text(404, "Wysyłka zdjęć nie jest skonfigurowana.");
    const bad = checkOrigin(req);
    if (bad) return bad;
    if (rateLimited(`upload:${clientIp(req)}`, 30)) return text(429, "Za dużo wysyłek. Spróbuj za jakiś czas.");

    const mimeType = (req.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!UPLOAD_MIME_TYPES.includes(mimeType)) return text(415, "Nieobsługiwany format zdjęcia.");

    const body = await req.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_PROXY_BYTES) return text(413, "Nieprawidłowy rozmiar pliku.");

    try {
        const filename = wallifyFilename(mimeType);
        const target = await createStagedUpload({ filename, mimeType, fileSize: body.byteLength });
        await uploadToStagedTarget(target, new Blob([body], { type: mimeType }), filename);
        return json({ resourceUrl: target.resourceUrl, ticket: signResourceUrl(target.resourceUrl) });
    } catch (err) {
        console.error("[Wallify upload/proxy]", err);
        return text(502, "Nie udało się wysłać zdjęcia do sklepu.");
    }
}
