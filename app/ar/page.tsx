import DemoClient from "./DemoClient";
import { isAdminConfigured } from "@/lib/shopify-admin";

/**
 * /ar — demo bez sklepu (produkt testowy). Prawdziwe produkty: /ar/<handle>
 * /ar?demo=zdjecie — demo obrazu z własnego zdjęcia klienta
 */
export default async function ARDemoPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
    const { demo } = await searchParams;
    return (
        <DemoClient
            aiEnabled={Boolean(process.env.GEMINI_API_KEY)}
            personalized={demo === "zdjecie"}
            uploadsEnabled={isAdminConfigured()}
        />
    );
}
