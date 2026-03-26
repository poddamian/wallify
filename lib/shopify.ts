/**
 * lib/shopify.ts
 * Klient Shopify Storefront API (GraphQL) + podstawowe operacje.
 * Nie wymaga żadnych zewnętrznych bibliotek — używa natywnego fetch.
 */

import type { CanvasSize, Product } from "@/types";

// ─── Config ──────────────────────────────────────────────────────────────────

const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN!;
const TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN!;
const API_VERSION = "2024-10";
const ENDPOINT = `https://${DOMAIN}/api/${API_VERSION}/graphql.json`;

// ─── Base fetch ───────────────────────────────────────────────────────────────

async function shopifyFetch<T>(
    query: string,
    variables: Record<string, unknown> = {}
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (TOKEN && TOKEN !== "tu_wklej_token_z_kroku_3") {
        headers["X-Shopify-Storefront-Access-Token"] = TOKEN;
    }

    const res = await fetch(ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, variables }),
        next: { revalidate: 60 }, // ISR — odśwież co 60s po stronie serwera
    });

    if (!res.ok) {
        throw new Error(`Shopify fetch error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    if (json.errors?.length) {
        throw new Error(
            `Shopify GraphQL error: ${json.errors.map((e: { message: string }) => e.message).join(", ")}`
        );
    }

    return json.data as T;
}

// ─── Product ──────────────────────────────────────────────────────────────────

const PRODUCT_QUERY = `
  query GetProduct($handle: String!) {
    product(handle: $handle) {
      id
      title
      featuredImage {
        url
      }
      variants(first: 20) {
        edges {
          node {
            id
            title
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
  }
`;

interface ShopifyProductData {
    product: {
        id: string;
        title: string;
        featuredImage: { url: string } | null;
        variants: {
            edges: {
                node: {
                    id: string;
                    title: string;
                    selectedOptions: { name: string; value: string }[];
                };
            }[];
        };
    } | null;
}

/**
 * Parsuje wartość rozmiaru wariantu (np. "70x50 cm" lub "70 × 50 cm")
 * i zwraca { widthCm, heightCm } lub null jeśli nie można sparsować.
 */
function parseSize(value: string): { widthCm: number; heightCm: number } | null {
    // Obsługuje formaty: "70x50 cm", "70X50cm", "70 × 50 cm", "70×50"
    const match = value.replace(/\s/g, "").match(/^(\d+)[xX×](\d+)/);
    if (!match) return null;
    return { widthCm: Number(match[1]), heightCm: Number(match[2]) };
}

/**
 * Pobiera produkt Shopify po handle (slug URL) i mapuje go na typ Product.
 * Warianty z opcją zawierającą "rozmiar"/"size" są mapowane na CanvasSize[].
 */
export async function getProduct(handle: string): Promise<Product | null> {
    const data = await shopifyFetch<ShopifyProductData>(PRODUCT_QUERY, { handle });

    if (!data.product) return null;

    const { id, title, featuredImage, variants } = data.product;

    // Mapuj warianty Shopify → CanvasSize
    // Szukamy opcji, której nazwa zawiera "rozmiar" lub "size" (case-insensitive)
    const availableSizes: CanvasSize[] = variants.edges
        .map(({ node }) => {
            const sizeOption = node.selectedOptions.find((opt) =>
                /rozmiar|size/i.test(opt.name)
            );
            if (!sizeOption) return null;

            const dims = parseSize(sizeOption.value);
            if (!dims) return null;

            return {
                id: node.id, // GID Shopify, np. "gid://shopify/ProductVariant/123"
                label: `${dims.widthCm} × ${dims.heightCm} cm`,
                widthCm: dims.widthCm,
                heightCm: dims.heightCm,
                shopifyVariantId: node.id,
            } satisfies CanvasSize & { shopifyVariantId: string };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

    // Fallback: jeśli produkt nie ma opcji rozmiaru, utwórz jeden wariant z pełnym tytułem
    if (availableSizes.length === 0) {
        const firstVariant = variants.edges[0]?.node;
        if (firstVariant) {
            availableSizes.push({
                id: firstVariant.id,
                label: firstVariant.title,
                widthCm: 70,
                heightCm: 50,
                shopifyVariantId: firstVariant.id,
            } as CanvasSize & { shopifyVariantId: string });
        }
    }

    return {
        id,
        title,
        imageUrl: featuredImage?.url ?? "/demo-canvas.jpg",
        availableSizes,
        shopifyVariantId: availableSizes[0]?.id ?? "",
    };
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

const CREATE_CART_MUTATION = `
  mutation CreateCart {
    cartCreate {
      cart {
        id
        checkoutUrl
      }
    }
  }
`;

interface CreateCartData {
    cartCreate: {
        cart: {
            id: string;
            checkoutUrl: string;
        };
    };
}

/** Tworzy nowy koszyk i zwraca { cartId, checkoutUrl }. */
export async function createCart(): Promise<{ cartId: string; checkoutUrl: string }> {
    const data = await shopifyFetch<CreateCartData>(CREATE_CART_MUTATION);
    return {
        cartId: data.cartCreate.cart.id,
        checkoutUrl: data.cartCreate.cart.checkoutUrl,
    };
}

const ADD_TO_CART_MUTATION = `
  mutation AddToCart($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface AddToCartData {
    cartLinesAdd: {
        cart: { id: string; checkoutUrl: string };
        userErrors: { field: string; message: string }[];
    };
}

/** Dodaje wariant do koszyka. Zwraca aktualny checkoutUrl. */
export async function addToCart(
    cartId: string,
    merchandiseId: string,
    quantity = 1
): Promise<string> {
    const data = await shopifyFetch<AddToCartData>(ADD_TO_CART_MUTATION, {
        cartId,
        lines: [{ merchandiseId, quantity }],
    });

    if (data.cartLinesAdd.userErrors.length > 0) {
        throw new Error(data.cartLinesAdd.userErrors.map((e) => e.message).join(", "));
    }

    return data.cartLinesAdd.cart.checkoutUrl;
}
