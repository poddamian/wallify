# Wallify — Osadzenie w Shopify Theme

## Metoda A — `<iframe>` (rekomendowana, prosta)

### 1. Otwórz Shopify Admin → Sklep Online → Motywy → Edytuj kod

### 2. Utwórz nową sekcję: `sections/wallify-ar.liquid`

```liquid
{% comment %}
  Wallify AR Viewer Section
  Osadza aplikację AR na stronie produktu przez iframe.
{% endcomment %}

<div class="wallify-ar-section">
  <iframe
    id="wallify-ar-frame"
    src="{{ section.settings.wallify_url }}/ar/{{ product.handle }}"
    style="width: 100%; height: {{ section.settings.height }}px; border: none; display: block;"
    allow="camera; web-share"
    loading="lazy"
    title="Podgląd AR — {{ product.title }}"
  ></iframe>
</div>

{% schema %}
{
  "name": "Wallify AR Viewer",
  "settings": [
    {
      "type": "text",
      "id": "wallify_url",
      "label": "URL aplikacji Wallify (Vercel)",
      "default": "https://wallify-lemon.vercel.app"
    },
    {
      "type": "range",
      "id": "height",
      "min": 400,
      "max": 900,
      "step": 50,
      "unit": "px",
      "label": "Wysokość widżetu",
      "default": 700
    }
  ],
  "presets": [
    {
      "name": "Wallify AR Viewer"
    }
  ]
}
{% endschema %}
```

### 3. Dodaj sekcję do szablonu produktu

Otwórz `templates/product.json` (lub `product.liquid`) i dodaj sekcję `wallify-ar` poniżej galerii produktu.

Lub prościej: w **Edytorze motywu** przeciągnij sekcję "Wallify AR Viewer" na stronę produktu.

### 4. Skonfiguruj w Edytorze motywu

- Przejdź do **Sklep online → Strony → Produkt**
- Kliknij sekcję "Wallify AR Viewer"
- Wpisz URL swojej aplikacji na Vercel (np. `https://wallify.vercel.app`)

---

> [!IMPORTANT]
> Atrybut `allow="camera; web-share"` w `<iframe>` jest **obowiązkowy**.
> Bez `camera` przeglądarka zablokuje kamerę w iframe, a bez `web-share` przycisk
> „Zapisz / wyślij" w trybie ze zdjęcia zamiast menu „Udostępnij" tylko pobierze plik.

---

## Tryb „Ze zdjęcia" (bez kamery)

Na ekranie startowym widżetu są dwa przyciski: **Przymierz na ścianie** (kamera na żywo)
i **Użyj zdjęcia ściany**. Na komputerze głównym przyciskiem jest zdjęcie.

Jeśli chcesz osobny przycisk na stronie produktu, który od razu otwiera tryb ze zdjęcia,
dodaj do adresu `?tryb=zdjecie`:

```liquid
src="{{ section.settings.wallify_url }}/ar/{{ product.handle }}?tryb=zdjecie"
```

Jak to działa dla klienta:
1. Wgrywa zdjęcie ściany (z galerii albo robi je od razu).
2. Ustawia skalę: przeciąga końce miarki do krawędzi drzwi, kartki A4 albo innego przedmiotu i wpisuje wymiar.
3. Przesuwa obraz, wybiera rozmiar i materiał, opcjonalnie dopasowuje perspektywę.
4. Zapisuje/wysyła zdjęcie albo dodaje wybrany wariant do koszyka.

Zdjęcie jest przetwarzane tylko w przeglądarce klienta. Wysyłane jest wyłącznie po kliknięciu
„Ulepsz AI" i potwierdzeniu (patrz `VERCEL_DEPLOYMENT.md`).

W zamówieniu w panelu Shopify każda pozycja dodana z Wallify ma ukrytą właściwość
`_Wallify` z wartością „na żywo" albo „ze zdjęcia" — widać, który podgląd sprzedaje.

---

## Po konfiguracji — jak to działa

```
Klient otwiera stronę produktu w Shopify
           ↓
Widzi widget Wallify (iframe) z przyciskiem „Przymierz na ścianie"
           ↓
Klika → przeglądarka pyta o kamerę → klient akceptuje
           ↓
Live widok z kamery + nakładka produktu w wybranym rozmiarze
           ↓
Klient klika „Dodaj do koszyka" → przekierowanie do checkout Shopify
```


---

## Koszyk sklepu (mostek Wallify → koszyk)

Wallify działa na innej domenie niż sklep, więc sam nie widzi koszyka artavia.pl.
Żeby „Dodaj do koszyka" w Wallify dodawało produkt do **zwykłego koszyka sklepu**
(z licznikiem w ikonce koszyka), wgraj do motywu plik:

- `shopify/snippets/wallify-bridge.liquid` → w edytorze kodu motywu folder **snippets**
  (Dodaj nowy snippet → nazwa `wallify-bridge`, wklej zawartość)

i w sekcji „Niestandardowy Liquid" pod ramką Wallify dopisz jedną linię:

```liquid
{% render 'wallify-bridge' %}
```

Bez tego Wallify używa zapasowego, osobnego koszyka — działa tylko przycisk „Przejdź do kasy".
