"use client";

import { useEffect } from "react";

export default function Unavailable() {
    useEffect(() => {
        if (window.parent !== window) {
            try {
                window.parent.postMessage({ type: "wallify:unavailable" }, "*");
            } catch {
                /* ignorujemy */
            }
        }
    }, []);

    return (
        <main className="min-h-dvh flex items-center justify-center bg-black text-white/40 text-sm p-6 text-center">
            Podgląd na ścianie nie jest dostępny dla tego produktu.
        </main>
    );
}
