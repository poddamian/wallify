"use client";

import { useCallback, useEffect, useState } from "react";
import { ArtworkError, loadCustomerArtwork } from "@/lib/photo";
import type { CustomerArtwork } from "@/types";

/** Zdjęcie klienta do druku — wspólne dla trybu na żywo i trybu ze zdjęcia ściany. */
export function useCustomerArtwork() {
    const [artwork, setArtwork] = useState<CustomerArtwork | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Zwalniamy pamięć po poprzednim podglądzie (tylko gdy zmienia się plik, nie kadr)
    const previewUrl = artwork?.previewUrl;
    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    const choose = useCallback(async (file: File | undefined) => {
        if (!file) return;
        setError(null);
        setLoading(true);
        try {
            const loaded = await loadCustomerArtwork(file);
            setArtwork({ file, ...loaded, focus: { x: 0.5, y: 0.5 } });
        } catch (err) {
            setError(err instanceof ArtworkError ? err.message : "Nie udało się wczytać zdjęcia.");
        } finally {
            setLoading(false);
        }
    }, []);

    const setFocus = useCallback((focus: { x: number; y: number }) => {
        setArtwork((a) => (a ? { ...a, focus } : a));
    }, []);

    return { artwork, choose, setFocus, loading, error };
}

export type CustomerArtworkState = ReturnType<typeof useCustomerArtwork>;
