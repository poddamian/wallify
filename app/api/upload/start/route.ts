/**
 * POST /api/upload/start
 * Krok 1 wysyłki zdjęcia klienta: tworzy w Shopify tymczasowy cel wysyłki (staged upload),
 * na który przeglądarka wyśle oryginał bezpośrednio — bez limitu rozmiaru serwera Wallify.
 *
 * Body (JSON): { mimeType: "image/jpeg", fileSize: 1234567 }
 */

import { checkOrigin, clientIp, json, rateLimited, text } from "@/lib/api-guard";
import { createStagedUpload, isAdminConfigured, signResourceUrl } from "@/lib/shopify-admin";
import { MAX_UPLOAD_BYTES, UPLOAD_MIME_TYPES, wallifyFilename } from "@/lib/upload-shared";

export const runtime = "nodejs";

export async function POST(req: Request) {
    if (!isAdminConfigured()) return text(404, "Wysyłka zdjęć nie jest skonfigurowana.");
    const bad = checkOrigin(req);
    if (bad) return bad;
    if (rateLimited(`upload:${clientIp(req)}`, 30)) return text(429, "Za dużo wysyłek. Spróbuj za jakiś czas.");

    let body: { mimeType?: string; fileSize?: number };
    try {
        body = await req.json();
    } catch {
        return text(400, "Nieprawidłowe dane.");
    }
    const mimeType = String(body.mimeType ?? "");
    const fileSize = Number(body.fileSize);
    if (!UPLOAD_MIME_TYPES.includes(mimeType)) return text(415, "Nieobsługiwany format zdjęcia.");
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_UPLOAD_BYTES) {
        return text(413, "Nieprawidłowy rozmiar pliku.");
    }

    try {
        const filename = wallifyFilename(mimeType);
        const target = await createStagedUpload({ filename, mimeType, fileSize });
        return json({ filename, target, ticket: signResourceUrl(target.resourceUrl) });
    } catch (err) {
        console.error("[Wallify upload/start]", err);
        return text(502, "Nie udało się przygotować wysyłki zdjęcia.");
    }
}
