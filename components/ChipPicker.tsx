"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export type ChipItem = {
    id: string;
    label: string;
    /** Wyszarzony (np. kombinacja niedostępna), ale nadal klikalny */
    muted?: boolean;
    /** Pomarańczowa kropka — np. zbyt niska jakość druku dla tego rozmiaru */
    warn?: boolean;
};

interface ChipPickerProps {
    items: ChipItem[];
    selectedId: string;
    onChange: (id: string) => void;
    /** Etykieta dla czytników ekranu, np. "Rozmiar" */
    ariaLabel: string;
}

/**
 * Jeden rząd kapsułek przewijany w poziomie — nie zasłania ściany,
 * nawet gdy opcji jest dużo. Wybrana kapsułka jest przewijana do widoku.
 */
export default function ChipPicker({ items, selectedId, onChange, ariaLabel }: ChipPickerProps) {
    const scrollerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scroller = scrollerRef.current;
        const chip = scroller?.querySelector<HTMLElement>('[aria-checked="true"]');
        if (!scroller || !chip) return;
        // Ręczne przewinięcie tylko w poziomie — scrollIntoView przewijałby też stronę w iframe
        const s = scroller.getBoundingClientRect();
        const c = chip.getBoundingClientRect();
        const delta = c.left - s.left - (s.width - c.width) / 2;
        scroller.scrollBy({ left: delta, behavior: "smooth" });
    }, [selectedId]);

    return (
        <div
            ref={scrollerRef}
            role="radiogroup"
            aria-label={ariaLabel}
            className="overflow-x-auto no-scrollbar -mx-6 px-6"
        >
            <div className="relative flex gap-2 w-max mx-auto py-1">
                {items.map((item) => {
                    const isActive = item.id === selectedId;
                    return (
                        <motion.button
                            key={item.id}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            onClick={() => onChange(item.id)}
                            whileTap={{ scale: 0.93 }}
                            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap
                                border transition-colors duration-200
                                ${isActive
                                    ? "bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                                    : "bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/40"}
                                ${item.muted && !isActive ? "opacity-45 line-through decoration-white/50" : ""}`}
                        >
                            {item.warn && (
                                <span
                                    aria-label="niska jakość druku"
                                    className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 align-middle"
                                />
                            )}
                            {item.label}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
