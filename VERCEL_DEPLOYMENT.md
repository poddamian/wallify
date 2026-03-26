# Jak Wdrożyć Wallify na Vercel

Aplikacja jest w pełni gotowa do uruchomienia na produkcji. Ponieważ korzysta z frameworka Next.js, najlepiej i najprościej wdrożyć ją na platformie Vercel (twórców Next.js).

Oto kroki krok po kroku:

### Krok 1: Wypchnij kod na GitHub
Jeśli jeszcze tego nie zrobiłeś, musisz zapisać kod na swoim koncie GitHub.
1. Utwórz nowe repozytorium na [GitHubie](https://github.com/new).
2. W terminalu w folderze projektu wykonaj:
   ```bash
   git add .
   git commit -m "Gotowa wersja Wallify z integracją Shopify i AR"
   git branch -M main
   git remote add origin https://github.com/TWOJA-NAZWA/wallify.git
   git push -u origin main
   ```

### Krok 2: Import projektu w Vercel
1. Zaloguj się na [Vercel.com](https://vercel.com) (najlepiej kontem GitHub).
2. Kliknij **Add New...** -> **Project**.
3. Przy repozytorium Wallify kliknij **Import**.
4. W sekcji "Framework Preset" Vercel automatycznie wykryje **Next.js**.

### Krok 3: Dodanie Zmiennych Środowiskowych (KRYTYCZNE)
Zanim klikniesz "Deploy", musisz rozwinąć sekcję **Environment Variables** i dodać dwie zmienne z pliku `.env.local`:

1.  **Name:** `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`
    **Value:** (np. `twojsklep.myshopify.com` — bez https)
    Kliknij **Add**.

2.  **Name:** `NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN`
    **Value:** (Twój token z kanału Headless, np. `shpat_123456789...`)
    Kliknij **Add**.

### Krok 4: Deploy
Kliknij przycisk **Deploy**. Vercel zbuduje projekt (zajmie to 1-2 minuty). Po pomyślnym zbudowaniu otrzymasz publiczny adres URL np. `wallify-costam.vercel.app`.

### Krok 5: Aktualizacja kodu osadzenia (Shopify)
Otwórz plik `SHOPIFY_EMBED.md`, który stworzyliśmy wcześniej, i zamień tam linię:
`const WALLIFY_DOMAIN = "http://localhost:3000";`
na swój nowy, produkcyjny adres:
`const WALLIFY_DOMAIN = "https://twoja-domena.vercel.app";`

Wklej ten gotowy kod do edytora motywu w panelu Shopify. Gotowe!
