"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { useCamera } from "@/hooks/useCamera";

interface PermissionScreenProps {
    onGranted: () => void;
    onDenied: () => void;
}

export default function PermissionScreen({
    onGranted,
    onDenied,
}: PermissionScreenProps) {
    const { status, startCamera } = useCamera();

    useEffect(() => {
        startCamera();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (status === "active") onGranted();
        if (status === "denied" || status === "error") onDenied();
    }, [status, onGranted, onDenied]);

    return (
        <div className="flex flex-col items-center justify-center h-screen gap-8 bg-black px-8 text-center">
            <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
                className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center border border-white/20"
            >
                <Camera className="w-10 h-10 text-white" />
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3"
            >
                <h2 className="text-2xl font-bold text-white">Potrzebny dostęp do kamery</h2>
                <p className="text-white/60 max-w-xs leading-relaxed text-sm">
                    Wallify potrzebuje dostępu do kamery, aby na żywo wyświetlić obraz
                    na Twojej ścianie. Obraz z kamery nie opuszcza Twojego urządzenia.
                </p>
            </motion.div>

            {status === "loading" && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-white/50 text-sm"
                >
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Prośba o dostęp…
                </motion.div>
            )}
        </div>
    );
}
