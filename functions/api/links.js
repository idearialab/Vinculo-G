const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function onRequest({request,env}){
try{
const now=Date.now(),db=env.DB,t=request.headers.get('Cookie')?.match(/(?:^|; )vg_session=([a-f0-9]{64})/)?.[1];
const u=t&&await db.prepare('SELECT u.id,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(t),now).first();
if(!u)return reply({error:'Sin sesión'},401);
if(request.method==='GET'){
const links=await db.prepare('SELECT r.id,r.created_at,u.display_name AS name,u.username AS nick FROM relationships r JOIN users u ON u.id=CASE WHEN r.dominant_id=? THEN r.submissive_id ELSE r.dominant_id END WHERE (r.dominant_id=? OR r.submissive_id=?) AND r.ended_at IS NULL').bind(u.id,u.id,u.id).all();
const invites=await db.prepare('SELECT code_hash AS id,expires_at FROM invitations WHERE creator_id=? AND consumed_at IS NULL AND rejected_at IS NULL AND revoked_at IS NULL AND expires_at>?').bind(u.id,now).all();
const plan=await db.prepare('SELECT p.id,p.name,p.max_relationships,s.available_credits,s.purchased_credits FROM user_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id WHERE s.user_id=?').bind(u.id).first();
return reply({ok:true,role:u.role,plan,links:links.results,invites:invites.results});
}
if(request.method!=='POST'||request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Solicitud inválida'},403);
const b=await request.json();
if(b.action==='create'&&u.role==='dominant'){
const code=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
const expires=now+172800000;
const h=await digest(code);
const result=await db.batch([
db.prepare(`INSERT INTO invitations(code_hash,creator_id,expires_at,credit_source) SELECT ?,s.user_id,?,CASE WHEN p.id='founder' THEN 'founder' WHEN s.available_credits>0 THEN 'plan' ELSE 'purchased' END FROM user_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id WHERE s.user_id=? AND (p.id='founder' OR s.available_credits>0 OR s.purchased_credits>0) AND (SELECT COUNT(*) FROM invitations WHERE creator_id=s.user_id AND expires_at>? AND revoked_at IS NULL AND consumed_at IS NULL AND rejected_at IS NULL)<10 AND (p.max_relationships=-1 OR (SELECT COUNT(*) FROM relationships WHERE dominant_id=s.user_id AND ended_at IS NULL)<p.max_relationships)`).bind(h,expires,u.id,now),
db.prepare(`UPDATE user_subscriptions SET available_credits=available_credits-CASE WHEN (SELECT credit_source FROM invitations WHERE code_hash=?)='plan' THEN 1 ELSE 0 END,purchased_credits=purchased_credits-CASE WHEN (SELECT credit_source FROM invitations WHERE code_hash=?)='purchased' THEN 1 ELSE 0 END WHERE user_id=? AND EXISTS(SELECT 1 FROM invitations WHERE code_hash=?)`).bind(h,h,u.id,h)]);
return result[0].meta.changes?reply({ok:true,code,expires}):reply({error:'Límite de invitaciones, vínculos o créditos alcanzado'},409);
}
if(b.action==='revoke'){const result=await db.prepare('UPDATE invitations SET revoked_at=? WHERE code_hash=? AND creator_id=? AND consumed_at IS NULL AND rejected_at IS NULL AND revoked_at IS NULL AND expires_at>?').bind(now,String(b.id),u.id,now).run();return result.meta.changes?reply({ok:true}):reply({error:'Invitación no disponible'},404);}
if(b.action==='end'){const result=await db.prepare('UPDATE relationships SET ended_at=? WHERE id=? AND (dominant_id=? OR submissive_id=?) AND ended_at IS NULL').bind(now,String(b.id),u.id,u.id).run();return result.meta.changes?reply({ok:true}):reply({error:'Vínculo no disponible'},404);}
if(['preview','accept','reject'].includes(b.action)&&u.role==='submissive'){
const code=String(b.code||'').trim().toLowerCase();if(!/^[a-f0-9]{32}$/.test(code))return reply({error:'Código inválido'},400);
const h=await digest(code);
const inv=await db.prepare('SELECT i.creator_id,u.display_name AS name FROM invitations i JOIN users u ON u.id=i.creator_id WHERE i.code_hash=? AND i.expires_at>? AND i.consumed_at IS NULL AND i.rejected_at IS NULL AND i.revoked_at IS NULL AND u.role=\'dominant\'').bind(h,now).first();
if(!inv)return reply({error:'Invitación no disponible'},404);
if(b.action==='preview')return reply({ok:true,name:inv.name});
if(b.action==='reject'){
const result=await db.batch([
db.prepare('UPDATE invitations SET rejected_at=?,rejected_by=? WHERE code_hash=? AND expires_at>? AND consumed_at IS NULL AND revoked_at IS NULL AND rejected_at IS NULL').bind(now,u.id,h,now),
db.prepare(`UPDATE user_subscriptions SET available_credits=available_credits+CASE WHEN (SELECT credit_source FROM invitations WHERE code_hash=?)='plan' AND available_credits>=0 THEN 1 ELSE 0 END,purchased_credits=purchased_credits+CASE WHEN (SELECT credit_source FROM invitations WHERE code_hash=?)='purchased' THEN 1 ELSE 0 END WHERE user_id=(SELECT creator_id FROM invitations WHERE code_hash=? AND rejected_by=? AND credit_refunded=0 AND rejected_at IS NOT NULL)`).bind(h,h,h,u.id),
db.prepare('UPDATE invitations SET credit_refunded=1 WHERE code_hash=? AND rejected_by=? AND rejected_at IS NOT NULL AND credit_refunded=0').bind(h,u.id)]);
return result[0].meta.changes?reply({ok:true}):reply({error:'Invitación no disponible'},409);
}
if(b.confirm!==true)return reply({error:'Confirma tu aceptación'},400);
const id=crypto.randomUUID();
const result=await db.batch([db.prepare('INSERT OR IGNORE INTO relationships(id,dominant_id,submissive_id,invitation_hash,created_at) SELECT ?,creator_id,?,?,? FROM invitations WHERE code_hash=? AND expires_at>? AND consumed_at IS NULL AND rejected_at IS NULL AND revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM relationships WHERE submissive_id=? AND ended_at IS NULL) AND EXISTS(SELECT 1 FROM user_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id WHERE s.user_id=invitations.creator_id AND (p.max_relationships=-1 OR (SELECT COUNT(*) FROM relationships WHERE dominant_id=s.user_id AND ended_at IS NULL)<p.max_relationships))').bind(id,u.id,h,now,h,now,u.id),db.prepare('UPDATE invitations SET consumed_at=? WHERE code_hash=? AND EXISTS(SELECT 1 FROM relationships WHERE id=?)').bind(now,h,id)]);
return result[0].meta.changes?reply({ok:true}):reply({error:'Invitación no disponible o vínculo existente'},409);
}
return reply({error:'Acción no permitida'},403);
}catch{return reply({error:'Servicio no disponible'},503);}
}
