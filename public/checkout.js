const id=new URLSearchParams(location.search).get('checkoutId');
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
async function profile(sessionId){
  const cfg=await fetch('/api/config').then(r=>r.json());
  if(cfg.tmxOrgId==='REPLACE8'){document.querySelector('#risk').textContent='Profiling skipped: set TMX_ORG_ID (exactly 8 characters) in .env.';return;}
  try{
    // Uploaded ThreatMetrix client exposes threatmetrix.profile(domain, orgId, sessionId, pageId, loadMethod).
    // RUN_IMMEDIATE starts profiling as soon as checkout loads instead of waiting for window.onload.
    window.threatmetrix.profile(cfg.tmxDomain,cfg.tmxOrgId,sessionId,'checkout',window.threatmetrix.load_method.RUN_IMMEDIATE);
    document.querySelector('#risk').textContent='Device profiling started for this checkout session.';
  }catch(e){document.querySelector('#risk').textContent='Profiling failed to initialize.';console.error(e);}
}
async function init(){const data=await fetch(`/api/checkout/${id}`).then(r=>r.json());const {checkout,cart}=data;
 document.querySelector('#items').innerHTML=cart.items.map(i=>`<div class="line"><span>${i.name} × ${i.quantity}</span><b>${money(i.lineTotalCents)}</b></div>`).join('');
 document.querySelector('#totals').innerHTML=`<div class="line"><span>Subtotal</span><b>${money(cart.subtotalCents)}</b></div><div class="line"><span>Tax</span><b>${money(cart.taxCents)}</b></div><div class="line"><span>Shipping</span><b>${money(cart.shippingCents)}</b></div><hr><div class="line"><span>Total</span><b>${money(cart.totalCents)}</b></div>`;
 await profile(checkout.sessionId);document.querySelector('#place').disabled=false;}
document.querySelector('#place').onclick=async()=>{const b=document.querySelector('#place');b.disabled=true;const r=await fetch(`/api/checkout/${id}/complete`,{method:'POST'});const d=await r.json();document.querySelector('#result').textContent=r.ok?`Order placed: ${d.orderNumber}`:(d.error||'Unable to place order');};init();
