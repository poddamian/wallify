/**
 * lib/photo.ts
 * Wszystko, co dzieje się ze zdjęciem klienta — lokalnie, w przeglądarce.
 * Zdjęcie nie jest nigdzie wysyłane (poza opcjonalnym ulepszeniem AI, o które klient prosi sam).
 */

import { applyH, pointInQuad, rectCorners, type Mat3, type Quad } from "./homography";
import { coverCrop } from "./product";

/** Dłuższy bok zdjęcia po zmniejszeniu — wystarcza do podglądu i eksportu, oszczędza pamięć telefonu. */
const MAX_PHOTO_SIDE = 2048;
/** Rozdzielczość pomocniczej kopii do analizy światła. */
const SAMPLE_SIDE = 320;

export type LoadedPhoto = {
    url: string; // blob: URL zmniejszonego JPG
    width: number;
    height: number;
    /** Mała kopia pikseli do analizy światła wokół obrazu */
    sample: ImageData;
    sampleScale: number; // sample px / photo px
};

export type LightFactors = [number, number, number];

export const NEUTRAL_LIGHT: LightFactors = [1, 1, 1];

function loadImageElement(src: string, crossOrigin?: "anonymous"): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (crossOrigin) img.crossOrigin = crossOrigin;
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Nie udało się wczytać obrazu: ${src}`));
        img.src = src;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Nie udało się zapisać obrazu"))), type, quality);
    });
}

/**
 * Wczytuje zdjęcie z pliku (przeglądarka sama obraca je wg EXIF),
 * zmniejsza do MAX_PHOTO_SIDE i przygotowuje małą kopię do analizy światła.
 */
export async function loadPhoto(file: File): Promise<LoadedPhoto> {
    const srcUrl = URL.createObjectURL(file);
    try {
        const img = await loadImageElement(srcUrl);
        const ratio = Math.min(1, MAX_PHOTO_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.round(img.naturalWidth * ratio);
        const height = Math.round(img.naturalHeight * ratio);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Brak obsługi canvas");
        ctx.drawImage(img, 0, 0, width, height);
        const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);

        const sampleScale = Math.min(1, SAMPLE_SIDE / Math.max(width, height));
        const sw = Math.max(1, Math.round(width * sampleScale));
        const sh = Math.max(1, Math.round(height * sampleScale));
        const small = document.createElement("canvas");
        small.width = sw;
        small.height = sh;
        const sctx = small.getContext("2d", { willReadFrequently: true });
        if (!sctx) throw new Error("Brak obsługi canvas");
        sctx.drawImage(canvas, 0, 0, sw, sh);

        return {
            url: URL.createObjectURL(blob),
            width,
            height,
            sample: sctx.getImageData(0, 0, sw, sh),
            sampleScale: sw / width,
        };
    } finally {
        URL.revokeObjectURL(srcUrl);
    }
}

/** Najmniejszy sensowny bok zdjęcia do druku */
const MIN_ARTWORK_SIDE = 500;
/** Największy plik, jaki przyjmujemy (zdjęcia z aparatów bywają duże) */
export const MAX_ARTWORK_BYTES = 40 * 1024 * 1024;

export class ArtworkError extends Error {}

/**
 * Wczytuje zdjęcie klienta do druku: oryginał zostaje nietknięty (trafi do Shopify przy zamówieniu),
 * a do podglądu powstaje zmniejszona kopia.
 */
export async function loadCustomerArtwork(file: File): Promise<{
    previewUrl: string;
    width: number;
    height: number;
}> {
    if (!file.type.startsWith("image/")) throw new ArtworkError("To nie jest plik ze zdjęciem.");
    if (file.size > MAX_ARTWORK_BYTES) throw new ArtworkError("Plik jest za duży (maks. 40 MB).");

    const srcUrl = URL.createObjectURL(file);
    try {
        let img: HTMLImageElement;
        try {
            img = await loadImageElement(srcUrl);
        } catch {
            throw new ArtworkError("Nie udało się otworzyć zdjęcia. Użyj pliku JPG lub PNG.");
        }
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        if (Math.min(width, height) < MIN_ARTWORK_SIDE) {
            throw new ArtworkError(`Zdjęcie jest za małe do druku (${width} × ${height} px).`);
        }

        const ratio = Math.min(1, MAX_PHOTO_SIDE / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new ArtworkError("Przeglądarka nie obsługuje podglądu.");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
        return { previewUrl: URL.createObjectURL(blob), width, height };
    } finally {
        URL.revokeObjectURL(srcUrl);
    }
}

/**
 * Przygotowuje plik do wysyłki przez serwer (limit ok. 4 MB na żądanie):
 * ponowny zapis jako JPG w pełnej rozdzielczości, a w razie potrzeby delikatne zmniejszenie.
 * Używane tylko awaryjnie, gdy przeglądarka nie może wysłać oryginału prosto do Shopify.
 */
export async function shrinkForUpload(file: File, maxBytes = 3_900_000): Promise<Blob> {
    if (file.size <= maxBytes && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;

    const srcUrl = URL.createObjectURL(file);
    try {
        const img = await loadImageElement(srcUrl);
        let side = Math.max(img.naturalWidth, img.naturalHeight);
        for (const quality of [0.92, 0.88, 0.85]) {
            for (let attempt = 0; attempt < 4; attempt++) {
                const ratio = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.naturalWidth * ratio);
                canvas.height = Math.round(img.naturalHeight * ratio);
                canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
                const blob = await canvasToBlob(canvas, "image/jpeg", quality);
                if (blob.size <= maxBytes) return blob;
                side = Math.round(side * 0.85);
            }
            side = Math.max(img.naturalWidth, img.naturalHeight);
        }
        throw new ArtworkError("Nie udało się przygotować zdjęcia do wysyłki.");
    } finally {
        URL.revokeObjectURL(srcUrl);
    }
}

/** Czy z canvasu można czytać piksele (obraz z innej domeny bez CORS „brudzi" canvas). */
function isReadable(img: HTMLImageElement): boolean {
    try {
        const c = document.createElement("canvas");
        c.width = c.height = 1;
        const ctx = c.getContext("2d");
        ctx?.drawImage(img, 0, 0, 1, 1);
        ctx?.getImageData(0, 0, 1, 1);
        return true;
    } catch {
        return false;
    }
}

/** Dla obrazów z CDN Shopify prosimy od razu o mniejszą wersję (parametr width). */
export function shopifySized(url: string, width: number): string {
    if (!url.includes("cdn.shopify.com")) return url;
    return `${url}${url.includes("?") ? "&" : "?"}width=${width}`;
}

/**
 * Wczytuje grafikę produktu tak, żeby dało się ją narysować na canvasie i zapisać.
 * Najpierw bezpośrednio z CDN Shopify (CORS), a w razie problemu przez optymalizator
 * obrazów Next.js (ta sama domena, więc canvas nie jest blokowany).
 */
export async function loadArtwork(url: string): Promise<HTMLImageElement> {
    const isSameOrigin =
        url.startsWith("/") || url.startsWith("blob:") || url.startsWith(window.location.origin);
    if (isSameOrigin) return loadImageElement(url);

    try {
        const img = await loadImageElement(shopifySized(url, 2048), "anonymous");
        if (isReadable(img)) return img;
    } catch {
        /* spróbujemy przez optymalizator */
    }
    return loadImageElement(`/_next/image?url=${encodeURIComponent(url)}&w=2048&q=75`);
}

/**
 * Szacuje światło padające na ścianę wokół obrazu: jasność i barwę (np. ciepłe żarówki).
 * Zwraca mnożniki R, G, B (0–1), którymi „przyciemniamy" grafikę, żeby nie świeciła
 * jak ekran na tle ciemniejszego pokoju. Tylko przyciemnia — nigdy nie rozjaśnia.
 */
export function estimateLight(photo: LoadedPhoto, quad: Quad): LightFactors {
    const { sample, sampleScale } = photo;
    const xs = quad.map((p) => p.x);
    const ys = quad.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padX = (maxX - minX) * 0.35;
    const padY = (maxY - minY) * 0.35;

    const pixels: [number, number, number, number][] = [];
    const step = Math.max(1, Math.round(1 / sampleScale));
    for (let y = minY - padY; y <= maxY + padY; y += step) {
        for (let x = minX - padX; x <= maxX + padX; x += step) {
            if (pointInQuad({ x, y }, quad)) continue;
            const sx = Math.round(x * sampleScale);
            const sy = Math.round(y * sampleScale);
            if (sx < 0 || sy < 0 || sx >= sample.width || sy >= sample.height) continue;
            const i = (sy * sample.width + sx) * 4;
            const r = sample.data[i];
            const g = sample.data[i + 1];
            const b = sample.data[i + 2];
            pixels.push([r, g, b, 0.2126 * r + 0.7152 * g + 0.0722 * b]);
        }
    }
    if (pixels.length < 20) return NEUTRAL_LIGHT;

    // Jaśniejsza część otoczenia (górne 30%) najlepiej oddaje światło padające na ścianę
    pixels.sort((a, b) => a[3] - b[3]);
    const bright = pixels.slice(Math.floor(pixels.length * 0.7));
    const avg = [0, 1, 2].map((c) => bright.reduce((s, p) => s + p[c], 0) / bright.length);
    const lum = bright.reduce((s, p) => s + p[3], 0) / bright.length;
    if (lum < 1) return NEUTRAL_LIGHT;

    // Jasna ściana w dobrym świetle ≈ 225–235; ciemniejsza → przyciemniamy obraz (z umiarem)
    const brightness = Math.min(1, Math.max(0.55, lum / 228));
    // Barwa światła: odchylenie kanałów od szarości, łagodnie ograniczone
    const cast = avg.map((v) => Math.min(1.12, Math.max(0.88, v / lum)));
    const maxCast = Math.max(...cast);

    const strength = 0.85;
    return cast.map((c) => {
        const f = brightness * (c / maxCast);
        return 1 - strength * (1 - f);
    }) as LightFactors;
}

export function lightToCss(f: LightFactors): string {
    const [r, g, b] = f.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
    return `rgb(${r}, ${g}, ${b})`;
}

type Tri = [number, number, number, number, number, number];

/** Rysuje trójkąt obrazu `src` (w pikselach grafiki) w trójkąt `dst` (w pikselach zdjęcia). */
function drawTriangle(
    ctx: CanvasRenderingContext2D,
    img: HTMLCanvasElement,
    s: Tri,
    d: Tri
) {
    const [x0, y0, x1, y1, x2, y2] = s;
    const [u0, v0, u1, v1, u2, v2] = d;

    // Lekko powiększony trójkąt docelowy — ukrywa cienkie szczeliny między trójkątami
    const cx = (u0 + u1 + u2) / 3;
    const cy = (v0 + v1 + v2) / 3;
    const grow = (u: number, v: number): [number, number] => {
        const dx = u - cx;
        const dy = v - cy;
        const len = Math.hypot(dx, dy) || 1;
        return [u + (dx / len) * 0.6, v + (dy / len) * 0.6];
    };

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...grow(u0, v0));
    ctx.lineTo(...grow(u1, v1));
    ctx.lineTo(...grow(u2, v2));
    ctx.closePath();
    ctx.clip();

    const den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
    if (Math.abs(den) < 1e-9) {
        ctx.restore();
        return;
    }
    const a = (u0 * (y1 - y2) + u1 * (y2 - y0) + u2 * (y0 - y1)) / den;
    const b = (v0 * (y1 - y2) + v1 * (y2 - y0) + v2 * (y0 - y1)) / den;
    const c = (u0 * (x2 - x1) + u1 * (x0 - x2) + u2 * (x1 - x0)) / den;
    const dd = (v0 * (x2 - x1) + v1 * (x0 - x2) + v2 * (x1 - x0)) / den;
    const e = (u0 * (x1 * y2 - x2 * y1) + u1 * (x2 * y0 - x0 * y2) + u2 * (x0 * y1 - x1 * y0)) / den;
    const f = (v0 * (x1 * y2 - x2 * y1) + v1 * (x2 * y0 - x0 * y2) + v2 * (x0 * y1 - x1 * y0)) / den;
    ctx.transform(a, b, c, dd, e, f);
    // Rysujemy tylko fragment tekstury pod trójkątem — cała tekstura 1000+ razy byłaby za wolna na telefonie
    const bx = Math.max(0, Math.floor(Math.min(x0, x1, x2)) - 2);
    const by = Math.max(0, Math.floor(Math.min(y0, y1, y2)) - 2);
    const bw = Math.min(img.width, Math.ceil(Math.max(x0, x1, x2)) + 2) - bx;
    const bh = Math.min(img.height, Math.ceil(Math.max(y0, y1, y2)) + 2) - by;
    if (bw > 0 && bh > 0) ctx.drawImage(img, bx, by, bw, bh, bx, by, bw, bh);
    ctx.restore();
}

export type ComposeOptions = {
    photo: LoadedPhoto;
    artwork: HTMLImageElement;
    h: Mat3;
    widthCm: number;
    heightCm: number;
    light: LightFactors;
    /** Położenie kadru grafiki (0–1), domyślnie środek */
    focus?: { x: number; y: number };
    /** Podpis w rogu, np. "Kwiaty Magnolii · 100 × 70 cm" */
    caption?: string;
};

/**
 * Składa zdjęcie ściany z obrazem w perspektywie (siatka trójkątów, bez zniekształceń grafiki)
 * i zwraca gotowy canvas — do zapisu, udostępnienia albo wysłania do ulepszenia AI.
 */
export async function composeImage(opts: ComposeOptions): Promise<HTMLCanvasElement> {
    const { photo, artwork, h, widthCm, heightCm, light, focus, caption } = opts;
    const photoImg = await loadImageElement(photo.url);

    const canvas = document.createElement("canvas");
    canvas.width = photo.width;
    canvas.height = photo.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Brak obsługi canvas");
    ctx.drawImage(photoImg, 0, 0, photo.width, photo.height);

    // Grafika przycięta do proporcji rozmiaru i przyciemniona do światła w pokoju
    const crop = coverCrop(artwork.naturalWidth, artwork.naturalHeight, widthCm, heightCm, focus);
    const texW = Math.round(Math.min(crop.sw, 2048));
    const texH = Math.round(texW * (crop.sh / crop.sw));
    const tex = document.createElement("canvas");
    tex.width = texW;
    tex.height = texH;
    const tctx = tex.getContext("2d");
    if (!tctx) throw new Error("Brak obsługi canvas");
    tctx.drawImage(artwork, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, texW, texH);
    tctx.globalCompositeOperation = "multiply";
    tctx.fillStyle = lightToCss(light);
    tctx.fillRect(0, 0, texW, texH);

    // Cień pod obrazem (krosno ma ok. 2 cm głębokości, światło zwykle z góry)
    const corners = rectCorners(widthCm, heightCm).map((p) => applyH(h, p));
    const unit = Math.hypot(applyH(h, { x: 1, y: 0 }).x - applyH(h, { x: 0, y: 0 }).x,
        applyH(h, { x: 1, y: 0 }).y - applyH(h, { x: 0, y: 0 }).y);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
    ctx.shadowBlur = Math.max(2, unit * 3);
    ctx.shadowOffsetY = Math.max(1, unit * 1.2);
    ctx.fillStyle = "rgb(40, 40, 40)";
    ctx.beginPath();
    corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Grafika w perspektywie: siatka N×N, każda komórka to dwa trójkąty
    const N = 24;
    const grid = (i: number, j: number) => {
        const u = i / N;
        const v = j / N;
        const p = applyH(h, { x: -widthCm / 2 + u * widthCm, y: -heightCm / 2 + v * heightCm });
        return { sx: u * texW, sy: v * texH, dx: p.x, dy: p.y };
    };
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const a = grid(i, j);
            const b = grid(i + 1, j);
            const c = grid(i + 1, j + 1);
            const d = grid(i, j + 1);
            drawTriangle(ctx, tex, [a.sx, a.sy, b.sx, b.sy, c.sx, c.sy], [a.dx, a.dy, b.dx, b.dy, c.dx, c.dy]);
            drawTriangle(ctx, tex, [a.sx, a.sy, c.sx, c.sy, d.sx, d.sy], [a.dx, a.dy, c.dx, c.dy, d.dx, d.dy]);
        }
    }

    if (caption) {
        const size = Math.max(14, Math.round(photo.width * 0.022));
        ctx.font = `600 ${size}px Inter, ui-sans-serif, system-ui, sans-serif`;
        const pad = Math.round(size * 0.6);
        const textW = ctx.measureText(caption).width;
        const boxH = size + pad * 1.4;
        const x = pad;
        const y = photo.height - pad - boxH;
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, textW + pad * 2, boxH, boxH / 2);
        else ctx.rect(x, y, textW + pad * 2, boxH);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "middle";
        ctx.fillText(caption, x + pad, y + boxH / 2);
    }

    return canvas;
}

export async function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
    return canvasToBlob(canvas, "image/jpeg", quality);
}

/**
 * Udostępnia plik (menu „Udostępnij" w telefonie), a gdy się nie da — np. w ramce iframe
 * bez uprawnienia web-share albo na komputerze — pobiera go.
 */
export async function shareOrDownload(blob: Blob, fileName: string, title: string): Promise<"shared" | "downloaded"> {
    const file = new File([blob], fileName, { type: blob.type });
    try {
        if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title });
            return "shared";
        }
    } catch (err) {
        // Klient zamknął menu udostępniania — nic więcej nie robimy
        if ((err as DOMException)?.name === "AbortError") return "shared";
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "downloaded";
}
