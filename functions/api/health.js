export async function onRequestGet({env}) {
  try {
    if (!env.DB) throw new Error('Missing binding');
    await env.DB.prepare('SELECT 1').first();
    return Response.json({ok:true,database:'connected'},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({ok:false,database:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
