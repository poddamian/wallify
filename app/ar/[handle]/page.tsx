import { notFound } from "next/navigation";
import { getProduct } from "@/lib/shopify";
import { isAdminConfigured } from "@/lib/shopify-admin";
import ARPageClient from "./ARPageClient";

interface ARPageProps {
    params: Promise<{ handle: string }>;
    searchParams: Promise<{ tryb?: string }>;
}

export default async function ARPage({ params, searchParams }: ARPageProps) {
    const { handle } = await params;
    const { tryb } = await searchParams;
    const product = await getProduct(handle);

    if (!product) {
        notFound();
    }

    return (
        <ARPageClient
            product={product}
            // /ar/<handle>?tryb=zdjecie — od razu tryb ze zdjęcia (np. osobny przycisk na stronie produktu)
            initialMode={tryb === "zdjecie" ? "photo" : "live"}
            // Ulepszenie AI pojawia się tylko, gdy w Vercel ustawiono GEMINI_API_KEY
            aiEnabled={Boolean(process.env.GEMINI_API_KEY)}
            // Zdjęcia klientów trafiają do Shopify Files, gdy skonfigurowano dostęp do Admin API
            uploadsEnabled={isAdminConfigured()}
        />
    );
}

// Metadane SEO na podstawie produktu (opcjonalnie)
export async function generateMetadata({ params }: ARPageProps) {
    const { handle } = await params;
    const product = await getProduct(handle);
    return {
        title: product ? `${product.title} — Podgląd AR | Wallify` : "Wallify AR",
    };
}
