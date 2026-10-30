# Product catalogue updates

`update_products.py` is an offline enrichment step. It reads a JSON array, adds
conservative name-derived product attributes and curated manufacturer details
for explicitly matched models, then writes an enriched JSON array. It does not
call ChatGPT or any network service. The input file is only changed when it is
also specified as the output path.

From this directory, enrich the current public catalogue in place:

```powershell
npm run enrich-products -- ..\frontend\public\products.json ..\frontend\public\products.json
npm run import-products
```

Or preserve the source and write to a separate file:

```powershell
npm run enrich-products -- .\catalogue.json .\products_updated.json
```

The importer stores the catalogue in MySQL, and `/api/products` provides the
product pages with the saved details. Restart the backend after importing; the
frontend fetches the latest catalog from that API.

The shopping assistant treats product types joined by "and" or "or" as
alternatives (for example, "conditioner and serum"), while words within each
product phrase must still match the same product.

Run the enrichment regression tests with `npm run test:catalog`.
