/**
 * POST /api/enhance
 * Opcjonalne ulepszenie AI gotowej wizualizacji: tylko światło, cień i krawędź płótna.
 * Działa wyłącznie, gdy w Vercel ustawiono GEMINI_API_KEY (bez klucza przycisk się nie pokazuje).
 *
 * Wejście: surowy JPG/PNG w body (to, co widzi klient: zdjęcie ściany + wstawiony obraz).
 * Wyjście: obraz od modelu (image/png lub image/jpeg).
 */

import { checkOrigin, clientIp, rateLimited, text } from "@/lib/api-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const API_BASE = process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com";
const MAX_BYTES = 3_500_000;
/** Limit wywołań na adres IP na godzinę (na instancję serwera) — chroni przed nabijaniem kosztów */
const LIMIT_PER_HOUR = Number(process.env.AI_LIMIT_PER_HOUR || 8);

const PROMPT = [
    "This is a real photo of a room. A canvas print has been digitally placed on the wall.",
    "Make ONLY the canvas print look physically present in this room:",
    "match its brightness, contrast and color temperature to the light in the room,",
    "add a soft, natural shadow on the wall consistent with the room's light direction,",
    "and a thin side edge of the stretched canvas only if the viewing angle would show it.",
    "Strict rules: do not change the artwork itself (content, composition, details, colors' identity);",
    "do not move, resize, crop or rotate the canvas; do not change anything else in the photo",
    "(walls, furniture, objects, perspective, framing). Keep the same framing and aspect ratio. Photorealistic.",
].join(" ");

type GeminiPart = {
    text?: string;
    inlineData?: { mimeType?: string; data?: string };
    inline_data?: { mime_type?: string; data?: string };
};

export async function POST(req: Request) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return text(404, "Ulepszenie AI nie jest włączone.");

    const bad = checkOrigin(req);
    if (bad) return bad;
    if (rateLimited(`ai:${clientIp(req)}`, LIMIT_PER_HOUR)) {
        return text(429, "Za dużo ulepszeń AI w krótkim czasie. Spróbuj za jakiś czas.");
    }

    const mimeType = (req.headers.get("content-type") ?? "").split(";")[0].trim();
    if (mimeType !== "image/jpeg" && mimeType !== "image/png") {
        return text(415, "Oczekiwano obrazu JPG lub PNG.");
    }

    const body = await req.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return text(413, "Nieprawidłowy rozmiar obrazu.");

    let res: Response;
    try {
        res = await fetch(
            `${API_BASE}/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: JSON.stringify({
                    contents: [
                        {
                            role: "user",
                            parts: [
                                { inline_data: { mime_type: mimeType, data: Buffer.from(body).toString("base64") } },
                                { text: PROMPT },
                            ],
                        },
                    ],
                    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
                }),
                signal: AbortSignal.timeout(55_000),
            }
        );
    } catch (err) {
        console.error("[Wallify AI] Brak odpowiedzi od Gemini:", err);
        return text(504, "Model AI nie odpowiedział na czas.");
    }

    if (!res.ok) {
        console.error("[Wallify AI] Gemini HTTP", res.status, (await res.text()).slice(0, 500));
        return text(502, "Model AI zwrócił błąd.");
    }

    const json = (await res.json()) as {
        candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
    };
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const image = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const data = image?.inlineData?.data ?? image?.inline_data?.data;
    const outType = image?.inlineData?.mimeType ?? image?.inline_data?.mime_type ?? "image/png";

    if (!data) {
        console.error("[Wallify AI] Brak obrazu w odpowiedzi:", json.candidates?.[0]?.finishReason);
        return text(502, "Model AI nie zwrócił obrazu.");
    }

    return new Response(new Uint8Array(Buffer.from(data, "base64")), {
        headers: { "Content-Type": outType, "Cache-Control": "no-store" },
    });
}
