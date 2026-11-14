# QuickCart Merchant API

> Reference quick-commerce grocery ordering backend and embedded merchant console for [FlexiMCP](https://github.com/fleximcp) gateway integration.

QuickCart Merchant API simulates a production quick-commerce merchant (such as Zepto, Blinkit, or Instamart) with authoritative server pricing, 6-digit Indian PIN code delivery verification, promo stacking and conflict rules, Razorpay test-mode payment gateway integration with cryptographic HMAC-SHA256 webhook processing, and dynamic OpenAPI 3.1 schema version switching (`v1`, `v2`, `v3`, `v4`).

---

## Architecture Overview

```
                      ┌───────────────────────────────────────────────┐
                      │            QuickCart Merchant API             │
                      │                                               │
  Agent / Client ───► │  [Express 4 + Helmet + CORS + Rate Limiter]   │
  (Bearer Token)      │                        │                      │
                      │                        ▼                      │
                      │         [Zod Runtime Request Validator]       │
                      │      (Dynamic Schemas for v1 / v2 / v3 / v4)  │
                      │                        │                      │
                      │         ┌──────────────┴──────────────┐       │
                      │         ▼                             ▼       │
                      │  [Domain Logic]               [Embedded SPA]  │
                      │  - Pricing (Integer Paise)    - React 18      │
                      │  - Promos & Exclusivity       - Tailwind CSS  │
                      │  - Razorpay HMAC Webhooks     - Lucide Icons  │
                      │  - Idempotent Orders          - (at /console) │
                      │         │                                     │
                      │         ▼                                     │
                      │  [In-Memory Store + 500-Event Ring Buffer]    │
                      └───────────────────────────────────────────────┘
```

### Key Technical Characteristics
- **Strict TypeScript (ESM)**: Compiled with NodeNext module resolution. Zero `any` types.
- **Integer Paise Money**: Floats are never used for currency calculations to eliminate floating-point drift.
- **Code-First OpenAPI 3.1**: Dynamically generated from Zod schemas via `@asteasolutions/zod-to-openapi`.
- **In-Memory Store**: Loaded from `seed/` JSON files at startup with instant reset (`POST /admin/reset`).
- **Cryptographic Security**: Razorpay webhook signatures verified with `crypto.timingSafeEqual` over raw request body buffers; payment sessions signed with HMAC-SHA256 tokens.
- **Embedded Console**: Single deployable service serving the backend API and the Vite React console at `/console`.

---

## Project Structure

```
quickcart/
├── .env.example              # Environment variables template
├── .env                      # Local environment configuration
├── Dockerfile                # Multi-stage production container build
├── docker-compose.yml        # Docker compose setup
├── package.json              # Root workspace manifest
├── pnpm-workspace.yaml       # pnpm workspace configuration
├── render.yaml               # Cloud deployment blueprint
├── README.md                 # Documentation & AC verification walkthrough
├── server/
│   ├── package.json          # Express server dependencies & scripts
│   ├── tsconfig.json         # Strict TypeScript configuration
│   ├── jest.config.js        # Jest ESM configuration
│   ├── seed/
│   │   ├── pincodes.json     # 12 serviceable Indian pincodes
│   │   ├── products.json     # 36 seeded items across 6 categories
│   │   └── promos.json       # WELCOME10, FLAT50, FREEDEL, EXPIRED20
│   ├── src/
│   │   ├── app.ts            # Express application factory & middleware setup
│   │   ├── server.ts         # HTTP listener & background timers
│   │   ├── config.ts         # Zod-validated environment config
│   │   ├── logger.ts         # Structured Pino logger with secret redactor
│   │   ├── domain/           # Pure business logic (pricing, cart, orders, promos)
│   │   ├── middleware/       # Auth, scopes, rate-limit, rawBody, requestId
│   │   ├── openapi/          # OpenAPI 3.1 generator per active version
│   │   ├── routes/           # REST endpoints
│   │   ├── schemas/          # Versioned Zod schemas (shared, v1, v2, v3, v4)
│   │   ├── store/            # In-memory store, seed loader, circular event log
│   │   └── webhooks/         # Razorpay signature verification & event handler
│   └── tests/                # Jest test suites (pricing, promo, cart, checkout, etc.)
└── console/                  # Vite + React 18 + Tailwind CSS Merchant Console
    ├── index.html
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── api/client.ts     # In-memory admin key client
        ├── components/       # Drawer, cards, toast, header, navigation
        ├── screens/          # Overview, Orders, Catalog, Payments, Demo Controls
        └── utils/            # Currency formatter (₹), relative time
```

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v20 or higher
- **pnpm** (or **npm**): v9 or v10

### 2. Installation
```bash
# Clone and install dependencies across workspaces
pnpm install
```

### 3. Environment Setup
```bash
cp .env.example .env
```

#### Environment Variables Reference
All environment variables are validated with Zod at boot and fail fast if missing or invalid:

| Variable | Type / Default | Description |
|---|---|---|
| `PORT` | `number` (4000) | TCP port on which the Express server listens. |
| `NODE_ENV` | `string` (`development`) | Runtime environment (`development`, `production`, `test`). In `production`, internal error stacks are suppressed. |
| `ADMIN_KEY` | `string` (required) | Secret key required in the `x-admin-key` header to access administrative endpoints and the console. |
| `DEV_TOOLS` | `boolean` (`false`) | Enables developer simulation endpoints (e.g. `POST /admin/dev/simulate-webhook`) when set to `true`. |
| `AGENT_TOKENS` | `string` (required) | Semicolon-delimited list of `name:token:scopes` defining valid agent bearer tokens and granted scopes. |
| `RAZORPAY_KEY_ID` | `string` (required) | Razorpay test mode Key ID. Placeholder keys (`rzp_test_placeholder`) automatically activate the offline fake client. |
| `RAZORPAY_KEY_SECRET` | `string` (required) | Razorpay secret key paired with Key ID. |
| `RAZORPAY_WEBHOOK_SECRET` | `string` (required) | HMAC secret used to verify incoming `x-razorpay-signature` webhook headers. |
| `SESSION_SIGNING_SECRET` | `string` (min 16 chars) | Secret key used to sign and verify HMAC payment session tokens (`pst_...`). |
| `PUBLIC_BASE_URL` | `url` (`http://localhost:4000`) | Authoritative public URL for the server used for CORS validation and webhook receipts. |

> [!CAUTION]
> **SECURITY NOTICE: DEMO & REFERENCE TOKENS**  
> All tokens, keys, and secrets in `.env.example`, tests, and documentation are demonstration placeholders. Never commit production keys or sensitive secrets to source control. In production, provide credentials via secret managers or secure environment injection.

> [!NOTE]
> **IN-MEMORY DATA PERSISTENCE NOTICE**  
> QuickCart Merchant API is designed for stateless and ephemeral environments (such as Render or Docker containers). All catalog data, active carts, and order histories are stored strictly in memory, initialized from `server/seed/` at startup. To reset the system to its initial seeded state at any time, invoke `POST /admin/reset`.

### 4. Build & Run
```bash
# Build console frontend and server backend
pnpm run build

# Start production server
pnpm start

# Or run tests
pnpm test

# Or run linter
pnpm run lint
```
The server will start at:
- **API & Health**: `http://localhost:4000/health`
- **OpenAPI 3.1 Spec**: `http://localhost:4000/openapi.json`
- **Merchant Console**: `http://localhost:4000/console`

---

## API Endpoints Reference

| Method | Path | operationId | Scope Required | Description |
|---|---|---|---|---|
| `GET` | `/health` | - | None | Service health, uptime & active spec version |
| `GET` | `/openapi.json` | - | None | Dynamic OpenAPI 3.1 document with ETag |
| `POST` | `/v1/location` | `setLocation` | `cart:write` | Validates pincode and sets delivery ETA & fee |
| `GET` | `/v1/catalog/search` | `searchCatalog` | `catalog:read` | Search items with pagination cursor |
| `GET` | `/v1/cart` | `getCart` | `cart:write` | Server-computed cart state with price breakdown |
| `PUT` | `/v1/cart/items` | `updateCart` | `cart:write` | Add/update item quantity (0 removes line) |
| `POST` | `/v1/cart/promo` | `applyPromo` | `cart:write` | Apply promo code (v1, v2, v3) |
| `POST` | `/v1/cart/coupons` | `applyCoupon` | `cart:write` | Apply coupon code (v4 breaking API) |
| `POST` | `/v1/checkout` | `checkout` | `checkout:create` | Creates order with `PENDING_PAYMENT` |
| `GET` | `/v1/orders/{orderId}` | `getOrder` | `orders:read` | Fetch order details (v2, v3, v4) |
| `POST` | `/webhooks/razorpay` | - | Raw HMAC | Processes `payment.captured` & `payment.failed` |
| `GET` | `/admin/state` | - | `x-admin-key` | Live telemetry, order status counts & audit log |
| `GET` | `/admin/orders` | - | `x-admin-key` | Lists all merchant orders across sessions |
| `GET` | `/admin/orders/:id` | - | `x-admin-key` | Inspects single order details & payment token |
| `GET` | `/admin/catalog` | - | `x-admin-key` | Inspects all 36 catalog products & stock counts |
| `GET` | `/admin/webhook-events`| - | `x-admin-key` | Audit log of received Razorpay webhook events |
| `POST` | `/admin/spec-version` | - | `x-admin-key` | Switches active schema & OpenAPI version |
| `POST` | `/admin/reset` | - | `x-admin-key` | Resets store to initial seeded state |
| `POST` | `/admin/dev/simulate-webhook` | - | `x-admin-key` | In-process signed webhook simulator (DEV_TOOLS=true) |

---

## Pricing & Promo Business Rules

All money is represented strictly in **integer paise** (₹1.00 = 100 paise).
```
subtotal    = sum(item.pricePaise * item.quantity)
discount    = computed according to promo eligibility
deliveryFee = location.deliveryFeePaise (waived if subtotal >= 49900 or FREEDEL)
handlingFee = 500 paise flat (0 if cart is empty)
gst         = Math.round((subtotal - discount) * 0.05) [5% half-up]
total       = subtotal - discount + deliveryFee + handlingFee + gst
```

### Promotional Coupons
- **`WELCOME10`**: 10% off up to 10000 paise (₹100), minimum subtotal 19900 paise (₹199), first order only per session.
- **`FLAT50`**: Flat 5000 paise (₹50) off, minimum subtotal 49900 paise (₹499).
- **`FREEDEL`**: Waives delivery fee, minimum subtotal 14900 paise (₹149). Stacks with either `WELCOME10` or `FLAT50`.
- **`EXPIRED20`**: Expired code for error path testing (returns `410 PROMO_EXPIRED`).
- **Conflict Rule**: Only one of `WELCOME10` or `FLAT50` can be active at a time (`409 PROMO_CONFLICT`).

---

## Acceptance Criteria Walkthrough (Curl Commands)

Below are the exact commands to prove every single acceptance criterion:

### Acceptance Criterion 1: Full Purchase Flow
*Proves: setLocation -> searchCatalog -> updateCart -> applyPromo -> checkout -> simulated signed webhook -> order PAID.*

```bash
# 1. Set Delivery Location
curl -s -X POST http://localhost:4000/v1/location \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac1_session" \
  -H "Content-Type: application/json" \
  -d '{"pincode":"302001","label":"Home"}'

# 2. Search Catalog for Mangoes
curl -s "http://localhost:4000/v1/catalog/search?q=Alphonso&limit=1" \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac1_session"

# 3. Add to Cart (prod_fv_01: Fresh Alphonso Mangoes, price: 59900 paise)
curl -s -X PUT http://localhost:4000/v1/cart/items \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac1_session" \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod_fv_01","quantity":1}'

# 4. Apply WELCOME10 Promo (10% off, saves 5990 paise)
curl -s -X POST http://localhost:4000/v1/cart/promo \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac1_session" \
  -H "Content-Type: application/json" \
  -d '{"code":"WELCOME10"}'

# 5. Initiate Checkout (creates PENDING_PAYMENT order)
curl -s -X POST http://localhost:4000/v1/checkout \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac1_session" \
  -H "Idempotency-Key: ac1_checkout_idem_01" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"razorpay"}'

# 6. Simulate Razorpay Signed Webhook (marks order PAID, clears cart, decrements stock)
curl -s -X POST http://localhost:4000/admin/dev/simulate-webhook \
  -H "x-admin-key: adminkey_supersecret_12345" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"<ORDER_ID_FROM_STEP_5>","outcome":"captured"}'
```

---

### Acceptance Criterion 2: Price Mismatch (409)
*Proves: A wrong `expectedTotalPaise` returns `409 PRICE_MISMATCH`.*

```bash
curl -s -X POST http://localhost:4000/v1/checkout \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac2_session" \
  -H "Idempotency-Key: ac2_idem_01" \
  -H "Content-Type: application/json" \
  -d '{"expectedTotalPaise":99999,"paymentMethod":"razorpay"}'
```
**Expected Response (409 Conflict):**
```json
{
  "error": {
    "code": "PRICE_MISMATCH",
    "message": "The expected total (₹999.99) does not match authoritative calculated total...",
    "details": {
      "expectedTotalPaise": 99999,
      "actualTotalPaise": 7190,
      "breakdown": { ... }
    },
    "requestId": "..."
  }
}
```

---

### Acceptance Criterion 3: Quantity Exceeds Limit (422)
*Proves: Quantity above `maxPerOrder` returns `422 QUANTITY_EXCEEDS_LIMIT`.*

```bash
curl -s -X PUT http://localhost:4000/v1/cart/items \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac3_session" \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod_fv_01","quantity":99}'
```
**Expected Response (422 Unprocessable Content):**
```json
{
  "error": {
    "code": "QUANTITY_EXCEEDS_LIMIT",
    "message": "Cannot add 99 units of 'Fresh Alphonso Mangoes'. Maximum allowed per order is 4.",
    "details": {
      "productId": "prod_fv_01",
      "requestedQuantity": 99,
      "maxPerOrder": 4
    },
    "requestId": "..."
  }
}
```

---

### Acceptance Criterion 4: Checkout Without Location (422)
*Proves: Checkout without setting a location returns `422 LOCATION_NOT_SET`.*

```bash
# Add item to cart without calling /v1/location
curl -s -X PUT http://localhost:4000/v1/cart/items \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac4_session_no_loc" \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod_fv_02","quantity":1}'

# Checkout
curl -s -X POST http://localhost:4000/v1/checkout \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac4_session_no_loc" \
  -H "Idempotency-Key: ac4_idem_01" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"razorpay"}'
```
**Expected Response (422 Unprocessable Content):**
```json
{
  "error": {
    "code": "LOCATION_NOT_SET",
    "message": "Delivery location must be set before checkout. Please call POST /v1/location first.",
    "requestId": "..."
  }
}
```

---

### Acceptance Criterion 5: Promo Conflict (409)
*Proves: Applying `WELCOME10` then `FLAT50` returns `409 PROMO_CONFLICT`.*

```bash
# Set location and add items with subtotal >= 49900
curl -s -X POST http://localhost:4000/v1/location \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac5_session" \
  -H "Content-Type: application/json" \
  -d '{"pincode":"302001"}'

curl -s -X PUT http://localhost:4000/v1/cart/items \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac5_session" \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod_fv_01","quantity":1}'

# 1. Apply WELCOME10 (Succeeds)
curl -s -X POST http://localhost:4000/v1/cart/promo \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac5_session" \
  -H "Content-Type: application/json" \
  -d '{"code":"WELCOME10"}'

# 2. Apply FLAT50 (Fails with 409 Conflict)
curl -s -X POST http://localhost:4000/v1/cart/promo \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac5_session" \
  -H "Content-Type: application/json" \
  -d '{"code":"FLAT50"}'
```
**Expected Response (409 Conflict):**
```json
{
  "error": {
    "code": "PROMO_CONFLICT",
    "message": "Cannot apply 'FLAT50' because conflicting promo 'WELCOME10' is already applied. Only one order-level discount code can be active.",
    "details": {
      "conflictingCode": "WELCOME10",
      "newCode": "FLAT50"
    },
    "requestId": "..."
  }
}
```

---

### Acceptance Criterion 6: Client Cannot Mark Paid
*Proves: A request claiming payment success changes nothing; only a validly signed webhook changes order state.*

No client endpoint allows modifying order state to `PAID`. Attempting to patch, update, or send payment claims returns 404:
```bash
curl -s -X PATCH http://localhost:4000/v1/orders/ord_12345 \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "Content-Type: application/json" \
  -d '{"status":"PAID"}'
```
**Expected Response (404 Not Found):**
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route PATCH /v1/orders/ord_12345 not found.",
    "requestId": "..."
  }
}
```

---

### Acceptance Criterion 7: Bad Webhook Signature Rejected (400)
*Proves: An invalid HMAC signature header is rejected with 400.*

```bash
curl -s -X POST http://localhost:4000/webhooks/razorpay \
  -H "x-razorpay-signature: fake_tampered_hmac_hex" \
  -H "Content-Type: application/json" \
  -d '{"event":"payment.captured"}'
```
**Expected Response (400 Bad Request):**
```json
{
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "The x-razorpay-signature header is missing or does not match the computed HMAC signature.",
    "requestId": "..."
  }
}
```

---

### Acceptance Criterion 8: payment.failed Preserves Cart & Issues Fresh Token
*Proves: After `payment.failed`, cart is intact, new checkout returns a fresh `paymentSessionToken`, and old token fails.*

```bash
# 1. Setup cart and checkout
curl -s -X POST http://localhost:4000/v1/location \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac8_session" \
  -H "Content-Type: application/json" \
  -d '{"pincode":"302001"}'

curl -s -X PUT http://localhost:4000/v1/cart/items \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac8_session" \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod_fv_02","quantity":2}'

curl -s -X POST http://localhost:4000/v1/checkout \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac8_session" \
  -H "Idempotency-Key: ac8_idem_01" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"razorpay"}'
# (Note paymentSessionToken returned: pst_ey...)

# 2. Simulate payment.failed webhook
curl -s -X POST http://localhost:4000/admin/dev/simulate-webhook \
  -H "x-admin-key: adminkey_supersecret_12345" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"<ORDER_ID>","outcome":"failed"}'

# 3. Verify cart still contains items
curl -s http://localhost:4000/v1/cart \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac8_session"

# 4. Retry checkout -> returns NEW distinct paymentSessionToken
curl -s -X POST http://localhost:4000/v1/checkout \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac8_session" \
  -H "Idempotency-Key: ac8_idem_retry" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"razorpay"}'
```

---

### Acceptance Criterion 9: Spec Version Switching (v1 -> v2 -> v3)
*Proves: Switching `/admin/spec-version` updates `/openapi.json` and request validation.*

```bash
# 1. In v1: GET /v1/orders/{orderId} is NOT in spec
curl -s http://localhost:4000/openapi.json | grep -o '"version":"v1"'

# 2. Switch to v2: adds getOrder endpoint
curl -s -X POST http://localhost:4000/admin/spec-version \
  -H "x-admin-key: adminkey_supersecret_12345" \
  -H "Content-Type: application/json" \
  -d '{"version":"v2"}'

curl -s http://localhost:4000/openapi.json | grep -o 'getOrder'

# 3. Switch to v3: checkout now requires deliverySlot
curl -s -X POST http://localhost:4000/admin/spec-version \
  -H "x-admin-key: adminkey_supersecret_12345" \
  -H "Content-Type: application/json" \
  -d '{"version":"v3"}'

# In v3, a v1-shaped checkout body fails with 400
curl -s -X POST http://localhost:4000/v1/checkout \
  -H "Authorization: Bearer qc_agent_test_tok_123" \
  -H "x-session-id: ac9_session" \
  -H "Idempotency-Key: ac9_idem" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"razorpay"}'
# -> Returns 400 VALIDATION_ERROR: deliverySlot: Required
```

---

### Acceptance Criterion 10: Store Reset
*Proves: `POST /admin/reset` returns system to seeded state.*

```bash
curl -s -X POST http://localhost:4000/admin/reset \
  -H "x-admin-key: adminkey_supersecret_12345"
```
**Expected Response (200 OK):**
```json
{
  "message": "QuickCart merchant store has been reset to initial seeded state.",
  "specVersion": "v1"
}
```

---

### Acceptance Criterion 11: Build, Test & Console Verification
*Proves: npm test passes, console loads at `/console`, and Docker runs the whole service.*

```bash
# 1. Run Jest Tests
pnpm test

# 2. Verify Console at /console
curl -s -I http://localhost:4000/console
# -> HTTP/1.1 200 OK

# 3. Run with Docker Compose
docker compose up --build
```

