import{serve}from'https://deno.land/std@0.224.0/http/server.ts'
import{createClient}from'https://esm.sh/@supabase/supabase-js@2'
serve(async req=>{
 const auth=req.headers.get('Authorization')||''
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
 const userClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}})
 const{data:{user}}=await userClient.auth.getUser()
 const{data:p}=await admin.from('profiles').select('role').eq('id',user?.id).single()
 if(p?.role!=='owner')return new Response(JSON.stringify({error:'Không có quyền'}),{status:403})
 const b=await req.json()
 const{error}=await admin.auth.admin.updateUserById(b.user_id,{password:b.password})
 if(error)return new Response(JSON.stringify({error:error.message}),{status:400})
 await admin.from('profiles').update({must_change_password:true}).eq('id',b.user_id)
 return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}})
})
