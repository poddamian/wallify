import Unavailable from "./Unavailable";

/**
 * Produktu nie ma (albo nie jest dostępny w kanale „Artavia Headless").
 * Zamiast strony 404 w ramce — prośba do sklepu o schowanie ramki (snippets/wallify-bridge.liquid).
 */
export default function NotFound() {
    return <Unavailable />;
}
