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
const base = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
// Changing this URI forces ChatGPT to use the corrected MCP Apps resource.
const checkoutUri = 'ui://sean-shop/checkout-v2.html';

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
<html><body style="font:14px system-ui;padding:16px">
  <h2>Sean Shop checkout</h2><div id="order">Loading order…</div>
  <p id="tmx">Preparing ThreatMetrix device profiling…</p>
  <button id="confirm" disabled>Confirm demo order</button>
  <script>
    const order = document.querySelector('#order');
    const tmx = document.querySelector('#tmx');
    const confirm = document.querySelector('#confirm');
    const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
    let checkout;

    function render(result) {
      checkout = result?.structuredContent?.checkout || result?.checkout || window.openai?.toolOutput?.checkout;
      if (!checkout?.cart) {
        order.textContent = 'Checkout details are unavailable. Please reopen checkout from your cart.';
        return;
      }
      order.innerHTML = checkout.cart.items.map(i => '<p>' + i.name + ' × ' + i.quantity + ' — ' + fmt(i.lineTotalCents) + '</p>').join('') + '<hr><b>Total ' + fmt(checkout.cart.totalCents) + '</b>';
      confirm.disabled = false;
      startProfiling(checkout.sessionId);
    }

    async function startProfiling(sessionId) {
      try {
        const response = await fetch('${base}/api/config');
        if (!response.ok) throw new Error('Configuration request failed');
        const config = await response.json();
        if (!config.tmxConfigured) { tmx.textContent = 'TMX is not configured.'; return; }
        const script = document.createElement('script');
        script.src = '${base}/vendor/fp-clientlib-v6_0.js';
        script.onload = () => {
          try {
            window.tmx_profiling_complete = id => tmx.textContent = 'ThreatMetrix profiling complete: ' + id;
            threatmetrix.profile(config.tmxDomain, config.tmxOrgId, sessionId, 'checkout', threatmetrix.load_method.RUN_IMMEDIATE);
            tmx.textContent = 'ThreatMetrix profiling started.';
          } catch (_) { tmx.textContent = 'TMX profiling failed.'; }
        };
        script.onerror = () => tmx.textContent = 'TMX profiling library could not load.';
        document.head.append(script);
      } catch (_) { tmx.textContent = 'TMX profiling is unavailable.'; }
    }

    window.addEventListener('message', event => {
      if (event.source !== window.parent || !event.data || event.data.jsonrpc !== '2.0') return;
      if (event.data.method === 'ui/notifications/tool-result') render(event.data.params);
    });
    if (window.openai?.toolOutput) render({ checkout: window.openai.toolOutput.checkout });
    confirm.onclick = async () => {
      if (!checkout || !window.openai?.callTool) return;
      confirm.disabled = true;
      try {
        const result = await window.openai.callTool('complete_checkout', { checkoutId: checkout.id });
        confirm.textContent = result.content?.[0]?.text || 'Confirmed';
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
  response.writeHead(status, { 'content-type': 'application/json', ...headers });
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
      else if (rpc.method === 'resources/read' && rpc.params?.uri === checkoutUri) result = { contents: [{ uri: checkoutUri, mimeType: 'text/html;profile=mcp-app', text: widget, _meta: { ui: { prefersBorder: true, csp: { connectDomains: [base], resourceDomains: [base] } } } }] };
      else if (rpc.method === 'tools/call') result = call(rpc.params?.name, rpc.params?.arguments || {});
      else return json(response, 200, { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }, headers);
      return json(response, 200, { jsonrpc: '2.0', id, result }, headers);
    }
    if (url.pathname === '/api/products') return json(response, 200, products);
    if (url.pathname === '/api/config') {
      const orgId = process.env.TMX_ORG_ID || '';
      return json(response, 200, { tmxDomain: process.env.TMX_PROFILING_DOMAIN || 'h.online-metrix.net', tmxOrgId: orgId, tmxConfigured: /^[A-Za-z0-9]{8}$/.test(orgId) });
    }
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root) || !fs.existsSync(file)) return json(response, 404, { error: 'Not found' });
    response.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  } catch (error) {
    json(response, 500, { error: error.message });
  }
}).listen(port);
