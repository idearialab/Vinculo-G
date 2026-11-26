const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
async function hash(p,s){const k=await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(s),iterations:100000,hash:'SHA-256'},k,256));}
const reply=(body,status=200,cookie)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function onRequestPost({request,env}){
if(request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Origen inválido'},403);
try{
const b=await request.json();
if(b.action==='logout'){const t=request.headers.get('Cookie')?.match(/(?:^|; )vg_session=([a-f0-9]{64})/)?.[1];if(t)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(t)).run();return reply({ok:true},200,'vg_session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');}
const email=String(b.email||'').trim().toLowerCase(),p=String(b.password||'');
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||p.length<12||p.length>128)return reply({error:'Correo o contraseña inválidos'},400);
let u;
if(b.action==='register'){
const name=String(b.name||'').trim();if(!name||name.length>80||b.adult!==true||!['dominant','submissive'].includes(b.role))return reply({error:'Datos inválidos'},400);
const salt=random(),id=crypto.randomUUID();
try{await env.DB.prepare('INSERT INTO users(id,email,display_name,role,password_hash,password_salt,adult_confirmed) VALUES(?,?,?,?,?,?,1)').bind(id,email,name,b.role,await hash(p,salt),salt).run();}catch{return reply({error:'No se pudo registrar la cuenta'},400);}
u={id,display_name:name,role:b.role,is_founder:0};
}else if(b.action==='login'){
u=await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
const h=await hash(p,u?.password_salt||'dummy');
if(!u||h!==u.password_hash)return reply({error:'Credenciales inválidas'},401);
}else return reply({error:'Acción inválida'},400);
const token=random();await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(token),u.id,Date.now()+86400000).run();
return reply({ok:true,name:u.display_name,role:u.role,founder:!!u.is_founder},200,'vg_session='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400');
}catch{return reply({error:'Servicio no disponible'},503);}
}
export async function onRequestGet({request,env}){try{const t=request.headers.get('Cookie')?.match(/(?:^|; )vg_session=([a-f0-9]{64})/)?.[1];if(!t)return reply({error:'Sin sesión'},401);const u=await env.DB.prepare('SELECT u.display_name,u.role,u.is_founder FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(t),Date.now()).first();return u?reply({ok:true,name:u.display_name,role:u.role,founder:!!u.is_founder}):reply({error:'Sin sesión'},401);}catch{return reply({error:'Servicio no disponible'},503);}}
