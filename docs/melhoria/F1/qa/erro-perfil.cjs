/** E10 (F1): mede quanto tempo o app fica em branco quando o perfil falha (503) ou sem rede. Uso: NODE_PATH=/opt/node22/lib/node_modules node erro-perfil.cjs <pasta-com-web-fake-e-capturas> */
const path=require('path');const {chromium}=require('playwright');
const {serve}=require(path.resolve(__dirname,'../../../../apps/mobile/e2e-web/serve.cjs'));
const S=process.argv[2];const UID='00000000-0000-4000-8000-00000000d3e0';const NOW=Math.floor(Date.now()/1000);
const b=(o)=>Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT=`${b({alg:'HS256'})}.${b({sub:UID,exp:NOW+86400,role:'authenticated'})}.x`;
const SESSION={access_token:JWT,token_type:'bearer',expires_in:86400,expires_at:NOW+86400,refresh_token:'r',user:{id:UID,aud:'authenticated',email:'demonstracao@exemplo.invalid'}};
(async()=>{const srv=await serve(S+'/web-fake',8193);const br=await chromium.launch();
for (const mode of ['503','offline']) {
const ctx=await br.newContext({viewport:{width:390,height:844}});
await ctx.addInitScript((s)=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),SESSION);
const t0=Date.now();const log=[];
await ctx.route(u=>!/^http:\/\/127\.0\.0\.1:8193/.test(u.toString()),r=>{const u=r.request().url(); log.push(((Date.now()-t0)/1000).toFixed(1)+'s '+u.replace('http://127.0.0.1:54399','').slice(0,60)); if(!u.startsWith('http://127.0.0.1:54399')) return r.abort(); if(mode==='offline') return r.abort('internetdisconnected'); return r.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:'{"message":"Service Unavailable"}'});});
const p=await ctx.newPage();await p.goto('http://127.0.0.1:8193/');
let seen=null;for(let i=0;i<40;i++){await p.waitForTimeout(500);const t=await p.evaluate(()=>document.body.innerText.trim().slice(0,80));if(t){seen={t:((Date.now()-t0)/1000).toFixed(1),text:t};break;}}
console.log(mode, JSON.stringify(seen)); console.log(log.slice(0,12).join('\n'));
await p.screenshot({path:S+`/capturas/inicio__erro-perfil-${mode}-20s__390.png`});await ctx.close();}
await br.close();srv.close();})();
