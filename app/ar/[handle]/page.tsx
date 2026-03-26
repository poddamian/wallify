import { notFound } from "next/navigation";
import { getProduct } from "@/lib/shopify";
import ARPageClient from "./ARPageClient";

interface ARPageProps {
    params: Promise<{ handle: string }>;
}

export default async function ARPage({ params }: ARPageProps) {
    const { handle } = await params;
    const product = await getProduct(handle);

    if (!product) {
        notFound();
    }

    return <ARPageClient product={product} />;
}

// Metadane SEO na podstawie produktu (opcjonalnie)
export async function generateMetadata({ params }: ARPageProps) {
    const { handle } = await params;
    const product = await getProduct(handle);
    return {
        title: product ? `${product.title} — Podgląd AR | Wallify` : "Wallify AR",
    };
}
