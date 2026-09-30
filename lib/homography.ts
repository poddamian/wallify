/**
 * lib/homography.ts
 * Matematyka perspektywy: odwzorowanie płaszczyzny ściany (w cm) na piksele zdjęcia.
 *
 * H to macierz 3×3 (wierszami), która przenosi punkt ściany (x, y) w cm —
 * z początkiem w środku obrazu — na punkt zdjęcia w pikselach.
 * Dzięki temu zmiana rozmiaru obrazu zachowuje perspektywę i skalę.
 */

export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point]; // lewy-górny, prawy-górny, prawy-dolny, lewy-dolny
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Skala + przesunięcie, bez perspektywy: 1 cm = `pxPerCm` pikseli, środek obrazu w (cx, cy). */
export function similarity(pxPerCm: number, cx: number, cy: number): Mat3 {
    return [pxPerCm, 0, cx, 0, pxPerCm, cy, 0, 0, 1];
}

export function applyH(h: Mat3, p: Point): Point {
    const w = h[6] * p.x + h[7] * p.y + h[8];
    return {
        x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
        y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
    };
}

export function multiply(a: Mat3, b: Mat3): Mat3 {
    const r = new Array(9).fill(0) as Mat3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
        }
    }
    return r;
}

/** Przesuwa odwzorowanie o (dx, dy) pikseli zdjęcia. */
export function translate(h: Mat3, dx: number, dy: number): Mat3 {
    return multiply([1, 0, dx, 0, 1, dy, 0, 0, 1], h);
}

/** Narożniki prostokąta w × h (cm) wyśrodkowanego w (0, 0). */
export function rectCorners(widthCm: number, heightCm: number): Quad {
    const w = widthCm / 2;
    const h = heightCm / 2;
    return [
        { x: -w, y: -h },
        { x: w, y: -h },
        { x: w, y: h },
        { x: -w, y: h },
    ];
}

export function quadFor(h: Mat3, widthCm: number, heightCm: number): Quad {
    return rectCorners(widthCm, heightCm).map((p) => applyH(h, p)) as Quad;
}

/**
 * Macierz przenosząca 4 punkty `src` na 4 punkty `dst` (układ 8 równań, eliminacja Gaussa).
 * Zwraca null, gdy punkty są zdegenerowane (np. trzy na jednej linii).
 */
export function solveHomography(src: Quad, dst: Quad): Mat3 | null {
    const a: number[][] = [];
    for (let i = 0; i < 4; i++) {
        const { x, y } = src[i];
        const { x: u, y: v } = dst[i];
        a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
        a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    }

    for (let col = 0; col < 8; col++) {
        let pivot = col;
        for (let r = col + 1; r < 8; r++) {
            if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
        }
        if (Math.abs(a[pivot][col]) < 1e-10) return null;
        [a[col], a[pivot]] = [a[pivot], a[col]];

        for (let r = 0; r < 8; r++) {
            if (r === col) continue;
            const f = a[r][col] / a[col][col];
            for (let c = col; c < 9; c++) a[r][c] -= f * a[col][c];
        }
    }

    const x = a.map((row, i) => row[8] / row[i]);
    return [x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[7], 1];
}

/**
 * CSS matrix3d przenoszący prostokąt elementu (0,0)–(boxW,boxH) na czworokąt `quad`
 * (przy transform-origin: 0 0).
 */
export function cssMatrix3d(boxW: number, boxH: number, quad: Quad): string | null {
    const box: Quad = [
        { x: 0, y: 0 },
        { x: boxW, y: 0 },
        { x: boxW, y: boxH },
        { x: 0, y: boxH },
    ];
    const h = solveHomography(box, quad);
    if (!h) return null;
    const m = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]];
    return `matrix3d(${m.map((n) => +n.toFixed(10)).join(",")})`;
}

/** Czy czworokąt jest wypukły i niezbyt spłaszczony — inaczej perspektywa „się przekręca". */
export function isReasonableQuad(q: Quad, minSide = 8): boolean {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
        const a = q[i];
        const b = q[(i + 1) % 4];
        const c = q[(i + 2) % 4];
        if (Math.hypot(b.x - a.x, b.y - a.y) < minSide) return false;
        const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        if (Math.abs(cross) < 1e-6) return false;
        const s = Math.sign(cross);
        if (sign === 0) sign = s;
        else if (s !== sign) return false;
    }
    return true;
}

export function pointInQuad(p: Point, q: Quad): boolean {
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
        const a = q[i];
        const b = q[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
            inside = !inside;
        }
    }
    return inside;
}

/** Przybliżona lokalna skala (px zdjęcia na 1 cm ściany) w środku obrazu. */
export function localPxPerCm(h: Mat3): number {
    const c = applyH(h, { x: 0, y: 0 });
    const r = applyH(h, { x: 1, y: 0 });
    const d = applyH(h, { x: 0, y: 1 });
    return (Math.hypot(r.x - c.x, r.y - c.y) + Math.hypot(d.x - c.x, d.y - c.y)) / 2;
}
