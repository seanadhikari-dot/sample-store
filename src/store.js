import { randomUUID } from 'node:crypto';
export const products=[
{id:'laptop-pro-14',name:'Aster Pro 14 Laptop',description:'Portable 14-inch productivity laptop with 16 GB RAM and 512 GB SSD.',category:'laptop',priceCents:109900,currency:'USD',inventory:12,image:'/images/laptop.svg',specs:{cpu:'8-core processor',ram:'16 GB',storage:'512 GB SSD',display:'14-inch 2.5K'}},
{id:'laptop-air-13',name:'Aster Air 13 Laptop',description:'Lightweight everyday laptop with long battery life.',category:'laptop',priceCents:79900,currency:'USD',inventory:20,image:'/images/laptop.svg',specs:{cpu:'6-core processor',ram:'16 GB',storage:'256 GB SSD',display:'13-inch FHD'}},
{id:'laptop-max-16',name:'Aster Max 16 Laptop',description:'High-performance 16-inch laptop for development and creative workloads.',category:'laptop',priceCents:179900,currency:'USD',inventory:7,image:'/images/laptop.svg',specs:{cpu:'12-core processor',ram:'32 GB',storage:'1 TB SSD',display:'16-inch 3K'}},
{id:'mouse-wireless',name:'Orbit Wireless Mouse',description:'Quiet rechargeable wireless mouse.',category:'accessory',priceCents:4900,currency:'USD',inventory:50,image:'/images/mouse.svg',specs:{connection:'Bluetooth / USB-C',battery:'Up to 60 days'}}];
const carts=new Map(),checkouts=new Map();
export const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export function searchProducts(query='',max){const q=query.toLowerCase();return products.filter(p=>(!q||`${p.name} ${p.description} ${p.category} ${Object.values(p.specs).join(' ')}`.toLowerCase().includes(q))&&(!max||p.priceCents<=max));}
export const getProduct=id=>products.find(p=>p.id===id);
export function addToCart(cartId,productId,quantity=1){const p=getProduct(productId);if(!p)throw Error('Product not found');if(quantity<1||quantity>p.inventory)throw Error('Invalid quantity or insufficient inventory');let c=cartId?carts.get(cartId):null;if(cartId&&!c)throw Error('Cart not found');if(!c){c={id:randomUUID(),items:[],updatedAt:new Date().toISOString()};carts.set(c.id,c)}const e=c.items.find(i=>i.productId===productId);if(e)e.quantity=Math.min(e.quantity+quantity,p.inventory);else c.items.push({productId,quantity});c.updatedAt=new Date().toISOString();return c;}
export const getCart=id=>carts.get(id);
export function cartView(c){const items=c.items.map(i=>{const p=getProduct(i.productId);return {...i,name:p.name,unitPriceCents:p.priceCents,lineTotalCents:p.priceCents*i.quantity}});const subtotalCents=items.reduce((s,i)=>s+i.lineTotalCents,0),taxCents=Math.round(subtotalCents*.06),shippingCents=subtotalCents>=10000?0:999;return{id:c.id,items,subtotalCents,taxCents,shippingCents,totalCents:subtotalCents+taxCents+shippingCents,currency:'USD'}}
<<<<<<< HEAD
export function createCheckout(cartId){const c=carts.get(cartId);if(!c||!c.items.length)throw Error('Cart is empty or missing');const x={id:randomUUID(),cartId,status:'pending',sessionId:randomUUID().replaceAll('-','').slice(0,32),createdAt:new Date().toISOString(),profiling:{provider:'threatmetrix',status:'not_started',updatedAt:null}};checkouts.set(x.id,x);return x}
export const getCheckout=id=>checkouts.get(id);
export function recordProfiling(id,status){const x=getCheckout(id);if(!x)throw Error('Checkout not found');if(!['started','complete','unavailable','failed'].includes(status))throw Error('Invalid profiling status');x.profiling.status=status;x.profiling.updatedAt=new Date().toISOString();return x}
=======
export function createCheckout(cartId){const c=carts.get(cartId);if(!c||!c.items.length)throw Error('Cart is empty or missing');const x={id:randomUUID(),cartId,status:'pending',sessionId:randomUUID().replaceAll('-','').slice(0,32),createdAt:new Date().toISOString()};checkouts.set(x.id,x);return x}
export const getCheckout=id=>checkouts.get(id);
>>>>>>> a210db5 (initial)
export function completeCheckout(id){const x=checkouts.get(id);if(!x)throw Error('Checkout not found');x.status='completed';return x}
