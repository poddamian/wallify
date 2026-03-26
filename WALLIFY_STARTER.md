# WALLIFY – Next.js Starter Project Context
> Paste this file into Cursor / Windsurf as your project README or initial prompt context.

---

## 🎯 What We're Building

**Wallify** is an Augmented Reality (AR) web app embedded in a Shopify product page.  
It lets customers **point their phone camera at a wall** and see exactly how a canvas print will look — in real size, in real time — before buying.

**Core user flow:**
1. Customer lands on a Shopify product page (canvas print)
2. Clicks "Try on your wall" → Wallify launches
3. Browser asks for camera permission → customer grants it
4. Live camera feed fills the screen
5. Customer points phone at a wall and slowly pans across it
6. The selected canvas print appears overlaid on the wall via AR
7. Customer can switch sizes (e.g. 40×40, 60×60, 80×100 cm) → canvas updates live
8. Customer hits "Add to cart" directly from the AR view

---

## 🗂️ Recommended Project Structure

```
wallify/
├── app/                          # Next.js 14 App Router
│   ├── layout.tsx                # Root layout, fonts, global styles
│   ├── page.tsx                  # Landing / demo page
│   └── ar/
│       └── page.tsx              # Main AR viewer page
│
├── components/
│   ├── ARViewer.tsx              # Core component: camera + canvas overlay
│   ├── CameraFeed.tsx            # Handles getUserMedia, permission states
│   ├── CanvasOverlay.tsx         # Renders the product image on the wall
│   ├── SizePicker.tsx            # UI: choose canvas size (40x40, 60x80, etc.)
│   ├── PermissionScreen.tsx      # "Allow camera" prompt UI
│   └── AddToCartButton.tsx       # Shopify Buy SDK integration
│
├── hooks/
│   ├── useCamera.ts              # Hook: manage camera stream + permissions
│   ├── useDeviceOrientation.ts   # Hook: gyroscope for wall detection
│   └── useAROverlay.ts           # Hook: calculate overlay position/size
│
├── lib/
│   ├── shopify.ts                # Shopify Storefront API client
│   └── ar-utils.ts               # Math helpers (scale, position, depth)
│
├── public/
│   └── demo-canvas.jpg           # Placeholder product image for testing
│
└── types/
    └── index.ts                  # Shared TypeScript types
```

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Camera API | `navigator.mediaDevices.getUserMedia` |
| AR Overlay | Canvas API or CSS transform overlay |
| Motion | Framer Motion |
| Shopify | Shopify Storefront API + Buy SDK |
| Deployment | Vercel |

---

## 📦 Initial Dependencies

```bash
npx create-next-app@latest wallify --typescript --tailwind --app
cd wallify
npm install framer-motion
npm install @shopify/buy-button-js
npm install lucide-react
```

---

## 🔑 Key Types (`types/index.ts`)

```typescript
export type CanvasSize = {
  id: string;
  label: string;       // e.g. "60 × 80 cm"
  widthCm: number;
  heightCm: number;
};

export type ARState =
  | "idle"             // App not started
  | "requesting"       // Asking for camera permission
  | "denied"           // Permission denied
  | "scanning"         // Camera active, looking for wall
  | "placed"           // Canvas placed on wall
  | "error";           // Something went wrong

export type Product = {
  id: string;
  title: string;
  imageUrl: string;
  availableSizes: CanvasSize[];
  shopifyVariantId: string;
};
```

---

## 🎬 Core Component: `ARViewer.tsx`

```tsx
"use client";

import { useState } from "react";
import CameraFeed from "./CameraFeed";
import CanvasOverlay from "./CanvasOverlay";
import SizePicker from "./SizePicker";
import PermissionScreen from "./PermissionScreen";
import { ARState, CanvasSize, Product } from "@/types";

const SIZES: CanvasSize[] = [
  { id: "s1", label: "40 × 40 cm", widthCm: 40, heightCm: 40 },
  { id: "s2", label: "60 × 80 cm", widthCm: 60, heightCm: 80 },
  { id: "s3", label: "80 × 100 cm", widthCm: 80, heightCm: 100 },
  { id: "s4", label: "100 × 120 cm", widthCm: 100, heightCm: 120 },
];

export default function ARViewer({ product }: { product: Product }) {
  const [arState, setArState] = useState<ARState>("idle");
  const [selectedSize, setSelectedSize] = useState<CanvasSize>(SIZES[1]);

  const handleStart = () => setArState("requesting");
  const handlePermissionGranted = () => setArState("scanning");
  const handlePermissionDenied = () => setArState("denied");

  // IDLE STATE – entry point
  if (arState === "idle") {
    return (
      <div className="flex flex-col items-center gap-6 p-8">
        <h2 className="text-2xl font-bold text-center">
          See it on your wall before you buy
        </h2>
        <p className="text-gray-500 text-center max-w-xs">
          Point your camera at any wall and instantly preview how this
          canvas print will look in your space.
        </p>
        <button
          onClick={handleStart}
          className="bg-black text-white px-8 py-4 rounded-full text-lg font-medium
                     hover:bg-gray-800 transition-all active:scale-95"
        >
          Try on your wall →
        </button>
      </div>
    );
  }

  // PERMISSION REQUEST
  if (arState === "requesting") {
    return (
      <PermissionScreen
        onGranted={handlePermissionGranted}
        onDenied={handlePermissionDenied}
      />
    );
  }

  // DENIED STATE
  if (arState === "denied") {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 font-medium">Camera access was denied.</p>
        <p className="text-gray-500 mt-2 text-sm">
          Please allow camera access in your browser settings and try again.
        </p>
        <button
          onClick={() => setArState("idle")}
          className="mt-4 underline text-sm text-gray-600"
        >
          Go back
        </button>
      </div>
    );
  }

  // ACTIVE AR VIEW
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">

      {/* Live camera feed */}
      <CameraFeed className="absolute inset-0 w-full h-full object-cover" />

      {/* Canvas product overlay */}
      <CanvasOverlay
        imageUrl={product.imageUrl}
        size={selectedSize}
      />

      {/* UI Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <SizePicker
          sizes={SIZES}
          selected={selectedSize}
          onChange={setSelectedSize}
        />
        <button className="w-full mt-4 bg-white text-black py-4 rounded-full font-bold text-lg">
          Add to cart – {selectedSize.label}
        </button>
      </div>

    </div>
  );
}
```

---

## 📷 Camera Hook: `hooks/useCamera.ts`

```typescript
"use client";

import { useEffect, useRef, useState } from "react";

type CameraStatus = "idle" | "loading" | "active" | "denied" | "error";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");

  const startCamera = async () => {
    setStatus("loading");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // rear camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStatus("active");
      }
    } catch (err) {
      const error = err as DOMException;
      if (error.name === "NotAllowedError") {
        setStatus("denied");
      } else {
        setStatus("error");
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      setStatus("idle");
    }
  };

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), []);

  return { videoRef, status, startCamera, stopCamera };
}
```

---

## 🖼️ Canvas Overlay: `components/CanvasOverlay.tsx`

```tsx
"use client";

import { CanvasSize } from "@/types";

// Assumes average viewing distance = ~2.5 meters
// Average screen DPI ~160 → 1cm ≈ 6.3px at arm's length
// This is a simplified version; production uses device sensors + distance estimation

const CM_TO_PX_RATIO = 5.8; // tunable constant

export default function CanvasOverlay({
  imageUrl,
  size,
}: {
  imageUrl: string;
  size: CanvasSize;
}) {
  const widthPx = size.widthCm * CM_TO_PX_RATIO;
  const heightPx = size.heightCm * CM_TO_PX_RATIO;

  return (
    <div
      className="absolute"
      style={{
        // Centered on screen
        left: "50%",
        top: "40%",
        transform: "translate(-50%, -50%)",
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        border: "2px solid rgba(255,255,255,0.3)",
        borderRadius: "2px",
        transition: "width 0.3s ease, height 0.3s ease",
      }}
    >
      {/* Product image */}
      <img
        src={imageUrl}
        alt="Canvas preview"
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Size label badge */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2
                      bg-white/90 text-black text-xs font-bold
                      px-3 py-1 rounded-full whitespace-nowrap">
        {size.label}
      </div>
    </div>
  );
}
```

---

## 📋 Cursor / Windsurf Prompt to Get Started

Copy-paste this as your **first message** to the AI:

```
I'm building Wallify — an AR web app for a Shopify store that lets customers 
preview canvas prints on their wall using their phone camera.

Tech stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion.

Core flow:
1. Customer clicks "Try on your wall" on a Shopify product page
2. Browser requests camera permission (rear camera)
3. Live camera feed fills the screen
4. Selected canvas product image overlays on the wall in real scale
5. Customer picks a size (40×40, 60×80, 80×100, 100×120 cm)
6. Overlay updates live to reflect chosen size
7. "Add to cart" button is shown in the AR view

Please scaffold the project using the structure I have in WALLIFY_STARTER.md.
Start with:
- app/page.tsx (demo landing page)
- components/ARViewer.tsx (main AR component)
- hooks/useCamera.ts (camera permission + stream)
- components/CanvasOverlay.tsx (product image overlay with size scaling)
- components/SizePicker.tsx (size selector UI)

Use the useCamera hook to manage the camera stream.
For the overlay, position it centered on screen with CSS transforms.
Scale the overlay dimensions based on cm-to-pixel ratio (tunable constant).
Keep the UI minimal, dark, and premium — black backgrounds, white text.
```

---

## 🚀 Next Steps (after scaffolding)

1. **Wall detection** – Use `deviceorientation` API to detect when phone is pointing at a wall (near-vertical tilt)
2. **Distance estimation** – Use phone sensors or manual slider to estimate distance to wall for accurate scaling  
3. **Drag to reposition** – Let user drag the canvas overlay to different spots on the wall
4. **Shopify integration** – Connect Storefront API to load real product data and variants
5. **Multi-image support** – Let customer browse all available prints in AR view
6. **Screenshot feature** – Let customer save/share a photo of the preview

---

*Wallify – See it before you buy it.*
