# ChatGPT Ecommerce Plugin Sample

Runnable Node.js sample with no third-party dependencies. It includes a product catalog, cart, checkout, a remote MCP endpoint for ChatGPT, and checkout-page ThreatMetrix profiling using the supplied `fp-clientlib-v6_0.js`.

## Run

```bash
cp .env.example .env
# export values from .env, or use your deployment's environment settings
npm test
npm start
```

Open `http://localhost:3000`. MCP endpoint: `http://localhost:3000/mcp`.

## ChatGPT tools

- `search_products`
- `get_product`
- `add_to_cart`
- `get_cart`
- `checkout_session`
- `get_order_status`

Try: `Find me a laptop under $1,200, add the best option to my cart, and start checkout.`

## ThreatMetrix profiling

Set:

```bash
TMX_PROFILING_DOMAIN=h.online-metrix.net
TMX_ORG_ID=YOUR8CHR
```

Checkout receives a server-generated session ID and immediately calls:

```js
threatmetrix.profile(domain, orgId, sessionId, 'checkout', threatmetrix.load_method.RUN_IMMEDIATE)
```

Use the same session ID for a server-to-server Session Query before payment authorization. Never expose Session Query credentials in the browser. The demo currently marks risk as accepted and does not collect real payment.

<<<<<<< HEAD
The hosted checkout shows the profiling lifecycle: it creates a unique session ID, starts browser-side profiling, and records only the lifecycle state (`started`, `unavailable`, or `failed`) with a timestamp. It does not claim that a risk decision has been made. For production, make the Session Query from your server, persist its result, and enforce the decision before payment authorization.

## Demo flow

Use the storefront to add items to its browser-persisted demo cart, then start checkout. Or, connect ChatGPT and ask it to find a product, add it to a cart, and begin checkout. The final order action happens only on the hosted checkout page.

=======
>>>>>>> a210db5 (initial)
## Connect to ChatGPT

Deploy behind public HTTPS or use a supported secure tunnel for development. Enable Developer mode, add the `/mcp` URL, inspect the tools, and test the workflow. The final order remains a user-confirmed action on checkout.

## Production adapters still required

OAuth and per-user authorization; persistent DB; inventory locking; tax/shipping; payment provider and idempotency; ThreatMetrix Session Query decisioning; webhooks/refunds/fulfillment; CSP/privacy/terms; logging and monitoring.
