"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";

/**
 * Potwierdzenie po wysłaniu zdjęcia: klient sam przechodzi do kasy (link target="_top"),
 * bo po dłuższej wysyłce przeglądarka mogłaby zablokować automatyczne przejście z ramki.
 */
export default function CheckoutReady({ url, onClose }: { url: string; onClose: () => void }) {
    return (
        <motion.div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            role="dialog"
            aria-modal="true"
            aria-label="Zdjęcie dodane do koszyka"
        >
            <motion.div
                className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-white/10 p-6 text-center space-y-4"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
            >
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <div className="space-y-1">
                    <p className="text-lg font-bold text-white">Gotowe — zdjęcie jest w koszyku</p>
                    <p className="text-sm text-white/60">Nie musisz niczego wysyłać mailem — dołączymy je do zamówienia.</p>
                </div>
                <a
                    href={url}
                    target="_top"
                    className="flex items-center justify-center gap-2 w-full bg-white text-black font-bold py-4 rounded-full"
                >
                    Przejdź do kasy <ArrowRight className="w-5 h-5" />
                </a>
                <button type="button" onClick={onClose} className="text-sm text-white/50 hover:text-white">
                    Zostań tutaj
                </button>
            </motion.div>
        </motion.div>
    );
}
