"use client";

import { useEffect, useRef } from "react";

interface CameraFeedProps {
    stream: MediaStream | null;
    className?: string;
}

export default function CameraFeed({ stream, className }: CameraFeedProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {
                // Autoplay may be blocked; user gesture will trigger it
            });
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={className}
        />
    );
}
