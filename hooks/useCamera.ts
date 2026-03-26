"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { CameraStatus } from "@/types";

export function useCamera() {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [status, setStatus] = useState<CameraStatus>("idle");
    const [error, setError] = useState<string | null>(null);

    // Callback ref: Odpala się natychmiast, gdy React stworzy element <video>.
    // To eliminuje problem iOS Safari, który blokuje stream w asynchronicznym useEffect.
    const attachVideo = useCallback((node: HTMLVideoElement | null) => {
        videoRef.current = node;
        if (node && status === "active" && streamRef.current) {
            node.srcObject = streamRef.current;
            // Wmuszamy na sztywno flagi, które iOS często ignoruje, jeśli ustawi się je z JSX
            node.setAttribute("playsinline", "true");
            node.muted = true;
            node.autoplay = true;
            
            node.play().catch((err) => {
                console.warn("[Camera] Autoplay zablokowany przez przeglądarkę:", err);
            });
        }
    }, [status]);

    const startCamera = useCallback(async () => {
        setStatus("loading");
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" }, // rear camera on mobile
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            });

            streamRef.current = stream;
            // Set status to "active" immediately — the <video> element doesn't exist
            // in the DOM yet (ARViewer renders it only in the active AR view), so we
            // cannot touch videoRef here. The useEffect above will attach the stream
            // after React re-renders and mounts the <video> element.
            setStatus("active");
        } catch (err) {
            const domError = err as DOMException;
            if (
                domError.name === "NotAllowedError" ||
                domError.name === "PermissionDeniedError"
            ) {
                setStatus("denied");
                setError("Camera access was denied. Please allow camera access in your browser settings.");
            } else if (domError.name === "NotFoundError") {
                setStatus("error");
                setError("No camera found on this device.");
            } else {
                setStatus("error");
                setError("An unexpected error occurred while accessing the camera.");
            }
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setStatus("idle");
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    return {
        attachVideo,
        status,
        error,
        startCamera,
        stopCamera,
        isActive: status === "active",
        isLoading: status === "loading",
        isDenied: status === "denied",
    };
}
