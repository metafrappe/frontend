# Arka uç sözleşmeleri

Bu klasör arka uç sözleşmelerinin bir kopyasını tutar. Kopyadaki dosyaları elle değiştirmeyin.

- `openapi/` klasöründe OpenAPI dosyaları durur.
- `docs/contracts.md` dosyası ortak adları tutar.
- `SOURCE.json` dosyası kaynak depo adını, commit kimliğini ve dosya özetlerini tutar.

## Kopyayı yenileme

Kaynak `metafrappe/backend` deposudur. Deponun yerel kopyasını siz verirsiniz. Kopyanın kökünde `contracts/` klasörü ve `docs/contracts.md` dosyası bulunmalıdır.

Örneğin backend deposunu bu deponun yanına klonlayın:

```bash
git clone https://github.com/metafrappe/backend.git ../backend
```

Sonra kopyayı yenileyin:

```bash
node contracts/sync.mjs --source ../backend
```

Kaynağı ortam değişkeniyle de verebilirsiniz:

```bash
ATONOTA_BACKEND_DIR=../backend node contracts/sync.mjs
```

Kopyanın güncel olup olmadığını şu komut denetler. Komut bir şey yazmaz. Kopya eskiyse 1 ile çıkar.

```bash
node contracts/sync.mjs --source ../backend --check
```

Kopyayı yeniledikten sonra API tiplerini yeniden üretin.
