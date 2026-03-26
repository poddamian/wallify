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
    allow="camera"
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
> Atrybut `allow="camera"` w `<iframe>` jest **obowiązkowy**.
> Bez niego przeglądarka zablokuje dostęp do kamery wewnątrz iframe.

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
