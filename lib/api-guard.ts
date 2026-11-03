/**
 * lib/api-guard.ts — wspólne zabezpieczenia API routes Wallify (tylko serwer).
 */

/** Odpowiedź tekstowa bez cache */
export function text(status: number, message: string): Response {
    return new Response(message, {
        status,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
}

export function json(data: unknown, status = 200): Response {
    return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Żądania tylko z własnej strony Wallify (iframe na stronie sklepu też ma origin Wallify).
 * Zwraca odpowiedź błędu albo null, gdy wszystko w porządku.
 */
export function checkOrigin(req: Request): Response | null {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && host) {
        try {
            if (new URL(origin).host !== host) return text(403, "Niedozwolone źródło żądania.");
        } catch {
            return text(403, "Niedozwolone źródło żądania.");
        }
    }
    return null;
}

export function clientIp(req: Request): string {
    return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

const buckets = new Map<string, number[]>();

/**
 * Prosty limit żądań w oknie czasowym (w pamięci jednej instancji serwera).
 * Chroni przed nabijaniem kosztów i zaśmiecaniem plików sklepu.
 */
export function rateLimited(key: string, limit: number, windowMs = 3_600_000): boolean {
    const now = Date.now();
    const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
        buckets.set(key, recent);
        return true;
    }
    recent.push(now);
    buckets.set(key, recent);
    if (buckets.size > 10_000) buckets.clear();
    return false;
}
