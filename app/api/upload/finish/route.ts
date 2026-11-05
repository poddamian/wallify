/**
 * POST /api/upload/finish
 * Krok 2: z wysłanego pliku tworzy obraz w Shopify Files (Treści → Pliki) i zwraca jego adres.
 * Ten adres trafia do zamówienia jako ukryta właściwość pozycji „_Zdjęcie".
 *
 * Body (JSON): { resourceUrl, ticket } — ticket z /api/upload/start lub /proxy
 * Odpowiedź: { id, url, adminUrl }
 */

import { checkOrigin, clientIp, json, rateLimited, text } from "@/lib/api-guard";
import { createFileFromStaged, errorCode, isAdminConfigured, verifyResourceUrl } from "@/lib/shopify-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
    if (!isAdminConfigured()) return text(404, "Wysyłka zdjęć nie jest skonfigurowana.");
    const bad = checkOrigin(req);
    if (bad) return bad;
    if (rateLimited(`finish:${clientIp(req)}`, 30)) return text(429, "Za dużo wysyłek. Spróbuj za jakiś czas.");

    let resourceUrl = "";
    let ticket = "";
    try {
        const body = await req.json();
        resourceUrl = String(body.resourceUrl ?? "");
        ticket = String(body.ticket ?? "");
    } catch {
        return text(400, "Nieprawidłowe dane.");
    }
    // Tylko pliki wysłane przez Wallify — inaczej ktoś mógłby wgrać sklepowi dowolny obraz z internetu
    if (!resourceUrl || !verifyResourceUrl(resourceUrl, ticket)) return text(403, "Nieprawidłowy bilet wysyłki.");

    try {
        const file = await createFileFromStaged(resourceUrl, "Wallify — zdjęcie klienta do druku");
        return json(file);
    } catch (err) {
        console.error("[Wallify upload/finish]", err);
        return json({ error: "Sklep nie przyjął zdjęcia.", code: errorCode(err) }, 502);
    }
}
