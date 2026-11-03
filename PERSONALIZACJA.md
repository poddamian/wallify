# Wallify — obraz z własnego zdjęcia klienta

Dla produktów personalizowanych klient **wgrywa swoje zdjęcie w Wallify**, ogląda je na
ścianie (na żywo albo na zdjęciu pokoju), wybiera kadr i rozmiar, a przy dodaniu do koszyka
**oryginał trafia do Shopify Files**. Link do pliku i kadr są w zamówieniu — bez maili.

## Które produkty?

Produkt z tagiem **`personalizowany obraz`** (już ma go „Obraz Na Płótnie Ze Zdjęcia")
albo **`wallify-wlasne-zdjecie`**. Wallify pobiera wszystkie warianty (np. 169 rozmiarów × 2 materiały).

## Co widzi klient

1. „Wybierz zdjęcie do druku" — zdjęcie zostaje w przeglądarce do chwili zamówienia.
2. Rozmiary polecane do proporcji zdjęcia (najmniej przycinania) + lista wszystkich rozmiarów.
3. Ocena jakości druku dla wybranego rozmiaru (DPI) i pomarańczowa kropka przy zbyt dużych formatach.
4. „Kadr" — przesuwa ramkę po zdjęciu; to, co w ramce, trafi na płótno.
5. „Dodaj do koszyka" → wysyłka zdjęcia (pasek postępu) → „Przejdź do kasy".

## Co widzisz w zamówieniu

Właściwości pozycji (te z `_` klient nie widzi w kasie):

| Właściwość | Przykład |
|---|---|
| Personalizacja | Twoje zdjęcie |
| _Zdjęcie | https://cdn.shopify.com/…/wallify-2026-09-30-a1b2c3d4.jpg |
| _Zdjęcie w panelu | link do pliku w Treści → Pliki |
| _Kadr | x 0, y 143, 4000 × 2857 px (oryginał 4000 × 3000 px) |
| _Jakość druku | dobra (85 DPI) |
| _Wallify | na żywo / ze zdjęcia |

Kadr jest w pikselach **oryginału** — do druku wycinasz ten prostokąt z pliku `_Zdjęcie`.

## Konfiguracja (jednorazowo)

Od 2026 r. nowe aplikacje tworzy się w **Dev Dashboard** Shopify:

1. Wejdź na https://dev.shopify.com/dashboard (ta sama organizacja, do której należy sklep Artavia).
2. **Utwórz aplikację** (np. „Wallify").
3. W wersji aplikacji ustaw uprawnienia Admin API: **`write_files`** i **`read_files`**, wydaj wersję.
4. **Zainstaluj** aplikację w sklepie Artavia.
5. Z ustawień aplikacji skopiuj **Client ID** i **Client secret**.
6. W Vercel → projekt Wallify → Settings → Environment Variables dodaj:

| Nazwa | Wartość |
|---|---|
| `SHOPIFY_ADMIN_URL` | `https://enjmaa-pw.myshopify.com` |
| `SHOPIFY_ADMIN_CLIENT_ID` | Client ID |
| `SHOPIFY_ADMIN_CLIENT_SECRET` | Client secret |

   Te zmienne **nie mogą** zaczynać się od `NEXT_PUBLIC_` — zostają tylko na serwerze.
   Token Admin API Wallify pobiera i odświeża sam (ważny 24 h).

7. **Redeploy** w Vercel.

Bez tych zmiennych personalizacja też działa, ale zdjęcie nie jest wysyłane — w koszyku
pojawia się „Personalizacja: zdjęcie prześlę mailem" (dotychczasowa droga).

## Po wdrożeniu

- Zmień opis produktu „Obraz Na Płótnie Ze Zdjęcia": zamiast „napisz na info@…" —
  „Wgraj zdjęcie w podglądzie i zobacz je na swojej ścianie".
- Do sekcji Wallify na tym produkcie możesz dać `?tryb=zdjecie` albo zostawić ekran startowy.

## Porządki i RODO

- Pliki mają nazwy `wallify-RRRR-MM-DD-…` — w Treści → Pliki łatwo je filtrować.
- Plik wysyłany jest dopiero przy „Dodaj do koszyka", więc porzucone koszyki też zostawiają pliki.
  Warto co jakiś czas usuwać starsze niezamówione.
- Adres pliku w CDN jest publiczny, ale nie do odgadnięcia (losowa nazwa).
- Dopisz do polityki prywatności, że zdjęcia do personalizacji są przechowywane w Shopify
  na potrzeby realizacji zamówienia i jak długo.

## Jak to działa technicznie

- `lib/upload-client.ts` — przeglądarka wysyła oryginał prosto do Shopify (staged upload),
  a gdy się nie uda — awaryjnie przez `/api/upload/proxy` jako JPG do ok. 4 MB.
- `/api/upload/start` → `stagedUploadsCreate`, `/api/upload/finish` → `fileCreate` + oczekiwanie na READY.
- `/finish` przyjmuje tylko adresy podpisane przez `/start` lub `/proxy` (HMAC), więc nikt nie
  wgra sklepowi obcego pliku. Limit: 30 wysyłek na godzinę z jednego adresu IP.
