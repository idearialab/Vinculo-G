const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const reply=(b,status=200)=>Response.json(b,{status,headers:{'Cache-Control':'no-store'}});
export async function onRequest({request,env}){try{
const db=env.DB,t=request.headers.get('Cookie')?.match(/(?:^|; )vg_session=([a-f0-9]{64})/)?.[1];
const u=t&&await db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').bind(await digest(t),Date.now()).first();
if(!u)return reply({error:'Sin sesión'},401);
if(request.method==='GET'){const profile=await db.prepare('SELECT bio,archetype,availability,exclusivity FROM personal_profiles WHERE user_id=?').bind(u.user_id).first();return reply({ok:true,profile:profile||{bio:'',archetype:'',availability:'',exclusivity:'undecided'}});}
if(request.method!=='POST'||request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Solicitud inválida'},403);
const b=await request.json();
if(typeof b.bio!=='string'||b.bio.length>2000||typeof b.archetype!=='string'||b.archetype.length>80||typeof b.availability!=='string'||b.availability.length>1000||!['undecided','exclusive','nonexclusive'].includes(b.exclusivity))return reply({error:'Datos inválidos'},400);
await db.prepare('INSERT INTO personal_profiles(user_id,bio,archetype,availability,exclusivity,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio,archetype=excluded.archetype,availability=excluded.availability,exclusivity=excluded.exclusivity,updated_at=excluded.updated_at').bind(u.user_id,b.bio,b.archetype,b.availability,b.exclusivity,Date.now()).run();return reply({ok:true});
}catch{return reply({error:'Servicio no disponible'},503);}}
