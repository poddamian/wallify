/**
 * lib/shopify-admin.ts — TYLKO po stronie serwera (API routes).
 * Dostęp do Admin API sklepu, potrzebny do zapisu zdjęć klientów w Shopify Files.
 *
 * Dwa sposoby uwierzytelnienia (wystarczy jeden):
 * 1) Aplikacja z Dev Dashboard: SHOPIFY_ADMIN_CLIENT_ID + SHOPIFY_ADMIN_CLIENT_SECRET
 *    — token pobierany automatycznie (client credentials) i odświeżany co ok. 24 h.
 * 2) Stała aplikacja (starszy typ, utworzona w panelu przed 2026): SHOPIFY_ADMIN_ACCESS_TOKEN.
 *
 * Adres sklepu: SHOPIFY_ADMIN_URL (np. https://twojsklep.myshopify.com, sama nazwa „twojsklep"
 * też działa), a gdy go brak — NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN.
 *
 * Diagnoza konfiguracji: GET /api/upload/status
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const API_VERSION = "2026-07";

/**
 * Błąd Admin API z krótkim kodem (bez sekretów) — trafia do logów, do strony
 * /api/upload/status i do zamówienia, gdy wysyłka zdjęcia się nie uda.
 */
export class AdminError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = "AdminError";
    }
}

/** Zmienna środowiskowa bez spacji i znaków nowej linii (częsty efekt wklejania w Vercel) */
function env(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
}

/**
 * Adres sklepu do Admin API: zawsze https://<sklep>.myshopify.com.
 * Przyjmuje też „enjmaa-pw", „enjmaa-pw.myshopify.com" i „admin.shopify.com/store/enjmaa-pw".
 */
export function adminBaseUrl(): string {
    const raw = env("SHOPIFY_ADMIN_URL") ?? env("NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN");
    if (!raw) throw new AdminError("brak_adresu_sklepu", "Brak SHOPIFY_ADMIN_URL");

    const withoutProtocol = raw.replace(/^https?:\/\//i, "");
    const adminPath = withoutProtocol.match(/^admin\.shopify\.com\/store\/([a-z0-9-]+)/i);
    let host = adminPath ? `${adminPath[1]}.myshopify.com` : withoutProtocol.split("/")[0];
    if (!host.includes(".")) host = `${host}.myshopify.com`;
    return `https://${host.toLowerCase()}`;
}

export function isAdminConfigured(): boolean {
    return Boolean(
        env("SHOPIFY_ADMIN_ACCESS_TOKEN") || (env("SHOPIFY_ADMIN_CLIENT_ID") && env("SHOPIFY_ADMIN_CLIENT_SECRET"))
    );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
    const staticToken = env("SHOPIFY_ADMIN_ACCESS_TOKEN");
    if (staticToken) return staticToken;

    if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60_000) return cachedToken.value;

    const clientId = env("SHOPIFY_ADMIN_CLIENT_ID");
    const clientSecret = env("SHOPIFY_ADMIN_CLIENT_SECRET");
    if (!clientId || !clientSecret) throw new AdminError("brak_konfiguracji", "Brak danych dostępu do Admin API");

    const base = adminBaseUrl();
    if (!base.endsWith(".myshopify.com")) {
        throw new AdminError("zly_adres_sklepu", `Adres ${base} nie jest adresem *.myshopify.com`);
    }

    let res: Response;
    try {
        res = await fetch(`${base}/admin/oauth/access_token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: clientId,
                client_secret: clientSecret,
            }),
            cache: "no-store",
            redirect: "manual",
        });
    } catch (err) {
        throw new AdminError("zly_adres_sklepu", `Nie można połączyć się z ${base}: ${String(err)}`);
    }

    const body = await res.text();
    if (!res.ok) {
        // Shopify zwraca np. {"error":"shop_not_permitted","error_description":"..."}
        let code = `token_http_${res.status}`;
        try {
            const parsed = JSON.parse(body) as { error?: string; errors?: string };
            if (parsed.error) code = parsed.error;
            else if (typeof parsed.errors === "string") code = parsed.errors;
        } catch {
            /* odpowiedź nie jest JSON-em */
        }
        throw new AdminError(code, `Token Admin API: HTTP ${res.status} ${body.slice(0, 300)}`);
    }

    const json = JSON.parse(body) as { access_token: string; expires_in?: number };
    cachedToken = {
        value: json.access_token,
        expiresAt: Date.now() + (json.expires_in ?? 86_399) * 1000,
    };
    return cachedToken.value;
}

export async function adminGraphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const send = async () =>
        fetch(`${adminBaseUrl()}/admin/api/${API_VERSION}/graphql.json`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": await getAccessToken(),
            },
            body: JSON.stringify({ query, variables }),
            cache: "no-store",
        });

    let res = await send();
    if (res.status === 401 && cachedToken) {
        // Token mógł wygasnąć wcześniej — pobieramy nowy i próbujemy raz jeszcze
        cachedToken = null;
        res = await send();
    }
    if (!res.ok) {
        const code = res.status === 401 ? "zly_token" : res.status === 403 ? "brak_uprawnien" : `admin_http_${res.status}`;
        throw new AdminError(code, `Admin API HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const json = (await res.json()) as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
    if (json.errors?.length) {
        const denied = json.errors.some((e) => /access denied/i.test(e.message) || e.extensions?.code === "ACCESS_DENIED");
        throw new AdminError(
            denied ? "brak_uprawnien" : "admin_graphql",
            `Admin API: ${json.errors.map((e) => e.message).join(", ")}`
        );
    }
    if (!json.data) throw new AdminError("admin_graphql", "Admin API: pusta odpowiedź");
    return json.data;
}

/** Kod błędu do pokazania / zapisania (bez szczegółów, które mogłyby coś ujawnić) */
export function errorCode(err: unknown): string {
    return err instanceof AdminError ? err.code : "nieznany";
}

// ─── Diagnostyka (strona /api/upload/status) ─────────────────────────────────

export type AdminDiagnosis = {
    ok: boolean;
    store: string | null;
    method: "token" | "client_credentials" | null;
    shopName?: string;
    scopes?: string[];
    code?: string;
    detail?: string;
};

const DIAGNOSE = `
  query WallifyDiagnose {
    shop {
      name
      myshopifyDomain
    }
    currentAppInstallation {
      accessScopes {
        handle
      }
    }
  }
`;

export async function diagnoseAdmin(): Promise<AdminDiagnosis> {
    let store: string | null = null;
    try {
        store = new URL(adminBaseUrl()).hostname;
    } catch {
        /* zgłosimy niżej */
    }
    const method = env("SHOPIFY_ADMIN_ACCESS_TOKEN")
        ? "token"
        : env("SHOPIFY_ADMIN_CLIENT_ID") && env("SHOPIFY_ADMIN_CLIENT_SECRET")
            ? "client_credentials"
            : null;
    if (!method) return { ok: false, store, method, code: "brak_konfiguracji" };

    try {
        cachedToken = null; // zawsze świeży test
        const data = await adminGraphql<{
            shop: { name: string; myshopifyDomain: string };
            currentAppInstallation: { accessScopes: { handle: string }[] };
        }>(DIAGNOSE);
        const scopes = data.currentAppInstallation.accessScopes.map((s) => s.handle);
        const canWrite = scopes.includes("write_files");
        return {
            ok: canWrite,
            store,
            method,
            shopName: data.shop.name,
            scopes,
            code: canWrite ? undefined : "brak_write_files",
        };
    } catch (err) {
        return { ok: false, store, method, code: errorCode(err), detail: err instanceof Error ? err.message : String(err) };
    }
}

// ─── Shopify Files ───────────────────────────────────────────────────────────

export type StagedTarget = {
    url: string;
    resourceUrl: string;
    parameters: { name: string; value: string }[];
};

const STAGED_UPLOAD = `
  mutation WallifyStagedUpload($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function createStagedUpload(file: {
    filename: string;
    mimeType: string;
    fileSize: number;
}): Promise<StagedTarget> {
    const data = await adminGraphql<{
        stagedUploadsCreate: {
            stagedTargets: StagedTarget[];
            userErrors: { field: string[]; message: string }[];
        };
    }>(STAGED_UPLOAD, {
        input: [
            {
                resource: "IMAGE",
                filename: file.filename,
                mimeType: file.mimeType,
                httpMethod: "POST",
                fileSize: String(file.fileSize),
            },
        ],
    });
    const { stagedTargets, userErrors } = data.stagedUploadsCreate;
    if (userErrors.length) throw new AdminError("staged_upload", userErrors.map((e) => e.message).join(", "));
    if (!stagedTargets[0]) throw new AdminError("staged_upload", "Brak celu wysyłki");
    return stagedTargets[0];
}

/** Wysyła plik na staged target z serwera (używane awaryjnie, gdy przeglądarka nie może). */
export async function uploadToStagedTarget(target: StagedTarget, file: Blob, filename: string): Promise<void> {
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append("file", file, filename);
    const res = await fetch(target.url, { method: "POST", body: form });
    if (!res.ok) {
        throw new AdminError(`wysylka_http_${res.status}`, `Wysyłka do Shopify: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
}

const FILE_CREATE = `
  mutation WallifyFileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        ... on MediaImage {
          image {
            url
            width
            height
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const FILE_STATUS = `
  query WallifyFileStatus($id: ID!) {
    node(id: $id) {
      ... on MediaImage {
        id
        fileStatus
        fileErrors {
          message
        }
        image {
          url
          width
          height
        }
      }
    }
  }
`;

type MediaImageResult = {
    id: string;
    fileStatus: string;
    fileErrors?: { message: string }[];
    image?: { url: string; width: number; height: number } | null;
};

/**
 * Tworzy plik w Shopify Files z wysłanego wcześniej obrazu i czeka (do ok. 18 s),
 * aż Shopify go przetworzy i nada adres CDN. Bez adresu zgłasza błąd.
 */
export async function createFileFromStaged(resourceUrl: string, alt: string): Promise<{
    id: string;
    url: string;
    adminUrl: string;
}> {
    const data = await adminGraphql<{
        fileCreate: {
            files: MediaImageResult[];
            userErrors: { field: string[]; message: string; code: string }[];
        };
    }>(FILE_CREATE, {
        files: [{ originalSource: resourceUrl, contentType: "IMAGE", alt, duplicateResolutionMode: "APPEND_UUID" }],
    });
    const { files, userErrors } = data.fileCreate;
    if (userErrors.length) throw new AdminError("file_create", userErrors.map((e) => e.message).join(", "));
    const created = files[0];
    if (!created) throw new AdminError("file_create", "Shopify nie utworzył pliku");

    let url = created.image?.url ?? null;
    for (let i = 0; !url && i < 12; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const status = await adminGraphql<{ node: MediaImageResult | null }>(FILE_STATUS, { id: created.id });
        if (status.node?.fileStatus === "FAILED") {
            throw new AdminError("plik_odrzucony", `Shopify odrzucił plik: ${status.node.fileErrors?.map((e) => e.message).join(", ")}`);
        }
        url = status.node?.image?.url ?? null;
    }

    // Bez gotowego adresu nie mamy pewności, że plik w ogóle dotarł — klient spróbuje drugą drogą
    if (!url) throw new AdminError("plik_nieprzetworzony", "Shopify nie przetworzył pliku na czas");

    const numericId = created.id.split("/").pop();
    const storeHandle = new URL(adminBaseUrl()).hostname.replace(/\.myshopify\.com$/, "");
    return {
        id: created.id,
        url,
        adminUrl: `https://admin.shopify.com/store/${storeHandle}/content/files/${numericId}`,
    };
}

// ─── Bilet wysyłki ───────────────────────────────────────────────────────────
// /api/upload/start i /proxy podpisują adres pliku, a /finish przyjmuje tylko podpisane adresy.
// Dzięki temu nikt nie może kazać sklepowi zaimportować dowolnego obrazu z internetu.

function ticketKey(): string {
    const key = env("SHOPIFY_ADMIN_CLIENT_SECRET") || env("SHOPIFY_ADMIN_ACCESS_TOKEN");
    if (!key) throw new Error("Brak klucza do podpisu");
    return key;
}

export function signResourceUrl(resourceUrl: string): string {
    return createHmac("sha256", ticketKey()).update(`wallify-upload:${resourceUrl}`).digest("hex");
}

export function verifyResourceUrl(resourceUrl: string, ticket: string): boolean {
    const expected = Buffer.from(signResourceUrl(resourceUrl), "hex");
    const given = Buffer.from(String(ticket), "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
}

// ─── Produkty (bez kanału Headless) ──────────────────────────────────────────

const PRODUCT_QUERY = `
  query WallifyProduct($handle: String!, $after: String) {
    shop { currencyCode }
    productByIdentifier(identifier: { handle: $handle }) {
      id
      title
      status
      tags
      featuredMedia { preview { image { url } } }
      variants(first: 250, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          title
          availableForSale
          price
          selectedOptions { name value }
        }
      }
    }
  }
`;

type AdminProductData = {
    shop: { currencyCode: string };
    productByIdentifier: {
        id: string;
        title: string;
        status: string;
        tags: string[];
        featuredMedia: { preview: { image: { url: string } | null } | null } | null;
        variants: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: {
                id: string;
                title: string;
                availableForSale: boolean;
                price: string;
                selectedOptions: { name: string; value: string }[];
            }[];
        };
    } | null;
};

/**
 * Produkt przez Admin API (wymaga zakresu read_products w aplikacji Wallify).
 * Nie zależy od kanału sprzedaży Headless — widzi każdy aktywny produkt sklepu.
 * Zwraca surowe dane w kształcie RawProduct (mapowanie robi lib/product.ts).
 */
export async function getAdminProduct(handle: string) {
    const first = await adminGraphql<AdminProductData>(PRODUCT_QUERY, { handle });
    const p = first.productByIdentifier;
    if (!p || p.status !== "ACTIVE") return null;

    const currencyCode = first.shop.currencyCode;
    const nodes = [...p.variants.nodes];
    let page = p.variants.pageInfo;
    for (let i = 1; i < 8 && page.hasNextPage && page.endCursor; i++) {
        const next = await adminGraphql<AdminProductData>(PRODUCT_QUERY, { handle, after: page.endCursor });
        if (!next.productByIdentifier) break;
        nodes.push(...next.productByIdentifier.variants.nodes);
        page = next.productByIdentifier.variants.pageInfo;
    }

    return {
        id: p.id,
        title: p.title,
        tags: p.tags,
        imageUrl: p.featuredMedia?.preview?.image?.url ?? "/demo-canvas.jpg",
        variants: nodes.map((v) => ({
            id: v.id,
            title: v.title,
            availableForSale: v.availableForSale,
            price: { amount: v.price, currencyCode },
            selectedOptions: v.selectedOptions,
        })),
    };
}
