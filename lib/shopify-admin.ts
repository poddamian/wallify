/**
 * lib/shopify-admin.ts — TYLKO po stronie serwera (API routes).
 * Dostęp do Admin API sklepu, potrzebny do zapisu zdjęć klientów w Shopify Files.
 *
 * Dwa sposoby uwierzytelnienia (wystarczy jeden):
 * 1) Aplikacja z Dev Dashboard: SHOPIFY_ADMIN_CLIENT_ID + SHOPIFY_ADMIN_CLIENT_SECRET
 *    — token pobierany automatycznie (client credentials) i odświeżany co ok. 24 h.
 * 2) Stała aplikacja (starszy typ, utworzona w panelu przed 2026): SHOPIFY_ADMIN_ACCESS_TOKEN.
 *
 * Adres sklepu: SHOPIFY_ADMIN_URL (np. https://twojsklep.myshopify.com), a gdy go brak —
 * https:// + NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const API_VERSION = "2026-07";

export function adminBaseUrl(): string {
    const explicit = process.env.SHOPIFY_ADMIN_URL?.replace(/\/+$/, "");
    if (explicit) return explicit;
    const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
    if (!domain) throw new Error("Brak SHOPIFY_ADMIN_URL i NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN");
    return `https://${domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
}

export function isAdminConfigured(): boolean {
    return Boolean(
        process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ||
        (process.env.SHOPIFY_ADMIN_CLIENT_ID && process.env.SHOPIFY_ADMIN_CLIENT_SECRET)
    );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
    const staticToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    if (staticToken) return staticToken;

    if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60_000) return cachedToken.value;

    const clientId = process.env.SHOPIFY_ADMIN_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Brak danych dostępu do Admin API");

    const res = await fetch(`${adminBaseUrl()}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
        }),
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error(`Nie udało się pobrać tokenu Admin API: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { access_token: string; expires_in?: number };
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
    if (!res.ok) throw new Error(`Admin API HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) throw new Error(`Admin API: ${json.errors.map((e) => e.message).join(", ")}`);
    if (!json.data) throw new Error("Admin API: pusta odpowiedź");
    return json.data;
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
    if (userErrors.length) throw new Error(userErrors.map((e) => e.message).join(", "));
    if (!stagedTargets[0]) throw new Error("Brak celu wysyłki");
    return stagedTargets[0];
}

/** Wysyła plik na staged target z serwera (używane awaryjnie, gdy przeglądarka nie może). */
export async function uploadToStagedTarget(target: StagedTarget, file: Blob, filename: string): Promise<void> {
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append("file", file, filename);
    const res = await fetch(target.url, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Wysyłka do Shopify: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
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
    if (userErrors.length) throw new Error(userErrors.map((e) => e.message).join(", "));
    const created = files[0];
    if (!created) throw new Error("Shopify nie utworzył pliku");

    let url = created.image?.url ?? null;
    for (let i = 0; !url && i < 12; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const status = await adminGraphql<{ node: MediaImageResult | null }>(FILE_STATUS, { id: created.id });
        if (status.node?.fileStatus === "FAILED") {
            throw new Error(`Shopify odrzucił plik: ${status.node.fileErrors?.map((e) => e.message).join(", ")}`);
        }
        url = status.node?.image?.url ?? null;
    }

    // Bez gotowego adresu nie mamy pewności, że plik w ogóle dotarł — klient spróbuje drugą drogą
    if (!url) throw new Error("Shopify nie przetworzył pliku na czas");

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
    const key = process.env.SHOPIFY_ADMIN_CLIENT_SECRET || process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
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
