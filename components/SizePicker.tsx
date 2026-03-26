"use client";

import { motion } from "framer-motion";
import type { CanvasSize } from "@/types";

interface SizePickerProps {
    sizes: CanvasSize[];
    selected: CanvasSize;
    onChange: (size: CanvasSize) => void;
}

/**
 * SizePicker
 *
 * A horizontal pill-style selector for canvas sizes.
 * The active size glows white; inactive sizes are translucent.
 */
export default function SizePicker({
    sizes,
    selected,
    onChange,
}: SizePickerProps) {
    return (
        <div className="flex items-center justify-center gap-2 flex-wrap">
            {sizes.map((size) => {
                const isActive = size.id === selected.id;
                return (
                    <motion.button
                        key={size.id}
                        onClick={() => onChange(size)}
                        whileTap={{ scale: 0.93 }}
                        className={`
              px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200
              border
              ${isActive
                                ? "bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                                : "bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/40"
                            }
            `}
                    >
                        {size.label}
                    </motion.button>
                );
            })}
        </div>
    );
}
