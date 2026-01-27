AI Price Extraction Spec

Purpose
- Provide a clear, standalone specification the AI (ChatGPT via OpenAI API) must follow to extract accurate competitor list prices from the web using the product data ingested from Excel.

Scope
- Excel ingestion (optional competitor URL)
- Dual search modes: Default (search all competitor sites for region), Specific-URL (search only provided URL)
- Multi-step matching: Title → SKU → Brand
- Region filtering & currency
- Robust price extraction rules, validation, and JSON output format

1) Input sources and preprocessing
- Required product fields (from Excel): id, name (title), sku (optional), brand (optional), sellingPrice, competitorUrl (optional), country (IN/US/UK/AE/DE). If country missing, default to `IN`.
- Excel parsing:
  - Read all rows; trim strings and normalize whitespace
  - Extract first valid HTTP(S) URL if any and put into `competitorUrl` (optional)
  - Normalize SKU by removing whitespace and punctuation for search
- Validate input types (numbers for price, strings for text fields)

2) Mode selection logic
- If `competitorUrl` exists on the product row or the user provided a per-run `searchUrl`, use Specific-URL Mode: search ONLY that website.
- Otherwise use Default Mode: search across `COUNTRY_CONFIGS[country].sources` (list of competitor websites for that country).

3) Multi-step search strategy (order of operations)
- Step 1: Title (highest priority)
  - Search for the exact product title across selected websites.
  - Require close textual match: normalized tokens overlap >= 90% and key tokens (storage size, model number) must match.
  - If found, label `matchedBy = "title"` and `confidence = 1.0`.

- Step 2: SKU/ID (fallback)
  - Search for the SKU across selected websites; SKU match is strong even if title differs.
  - If found, label `matchedBy = "sku"` and `confidence = 0.85`.

- Step 3: Brand (last fallback)
  - Search for the product by brand + probable model words; accept only when title similarity is reasonable (>= 65% tokens overlap).
  - If found, label `matchedBy = "brand"` and `confidence = 0.65`.

- When multiple candidate matches exist across many websites, choose the candidate with:
  1) Higher matching method precedence (title > sku > brand)
  2) Higher textual similarity score
  3) Cleaner price display (explicit list price shown vs. only offers)
  4) Prefer official brand/retailer pages over marketplace listing pages when similarity equal

4) Pricing extraction rules (critical)
- Extract the main LIST PRICE displayed on the product page (ignore crossed-out/old price unless the page shows the listed "current" price clearly). If both "list" and "sale" exist, return the prominent current price and note sale vs list in `notes`.
- Normalize price to a numeric decimal without currency symbol (e.g., 82900.00).
- Currency: must match the region's currency (from COUNTRY_CONFIGS). If page uses a different currency, convert only if conversion is allowed and reliable (preferred: do not convert; instead return found currency and set `currency` accordingly).
- Price sanity checks:
  - Must be > 0
  - Must be within a reasonable range (e.g., 10%–1000% of own `sellingPrice`). If price is wildly different (e.g., 100x smaller), lower confidence or discard match.

5) Response JSON schema (strict)
- The AI must output ONLY valid JSON. No extra text or markdown.
- Schema:
{
  "found": true|false,
  "matchedBy": "title"|"sku"|"brand",
  "price": number|null,
  "currency": "INR"|"USD"|"GBP"|"AED"|"EUR",
  "source": "website_display_name",
  "url": "http(s)://...",
  "confidence": 0.0 - 1.0,
  "notes": "optional short string"
}

6) Error handling & fallback
- If AI cannot find a valid match: return `found: false`, `price: null`, `confidence: 0.0`, and short `notes` explaining why.
- If AI returns malformed JSON: the client must log raw content for debugging and then use fallback `matchProduct()` simulation.
- If extracted price fails sanity checks, set `found: false` and include `notes` explaining failure reason.

7) Logging & debugging recommendations
- Save raw ChatGPT response for failed or low-confidence matches for offline inspection.
- Log `matchedBy`, `confidence`, `source`, and `url` for each positive match.

8) Rate-limiting & retries
- Respect OpenAI rate limits; for transient HTTP 429 / 5xx errors, retry up to 2 times with exponential backoff.
- For repeated failures on the same product, add a `notes` marker and fallback to simulation.

9) Testing checklist
- Unit tests for `excelParser.extractFirstUrl()` with varied Excel samples.
- Integration test: run `batchMatchProducts()` for a small set of products (one with `competitorUrl`, one without) and assert returned JSON schema and sanity checks.
- Manual verification: For flagged low-confidence matches, open `url` and confirm the extracted price.

10) Prompt guidelines for ChatGPT (concise)
- Provide the product details, selected websites list (or specific URL), and precise instructions to search and extract exact list price.
- Enforce `temperature: 0.2`, `max_tokens: 600`.
- Require JSON-only output and give explicit `confidence` scoring rules.

11) Example
Input product:
- name: "Apple iPhone 17 256GB"
- sku: "MG6N4HN/A"
- brand: "Apple"
- country: "IN"
- competitorUrl: (empty)

Default Mode: Search Amazon.in, Flipkart, Croma, Reliance Digital, Snapdeal, etc.
Expected AI JSON (example):
{
  "found": true,
  "matchedBy": "title",
  "price": 82900.00,
  "currency": "INR",
  "source": "Amazon.in",
  "url": "https://www.amazon.in/dp/EXAMPLE",
  "confidence": 1.0,
  "notes": "Exact title match on official product page"
}

12) Maintenance notes
- Keep `COUNTRY_CONFIGS` up to date with the most relevant retail sources per market.
- Update matching thresholds if false positives appear frequently.

---

If you want, I can also:
- Add this spec into the project `docs/` (already done), or convert it to `src/utils/ai_price_spec.ts` as a machine-readable config.
- Instrument logging to capture raw ChatGPT output for failing rows.
- Implement the stricter similarity checks and sanity validation in `aiProductMatcher.ts` next.
