/**
 * lib/upload-client.ts — wysyłka zdjęcia klienta do Shopify Files z przeglądarki.
 *
 * 1. /api/upload/start → tymczasowy cel wysyłki w Shopify
 * 2. Oryginał leci prosto z przeglądarki do Shopify (bez limitu rozmiaru serwera Wallify)
 * 3. /api/upload/finish → plik w Shopify Files i jego adres do zamówienia
 * Gdy krok 2 lub 3 się nie uda, zdjęcie idzie awaryjnie przez /api/upload/proxy jako JPG do ok. 4 MB.
 */

import { shrinkForUpload } from "./photo";
import { MAX_PROXY_BYTES, UPLOAD_MIME_TYPES } from "./upload-shared";
import type { StagedTarget } from "./shopify-admin";

export type UploadedPhoto = {
    id: string;
    /** Publiczny adres pliku w CDN Shopify */
    url: string;
    /** Link do pliku w panelu Shopify */
    adminUrl: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
}

/** POST przez XMLHttpRequest — tylko on podaje postęp wysyłki */
function xhrPost(
    url: string,
    body: Document | XMLHttpRequestBodyInit,
    onProgress: (fraction: number) => void,
    headers: Record<string, string> = {}
): Promise<string> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
        xhr.timeout = 180_000;
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
        xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
                ? resolve(xhr.responseText)
                : reject(new Error(`${url}: HTTP ${xhr.status} ${xhr.responseText.slice(0, 200)}`));
        xhr.onerror = () => reject(new Error(`${url}: błąd sieci lub CORS`));
        xhr.ontimeout = () => reject(new Error(`${url}: przekroczony czas`));
        xhr.send(body);
    });
}

/**
 * Wysyła zdjęcie klienta do Shopify Files.
 * `onProgress` dostaje wartości 0–1 albo null, gdy postępu nie da się zmierzyć.
 */
export async function uploadCustomerPhoto(
    file: File,
    onProgress: (fraction: number | null) => void
): Promise<UploadedPhoto> {
    // Formaty spoza listy (np. AVIF, GIF) zapisujemy jako JPG w pełnej rozdzielczości
    const original: Blob = UPLOAD_MIME_TYPES.includes(file.type)
        ? file
        : await shrinkForUpload(file, Number.MAX_SAFE_INTEGER);

    // 1) Oryginał prosto do Shopify. Tryb no-cors: przeglądarka wysyła plik bez zapytania wstępnego
    //    (CORS), ale nie pokazuje odpowiedzi — o powodzeniu świadczy dopiero utworzenie pliku w kroku 3.
    try {
        onProgress(null);
        const start = await postJson<{ filename: string; target: StagedTarget; ticket: string }>(
            "/api/upload/start",
            { mimeType: original.type, fileSize: original.size }
        );
        const form = new FormData();
        for (const p of start.target.parameters) form.append(p.name, p.value);
        form.append("file", original, start.filename);
        await fetch(start.target.url, { method: "POST", body: form, mode: "no-cors" });
        return await postJson<UploadedPhoto>("/api/upload/finish", {
            resourceUrl: start.target.resourceUrl,
            ticket: start.ticket,
        });
    } catch (direct) {
        console.warn("[Wallify] Bezpośrednia wysyłka nie powiodła się, próbuję przez serwer:", direct);
    }

    // 2) Awaryjnie przez serwer Wallify: JPG do ok. 4 MB (limit żądania), z postępem wysyłki
    onProgress(0);
    const small = await shrinkForUpload(file, MAX_PROXY_BYTES - 50_000);
    const response = await xhrPost("/api/upload/proxy", small, onProgress, {
        "Content-Type": small.type || "image/jpeg",
    });
    const { resourceUrl, ticket } = JSON.parse(response) as { resourceUrl: string; ticket: string };
    onProgress(null);
    return postJson<UploadedPhoto>("/api/upload/finish", { resourceUrl, ticket });
}
