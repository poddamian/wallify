/**
 * GET /api/upload/status
 * Strona diagnostyczna dla właściciela sklepu: czy Wallify może zapisywać zdjęcia klientów
 * w Shopify Files, a jeśli nie — co dokładnie poprawić. Nie pokazuje żadnych sekretów.
 */

import { clientIp, rateLimited, text } from "@/lib/api-guard";
import { diagnoseAdmin, type AdminDiagnosis } from "@/lib/shopify-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HINTS: Record<string, string> = {
    brak_konfiguracji:
        "W Vercel brakuje SHOPIFY_ADMIN_CLIENT_ID i SHOPIFY_ADMIN_CLIENT_SECRET albo nie są zaznaczone dla środowiska Production. Dodaj je i zrób Redeploy.",
    brak_adresu_sklepu:
        "Brakuje SHOPIFY_ADMIN_URL. Ustaw https://enjmaa-pw.myshopify.com i zrób Redeploy.",
    zly_adres_sklepu:
        "SHOPIFY_ADMIN_URL musi wskazywać adres *.myshopify.com (u Ciebie https://enjmaa-pw.myshopify.com), a nie artavia.pl.",
    shop_not_permitted:
        "Aplikacja z Dev Dashboard jest w innej organizacji niż sklep Artavia, więc Shopify nie wyda tokenu. W Dev Dashboard sprawdź (lewy górny róg), w której organizacji jest aplikacja, i czy sklep Artavia jest na liście sklepów tej organizacji. Jeśli nie — utwórz aplikację w organizacji sklepu.",
    invalid_client:
        "Nieprawidłowy Client ID lub Client secret. Skopiuj je ponownie z Dev Dashboard → aplikacja → Ustawienia (bez spacji na końcu) i zrób Redeploy.",
    zly_token: "Shopify odrzucił token. Jeśli używasz SHOPIFY_ADMIN_ACCESS_TOKEN, sprawdź, czy jest aktualny.",
    brak_uprawnien:
        "Aplikacja nie ma uprawnień do plików. W Dev Dashboard dodaj w wersji aplikacji zakresy write_files i read_files, wydaj wersję i zatwierdź zmianę w sklepie.",
    brak_write_files:
        "Aplikacja działa, ale nie ma zakresu write_files. Dodaj write_files i read_files w wersji aplikacji, wydaj ją i zatwierdź w sklepie.",
};

function hintFor(code?: string): string {
    if (!code) return "";
    if (HINTS[code]) return HINTS[code];
    if (code.startsWith("token_http_")) {
        return "Shopify odrzucił prośbę o token. Sprawdź, czy aplikacja jest zainstalowana w sklepie Artavia i czy dane w Vercel pochodzą z tej samej aplikacji.";
    }
    return "Nieoczekiwany błąd — szczegóły poniżej.";
}

function esc(value: string): string {
    return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

function render(d: AdminDiagnosis): string {
    const row = (label: string, value: string) =>
        `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>`;
    const method =
        d.method === "client_credentials" ? "Client ID + Client secret (Dev Dashboard)"
            : d.method === "token" ? "SHOPIFY_ADMIN_ACCESS_TOKEN"
                : "brak";

    return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wallify — zapis zdjęć</title>
<style>
  body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:24px 16px;background:#111;color:#eee}
  main{max-width:560px;margin:0 auto}
  h1{font-size:22px;margin:0 0 16px}
  .box{border-radius:16px;padding:16px;margin:0 0 16px}
  .ok{background:#0f3d24;border:1px solid #1f7a48}
  .bad{background:#43161a;border:1px solid #a33a43}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:6px 4px;border-bottom:1px solid #333;vertical-align:top}
  th{color:#aaa;font-weight:500;width:40%}
  code,pre{font:13px ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;color:#ccc}
</style></head><body><main>
<h1>Wallify — zapis zdjęć klientów</h1>
${d.ok
        ? `<div class="box ok"><strong>✅ Działa.</strong> Wallify może zapisywać zdjęcia klientów w Shopify Files${d.shopName ? ` sklepu „${esc(d.shopName)}"` : ""}.</div>`
        : `<div class="box bad"><strong>❌ Nie działa</strong> (kod: <code>${esc(d.code ?? "?")}</code>)<br>${esc(hintFor(d.code))}</div>`}
<table>
${row("Adres sklepu", d.store ?? "—")}
${row("Sposób logowania", method)}
${d.shopName ? row("Sklep", d.shopName) : ""}
${d.scopes ? row("Uprawnienia aplikacji", d.scopes.join(", ") || "—") : ""}
</table>
${d.detail ? `<p style="margin-top:16px;color:#aaa">Odpowiedź Shopify:</p><pre>${esc(d.detail)}</pre>` : ""}
<p style="color:#777;font-size:13px;margin-top:24px">Po zmianie zmiennych w Vercel zrób Redeploy i odśwież tę stronę.</p>
</main></body></html>`;
}

export async function GET(req: Request) {
    if (rateLimited(`status:${clientIp(req)}`, 30)) return text(429, "Za dużo odświeżeń. Spróbuj za chwilę.");
    const diagnosis = await diagnoseAdmin();
    console.log("[Wallify status]", JSON.stringify({ ...diagnosis, scopes: diagnosis.scopes?.length }));
    return new Response(render(diagnosis), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
}
