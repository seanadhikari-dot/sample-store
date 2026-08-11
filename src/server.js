import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addToCart,
  cartView,
  completeCheckout,
  createCheckout,
  getCart,
  getCheckout,
  products,
  searchProducts,
} from './store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const port = process.env.PORT || 3000;
const base = (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '').replace(/\/mcp$/, '');
const tmxDomain = (process.env.TMX_PROFILING_DOMAIN || 'h.online-metrix.net').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const tmxOrigin = `https://${tmxDomain}`;
const tmxOrgId = process.env.TMX_ORG_ID || '';
const tmxConfig = JSON.stringify({
  tmxDomain,
  tmxOrgId,
  tmxConfigured: /^[A-Za-z0-9]{8}$/.test(tmxOrgId) && tmxOrgId.toUpperCase() !== 'YOUR8CHR',
}).replace(/</g, '\\u003c');
// Changing this URI forces ChatGPT to use the corrected MCP Apps resource.
const checkoutUri = 'ui://sean-shop/checkout-v8.html';

const tools = [
  {
    name: 'search_products',
    description: 'Search Sean Shop products.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, additionalProperties: false },
  },
  {
    name: 'add_to_cart',
    description: 'Add a product to a cart. Omit cartId to create a new cart.',
    inputSchema: { type: 'object', properties: { cartId: { type: 'string' }, productId: { type: 'string' }, quantity: { type: 'integer', minimum: 1 } }, required: ['productId'], additionalProperties: false },
  },
  {
    name: 'get_cart',
    description: 'Get a cart by its ID.',
    inputSchema: { type: 'object', properties: { cartId: { type: 'string' } }, required: ['cartId'], additionalProperties: false },
  },
  {
    name: 'checkout_session',
    description: 'Show an in-chat Sean Shop checkout. TMX profiling begins when the checkout view loads.',
    inputSchema: { type: 'object', properties: { cartId: { type: 'string' } }, required: ['cartId'], additionalProperties: false },
    _meta: { ui: { resourceUri: checkoutUri }, 'openai/outputTemplate': checkoutUri, 'openai/widgetAccessible': true },
  },
  {
    name: 'complete_checkout',
    description: 'Complete a demo order only after the user presses Confirm in checkout.',
    inputSchema: { type: 'object', properties: { checkoutId: { type: 'string' } }, required: ['checkoutId'], additionalProperties: false },
  },
  {
    name: 'get_order_status',
    description: 'Get checkout status.',
    inputSchema: { type: 'object', properties: { checkoutId: { type: 'string' } }, required: ['checkoutId'], additionalProperties: false },
  },
];

const widget = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color: #13231f; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; } body { margin: 0; background: #f5f3ed; } button { font: inherit; }
  .checkout { overflow: hidden; border: 1px solid #d9d8d1; border-radius: 20px; background: #fffefa; box-shadow: 0 18px 45px rgba(25, 39, 35, .12); }
  .hero { padding: 25px 25px 22px; color: #f7f6ef; background: radial-gradient(circle at 94% 5%, #d9fb6a 0 5%, transparent 5.2%), linear-gradient(135deg, #16332d, #10231f); }
  .eyebrow { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; color: #d9fb6a; font-size: 10px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
  .eyebrow::before { width: 7px; height: 7px; border-radius: 50%; background: currentColor; content: ""; }
  h1 { margin: 0; font-family: Georgia, serif; font-size: 31px; font-weight: 400; letter-spacing: -.035em; } .hero p { max-width: 370px; margin: 9px 0 0; color: #b7c5be; font-size: 13px; line-height: 1.5; }
  .content { padding: 22px 25px 25px; } .section-label { margin: 0 0 12px; color: #71807a; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .items { border-top: 1px solid #e6e4dc; } .item { display: grid; grid-template-columns: 38px 1fr auto; gap: 11px; align-items: center; padding: 12px 0; border-bottom: 1px solid #e6e4dc; }
  .qty { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 11px; color: #41685e; background: #e4f1e9; font-size: 12px; font-weight: 800; } .name { font-size: 13px; font-weight: 750; } .unit { margin-top: 3px; color: #77837e; font-size: 11px; } .price { font-size: 13px; font-weight: 800; }
  .totals { margin: 18px 0; padding: 15px 16px; border-radius: 14px; background: #f3f2eb; } .line { display: flex; justify-content: space-between; padding: 4px 0; color: #68746f; font-size: 12px; } .line strong { color: #18312a; } .total { margin-top: 9px; padding-top: 12px; border-top: 1px solid #d9d8d0; color: #13231f; font-size: 16px; font-weight: 800; }
  .trust { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid #dce8de; border-radius: 13px; background: #f5faf5; } .shield { display: grid; flex: none; width: 25px; height: 25px; place-items: center; border-radius: 9px; background: #173e35; color: #d9fb6a; font-size: 13px; } .trust-copy { color: #4d625a; font-size: 11px; line-height: 1.45; } .trust-copy b { display: block; margin-bottom: 1px; color: #1f473d; font-size: 12px; }
  .cta { width: 100%; margin-top: 17px; padding: 14px 16px; border: 0; border-radius: 12px; color: #13231f; background: #d9fb6a; box-shadow: inset 0 -2px 0 rgba(0,0,0,.12); font-size: 14px; font-weight: 850; cursor: pointer; transition: transform .15s ease, filter .15s ease; } .cta:hover:not(:disabled) { filter: brightness(.96); transform: translateY(-1px); } .cta:disabled { cursor: wait; opacity: .52; }
  .note { margin: 11px 0 0; color: #78827d; font-size: 10px; line-height: 1.4; text-align: center; } .error { padding: 24px; color: #893b32; text-align: center; } .success-mark { display: grid; width: 54px; height: 54px; place-items: center; margin-bottom: 17px; border-radius: 18px; color: #173e35; background: #d9fb6a; box-shadow: 5px 5px 0 #173e35; font-size: 26px; font-weight: 900; } #confirmation h2 { margin: 0; color: #173e35; font-family: Georgia, serif; font-size: 29px; font-weight: 400; letter-spacing: -.035em; } .success-copy { margin: 9px 0 20px; color: #66756e; font-size: 13px; line-height: 1.5; } .session { padding: 14px; border: 1px solid #dce8de; border-radius: 13px; background: #f5faf5; } .session span { display: block; margin-bottom: 7px; color: #6a7c74; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; } .session code { display: block; overflow-wrap: anywhere; color: #174336; font-size: 11px; } @media (max-width: 360px) { .hero, .content { padding-left: 18px; padding-right: 18px; } }
</style></head><body>
  <main class="checkout"><header class="hero"><div class="eyebrow">Sean Shop · secure checkout</div><h1>One last look.</h1><p>Your items are reserved while you review the final total.</p></header>
  <section id="checkout-content" class="content"><p class="section-label">Your order</p><div id="order" class="items">Loading your cart…</div>
  <div id="totals" class="totals" hidden></div>
  <div class="trust"><span class="shield">✓</span><div id="tmx" class="trust-copy"><b>Verifying this checkout</b>Preparing secure device profiling…</div></div>
  <button id="confirm" class="cta" disabled>Confirm demo order <span aria-hidden="true">→</span></button><p class="note">No payment details are collected in this demo.</p></section>
  <section id="confirmation" class="content" hidden><div class="success-mark">✓</div><p class="section-label">Order confirmed</p><h2>Thank you for your order.</h2><p class="success-copy">Your Sean Shop order is confirmed and we’ve saved the details below.</p><div class="session"><span>Profiling session ID</span><code id="session-id"></code></div><p class="note">Keep this ID handy if you need help with this checkout.</p></section></main>
  <script>
    const order = document.querySelector('#order');
    const totals = document.querySelector('#totals');
    const tmx = document.querySelector('#tmx');
    const confirm = document.querySelector('#confirm');
    const checkoutContent = document.querySelector('#checkout-content');
    const confirmation = document.querySelector('#confirmation');
    const sessionId = document.querySelector('#session-id');
    const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
    const profileConfig = ${tmxConfig};
    let checkout;
    let profiledSessionId;

    function render(result) {
      checkout = result?.structuredContent?.checkout || result?.checkout || window.openai?.toolOutput?.checkout;
      if (!checkout?.cart) {
        order.className = 'error'; order.textContent = 'Checkout details are unavailable. Please reopen checkout from your cart.';
        return;
      }
      // Start profiling at the earliest point possible: when this view receives its checkout session.
      if (profiledSessionId !== checkout.sessionId) {
        profiledSessionId = checkout.sessionId;
        startProfiling(checkout.sessionId);
      }
      order.innerHTML = checkout.cart.items.map(i => '<div class="item"><span class="qty">' + i.quantity + '×</span><div><div class="name">' + i.name + '</div><div class="unit">' + fmt(i.unitPriceCents) + ' each</div></div><div class="price">' + fmt(i.lineTotalCents) + '</div></div>').join('');
      totals.hidden = false;
      totals.innerHTML = '<div class="line"><span>Subtotal</span><strong>' + fmt(checkout.cart.subtotalCents) + '</strong></div><div class="line"><span>Shipping</span><strong>' + fmt(checkout.cart.shippingCents) + '</strong></div><div class="line"><span>Estimated tax</span><strong>' + fmt(checkout.cart.taxCents) + '</strong></div><div class="line total"><span>Total</span><span>' + fmt(checkout.cart.totalCents) + '</span></div>';
      confirm.disabled = false;
    }

    async function startProfiling(sessionId) {
      try {
        if (!profileConfig.tmxConfigured) { tmx.innerHTML = '<b>Checkout protection is not configured</b>Add TMX_ORG_ID (eight characters) to your deployment environment.'; return; }
        const script = document.createElement('script');
        script.src = '${base}/vendor/fp-clientlib-v6_0.js';
        script.onload = () => {
          try {
            if (typeof window.threatmetrix?.profile !== 'function') throw new Error('ThreatMetrix profile API was not registered');
            window.tmx_profiling_complete = () => tmx.innerHTML = '<b>Checkout protection verified</b>Your device profile was securely checked.';
            window.threatmetrix.profile(profileConfig.tmxDomain, profileConfig.tmxOrgId, sessionId, 'checkout', window.threatmetrix.load_method.RUN_IMMEDIATE);
            console.info('ThreatMetrix profiling started', { domain: profileConfig.tmxDomain, sessionId });
            tmx.innerHTML = '<b>Checkout protection is active</b>Secure device profiling has started.';
          } catch (error) { console.error('ThreatMetrix profiling did not start', error); tmx.innerHTML = '<b>Checkout protection could not start</b>' + error.message; }
        };
        script.onerror = () => tmx.innerHTML = '<b>Checkout protection could not load</b>Confirm PUBLIC_BASE_URL points to this HTTPS deployment.';
        document.head.append(script);
      } catch (_) { tmx.innerHTML = '<b>Checkout protection could not start</b>Check the ThreatMetrix configuration and deployment logs.'; }
    }

    window.addEventListener('message', event => {
      if (event.source !== window.parent || !event.data || event.data.jsonrpc !== '2.0') return;
      if (event.data.method === 'ui/notifications/tool-result') render(event.data.params);
    });
    if (window.openai?.toolOutput) render({ checkout: window.openai.toolOutput.checkout });
    function showConfirmation() {
      checkoutContent.hidden = true;
      confirmation.hidden = false;
      sessionId.textContent = checkout.sessionId;
    }
    confirm.onclick = async () => {
      if (!checkout || !window.openai?.callTool) return;
      confirm.disabled = true;
      confirm.textContent = 'Confirming your order…';
      try {
        await Promise.race([
          window.openai.callTool('complete_checkout', { checkoutId: checkout.id }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Confirmation timed out')), 15000)),
        ]);
        showConfirmation();
      } catch (_) { confirm.disabled = false; confirm.textContent = 'Could not confirm — try again'; }
    };
  </script>
</body></html>`;

const out = (text, structuredContent = {}) => ({ content: [{ type: 'text', text }], structuredContent });

function call(name, args) {
  try {
    if (name === 'search_products') {
      const found = searchProducts(args.query || '');
      return out(`Found ${found.length} products.`, { products: found });
    }
    if (name === 'add_to_cart') {
      const cart = cartView(addToCart(args.cartId, args.productId, args.quantity || 1));
      return out(`Cart updated. Cart ID: ${cart.id}`, { cart });
    }
    if (name === 'get_cart') return out('Cart loaded.', { cart: cartView(getCart(args.cartId)) });
    if (name === 'checkout_session') {
      const checkout = createCheckout(args.cartId);
      return out('Checkout ready in the Sean Shop view.', { checkout: { ...checkout, cart: cartView(getCart(args.cartId)) } });
    }
    if (name === 'complete_checkout') return out('Demo order confirmed.', { checkout: completeCheckout(args.checkoutId) });
    if (name === 'get_order_status') return out('Checkout status loaded.', { checkout: getCheckout(args.checkoutId) });
    throw new Error('Unknown tool');
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
}

const json = (response, status, value, headers = {}) => {
  response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...headers });
  response.end(JSON.stringify(value));
};
async function body(request) {
  let value = '';
  for await (const chunk of request) value += chunk;
  return value ? JSON.parse(value) : {};
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, base);
    if (url.pathname === '/mcp') {
      if (request.method !== 'POST') return json(response, 405, { error: 'POST only' }, { allow: 'POST' });
      const rpc = await body(request);
      const id = rpc.id ?? null;
      const headers = { 'mcp-protocol-version': '2025-06-18' };
      let result;
      if (rpc.method === 'initialize') result = { protocolVersion: '2025-06-18', capabilities: { tools: {}, resources: {} }, serverInfo: { name: 'sean-shop', version: '2.1.0' } };
      else if (rpc.method === 'tools/list') result = { tools };
      else if (rpc.method === 'resources/read' && rpc.params?.uri === checkoutUri) result = { contents: [{ uri: checkoutUri, mimeType: 'text/html;profile=mcp-app', text: widget, _meta: { ui: { prefersBorder: true, csp: { connectDomains: [base, tmxOrigin], resourceDomains: [base, tmxOrigin], frameDomains: [tmxOrigin] } } } }] };
      else if (rpc.method === 'tools/call') result = call(rpc.params?.name, rpc.params?.arguments || {});
      else return json(response, 200, { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }, headers);
      return json(response, 200, { jsonrpc: '2.0', id, result }, headers);
    }
    if (url.pathname === '/api/products') return json(response, 200, products);
    if (url.pathname === '/api/config') {
      return json(response, 200, { tmxDomain, tmxOrgId, tmxConfigured: /^[A-Za-z0-9]{8}$/.test(tmxOrgId) && tmxOrgId.toUpperCase() !== 'YOUR8CHR' });
    }
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root) || !fs.existsSync(file)) return json(response, 404, { error: 'Not found' });
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  } catch (error) {
    json(response, 500, { error: error.message });
  }
}).listen(port);
