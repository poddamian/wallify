/**
 * lib/cart-bridge.ts — dodawanie do PRAWDZIWEGO koszyka sklepu z ramki iframe.
 *
 * Wallify działa na innej domenie (vercel.app) niż sklep, więc nie widzi koszyka artavia.pl.
 * Dlatego prosi stronę sklepu (rodzica ramki) przez postMessage, żeby to ona dodała produkt
 * przez /cart/add.js. Po stronie sklepu nasłuchuje skrypt z snippets/wallify-bridge.liquid.
 *
 * Gdy skryptu nie ma (albo Wallify jest otwarty poza sklepem), zwraca null i Wallify
 * używa zapasowego koszyka Storefront API, jak dotąd.
 */

export type BridgeResult = { shopOrigin: string };

type CartAttribute = { key: string; value: string };

/** gid://shopify/ProductVariant/57744879223132 → 57744879223132 */
function numericId(gid: string): number | null {
    const n = Number(gid.split("/").pop());
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** Czy sklep zgłosił, że ma skrypt mostka (wiadomość „wallify:ready" po załadowaniu ramki) */
let bridgeReady: string | null = null;

if (typeof window !== "undefined" && window.parent !== window) {
    window.addEventListener("message", (e) => {
        if (e.source === window.parent && e.data?.type === "wallify:ready") bridgeReady = e.origin;
    });
    // Pytamy sklep, czy ma mostek (gdyby „ready" przyszło, zanim Wallify się załadował)
    try {
        window.parent.postMessage({ type: "wallify:hello" }, "*");
    } catch {
        /* ignorujemy */
    }
}

export async function addToShopCart(
    variantGid: string,
    attributes: CartAttribute[],
    quantity = 1,
    timeoutMs = 8000
): Promise<BridgeResult | null> {
    if (typeof window === "undefined" || window.parent === window) return null;
    const id = numericId(variantGid);
    if (!id) return null;

    // Bez potwierdzonego mostka czekamy krótko — żeby klient nie czekał, gdy skryptu w sklepie nie ma
    const wait = bridgeReady ? timeoutMs : Math.min(timeoutMs, 2500);
    const target = bridgeReady ?? "*";
    const requestId = Math.random().toString(36).slice(2);
    const properties = Object.fromEntries(attributes.map((a) => [a.key, a.value]));

    return new Promise<BridgeResult | null>((resolve, reject) => {
        const timer = setTimeout(() => {
            window.removeEventListener("message", onMessage);
            resolve(null);
        }, wait);

        function onMessage(e: MessageEvent) {
            if (e.source !== window.parent || e.data?.type !== "wallify:added" || e.data.requestId !== requestId) return;
            clearTimeout(timer);
            window.removeEventListener("message", onMessage);
            if (e.data.ok) resolve({ shopOrigin: e.origin });
            else reject(new Error(`Koszyk sklepu: ${e.data.error ?? "błąd"}`));
        }

        window.addEventListener("message", onMessage);
        window.parent.postMessage({ type: "wallify:add", requestId, variantId: id, quantity, properties }, target);
    });
}
