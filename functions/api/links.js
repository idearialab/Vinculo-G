const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function onRequest({request,env}){
try{
const now=Date.now(),db=env.DB,t=request.headers.get('Cookie')?.match(/(?:^|; )vg_session=([a-f0-9]{64})/)?.[1];
const u=t&&await db.prepare('SELECT u.id,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(t),now).first();
if(!u)return reply({error:'Sin sesión'},401);
if(request.method==='GET'){
const links=await db.prepare('SELECT r.id,r.created_at,u.display_name AS name FROM relationships r JOIN users u ON u.id=CASE WHEN r.dominant_id=? THEN r.submissive_id ELSE r.dominant_id END WHERE (r.dominant_id=? OR r.submissive_id=?) AND r.ended_at IS NULL').bind(u.id,u.id,u.id).all();
const invites=await db.prepare('SELECT code_hash AS id,expires_at FROM invitations WHERE creator_id=? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>?').bind(u.id,now).all();
return reply({ok:true,links:links.results,invites:invites.results});
}
if(request.method!=='POST'||request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Solicitud inválida'},403);
const b=await request.json();
if(b.action==='create'&&u.role==='dominant'){
const code=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
const expires=now+172800000;
const r=await db.prepare('INSERT INTO invitations(code_hash,creator_id,expires_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM invitations WHERE creator_id=? AND expires_at>? AND revoked_at IS NULL AND consumed_at IS NULL)<10').bind(await digest(code),u.id,expires,u.id,now).run();
return r.meta.changes?reply({ok:true,code,expires}):reply({error:'Máximo de 10 invitaciones activas'},429);
}
if(b.action==='revoke'){await db.prepare('UPDATE invitations SET revoked_at=? WHERE code_hash=? AND creator_id=? AND consumed_at IS NULL').bind(now,String(b.id),u.id).run();return reply({ok:true});}
if(b.action==='end'){await db.prepare('UPDATE relationships SET ended_at=? WHERE id=? AND (dominant_id=? OR submissive_id=?) AND ended_at IS NULL').bind(now,String(b.id),u.id,u.id).run();return reply({ok:true});}
if(['preview','accept'].includes(b.action)&&u.role==='submissive'){
const code=String(b.code||'').trim().toLowerCase();if(!/^[a-f0-9]{32}$/.test(code))return reply({error:'Código inválido'},400);
const h=await digest(code);
const inv=await db.prepare('SELECT i.creator_id,u.display_name AS name FROM invitations i JOIN users u ON u.id=i.creator_id WHERE i.code_hash=? AND i.expires_at>? AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND u.role=\'dominant\'').bind(h,now).first();
if(!inv)return reply({error:'Invitación no disponible'},404);
if(b.action==='preview')return reply({ok:true,name:inv.name});
if(b.confirm!==true)return reply({error:'Confirma tu aceptación'},400);
const id=crypto.randomUUID();
const result=await db.batch([db.prepare('INSERT OR IGNORE INTO relationships(id,dominant_id,submissive_id,invitation_hash,created_at) SELECT ?,creator_id,?,?,? FROM invitations WHERE code_hash=? AND expires_at>? AND consumed_at IS NULL AND revoked_at IS NULL').bind(id,u.id,h,now,h,now),db.prepare('UPDATE invitations SET consumed_at=? WHERE code_hash=? AND EXISTS(SELECT 1 FROM relationships WHERE id=?)').bind(now,h,id)]);
return result[0].meta.changes?reply({ok:true}):reply({error:'Invitación no disponible o vínculo existente'},409);
}
return reply({error:'Acción no permitida'},403);
}catch{return reply({error:'Servicio no disponible'},503);}
}
