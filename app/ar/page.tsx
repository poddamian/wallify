import DemoClient from "./DemoClient";

/** /ar — demo bez sklepu (produkt testowy). Prawdziwe produkty: /ar/<handle> */
export default function ARDemoPage() {
    return <DemoClient aiEnabled={Boolean(process.env.GEMINI_API_KEY)} />;
}
