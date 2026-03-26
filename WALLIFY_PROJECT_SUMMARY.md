# Wallify — Podsumowanie Projektu

## Co zostało zbudowane

**Wallify** to aplikacja AR (rzeczywistość rozszerzona) osadzona na stronie produktu Shopify. Pozwala klientom podejrzeć, jak obraz na płótnie będzie wyglądał na ich ścianie — w czasie rzeczywistym, przez kamerę telefonu, bez instalowania żadnej aplikacji.

---

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Język | TypeScript |
| Style | Tailwind CSS v4 |
| Animacje | Framer Motion |
| Kamera | `navigator.mediaDevices.getUserMedia` |
| Ikony | Lucide React |
| Deployment | Vercel (gotowy) |

---

## Struktura plików

```
wallify/
├── app/
│   ├── layout.tsx             # Root layout — Inter, meta PL, dark theme
│   ├── globals.css            # Globalne style, dark theme, Inter font
│   ├── page.tsx               # Strona główna / landing page (PL)
│   └── ar/
│       └── page.tsx           # Strona widoku AR z demo produktem
│
├── components/
│   ├── ARViewer.tsx           # ⭐ Główny komponent — maszyna stanów AR
│   ├── CameraFeed.tsx         # Renderowanie <video> z MediaStream
│   ├── CanvasOverlay.tsx      # Nakładka produktu z animacją Framer Motion
│   ├── SizePicker.tsx         # Wybór rozmiaru — kapsułki z aktywnym podświetleniem
│   ├── PermissionScreen.tsx   # Ekran prośby o dostęp do kamery
│   └── AddToCartButton.tsx    # Przycisk CTA „Dodaj do koszyka"
│
├── hooks/
│   └── useCamera.ts           # Hook — zarządzanie strumieniem kamery i uprawnieniami
│
├── lib/
│   └── ar-utils.ts            # Matematyka AR — przelicznik cm → px (stała CM_TO_PX_RATIO)
│
├── types/
│   └── index.ts               # Typy TS: CanvasSize, ARState, Product, CameraStatus
│
├── public/
│   └── demo-canvas.jpg        # Demo obraz — las o świcie (wygenerowany AI)
│
└── next.config.ts             # Dozwolone domeny obrazów (Shopify CDN)
```

---

## Główne funkcjonalności

### 🎬 Maszyna stanów AR (`ARViewer.tsx`)
Pięć stanów zarządzanych przez `useState`:
- **`idle`** — ekran startowy z przyciskiem „Przymierz na ścianie"
- **`requesting`** — prośba o dostęp do kamery z animacją ładowania
- **`scanning`** — pełnoekranowy obraz z kamery + nakładka produktu
- **`denied`** — informacja o braku dostępu + przycisk ponów próbę
- **`error`** — obsługa błędów urządzenia

### 📷 Hook kamery (`useCamera.ts`)
- Żąda tylnej kamery (`facingMode: environment`)
- Obsługuje `NotAllowedError`, `NotFoundError` i inne błędy DOMException
- Czyści strumień przy odmontowaniu komponentu
- Eksportuje: `videoRef`, `status`, `error`, `startCamera`, `stopCamera`

### 🖼️ Nakładka AR (`CanvasOverlay.tsx`)
- Przelicza wymiary produktu z cm na piksele (`CM_TO_PX_RATIO = 5.8`)
- Wyśrodkowana na ekranie przez CSS transform
- Płynne animacje zmiany rozmiaru (Framer Motion `AnimatePresence`)
- Etykieta z wybranym rozmiarem pod obrazem

### 📐 Dostępne rozmiary (poziome)
| Rozmiar | Szerokość | Wysokość |
|---|---|---|
| 30 × 20 cm | 30 cm | 20 cm |
| 40 × 30 cm | 40 cm | 30 cm |
| 70 × 50 cm | 70 cm | 50 cm |
| 90 × 60 cm | 90 cm | 60 cm |
| 100 × 70 cm | 100 cm | 70 cm |
| 120 × 80 cm | 120 cm | 80 cm |

### 🎨 Design
- Całkowicie ciemny interfejs (czarne tło, białe elementy)
- Font: Inter (Google Fonts)
- Glassmorphism — frosted glass badges
- Micro-animacje: spring physics, stagger children, whileTap
- Responsywny: zaprojektowany mobile-first

---

## Jak uruchomić

```bash
cd wallify
npm install
npm run dev
# → http://localhost:3000
```

**Demo AR:** http://localhost:3000/ar

---

## Następne kroki (TODO)

| Priorytet | Funkcja |
|---|---|
| 🔴 Wysoki | Integracja Shopify Storefront API — prawdziwe dane produktu |
| 🔴 Wysoki | Shopify Buy SDK — faktyczne dodawanie do koszyka |
| 🟡 Średni | Przeciąganie nakładki — `useDrag` (Framer Motion) |
| 🟡 Średni | Suwak odległości — dokładna skala w zależności od dystansu do ściany |
| 🟢 Niski | Wykrywanie orientacji telefonu (`deviceorientation` API) |
| 🟢 Niski | Zrzut ekranu — funkcja zapisu podglądu AR |
| 🟢 Niski | Obsługa wielu produktów — przeglądanie w widoku AR |

---

## Integracja Shopify (szkielet)

W `app/ar/page.tsx` znajdziesz stub `handleAddToCart`:

```typescript
const handleAddToCart = (size: CanvasSize) => {
  // TODO: Shopify Buy SDK
  await shopifyClient.checkout.addLineItems(checkoutId, [{
    variantId: product.shopifyVariantId,
    quantity: 1,
    customAttributes: [{ key: 'rozmiar', value: size.label }]
  }]);
};
```

Dane produktu ładuj z `lib/shopify.ts` przez Storefront API.

---

*Wallify — Sprawdź zanim kupisz.*
