/**
 * lib/shopify.ts
 * Klient Shopify Storefront API (GraphQL) + podstawowe operacje.
 * Nie wymaga żadnych zewnętrznych bibliotek — używa natywnego fetch.
 */

import type { Product } from "@/types";
import { buildProduct, type RawVariant } from "@/lib/product";

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

// ─── Product ─────────────────────────────────────────────────────────────────

const PRODUCT_QUERY = `
  query GetProduct($handle: String!) {
    product(handle: $handle) {
      id
      title
      featuredImage {
        url
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            availableForSale
            price {
              amount
              currencyCode
            }
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
            edges: { node: RawVariant }[];
        };
    } | null;
}

/**
 * Pobiera produkt Shopify po handle (slug URL) i mapuje go na typ Product:
 * unikalne rozmiary, pozostałe opcje (np. Materiał) i warianty z prawdziwymi ID.
 */
export async function getProduct(handle: string): Promise<Product | null> {
    const data = await shopifyFetch<ShopifyProductData>(PRODUCT_QUERY, { handle });

    if (!data.product) return null;

    const { id, title, featuredImage, variants } = data.product;

    return buildProduct({
        id,
        title,
        imageUrl: featuredImage?.url ?? "/demo-canvas.jpg",
        variants: variants.edges.map(({ node }) => node),
    });
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

export type CartLineAttribute = { key: string; value: string };

/**
 * Dodaje wariant do koszyka. Zwraca aktualny checkoutUrl.
 * Atrybuty z kluczem zaczynającym się od "_" są ukryte dla klienta,
 * ale widać je w zamówieniu w panelu Shopify.
 */
export async function addToCart(
    cartId: string,
    merchandiseId: string,
    quantity = 1,
    attributes: CartLineAttribute[] = []
): Promise<string> {
    const data = await shopifyFetch<AddToCartData>(ADD_TO_CART_MUTATION, {
        cartId,
        lines: [{ merchandiseId, quantity, attributes }],
    });

    if (data.cartLinesAdd.userErrors.length > 0) {
        throw new Error(data.cartLinesAdd.userErrors.map((e) => e.message).join(", "));
    }

    return data.cartLinesAdd.cart.checkoutUrl;
}
