import test from 'node:test';import assert from 'node:assert/strict';import {addToCart,cartView,createCheckout,recordProfiling,searchProducts} from '../src/store.js';
test('finds laptops',()=>assert.equal(searchProducts('laptop').length,3));
test('cart and checkout',()=>{const c=addToCart(undefined,'laptop-air-13',1),v=cartView(c);assert.equal(v.items.length,1);assert.ok(v.totalCents>79900);assert.equal(createCheckout(c.id).status,'pending')});
test('records a non-PII profiling lifecycle',()=>{const c=addToCart(undefined,'mouse-wireless',1),x=createCheckout(c.id);assert.equal(x.profiling.status,'not_started');assert.equal(recordProfiling(x.id,'started').profiling.status,'started')});
