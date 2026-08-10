import test from 'node:test';import assert from 'node:assert/strict';import {addToCart,cartView,createCheckout,searchProducts} from '../src/store.js';
test('finds laptops',()=>assert.equal(searchProducts('laptop').length,3));
test('cart and checkout',()=>{const c=addToCart(undefined,'laptop-air-13',1),v=cartView(c);assert.equal(v.items.length,1);assert.ok(v.totalCents>79900);assert.equal(createCheckout(c.id).status,'pending')});
