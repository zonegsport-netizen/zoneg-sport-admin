import{serve}from'https://deno.land/std@0.224.0/http/server.ts'
import{createClient}from'https://esm.sh/@supabase/supabase-js@2'
serve(async req=>{
 const auth=req.headers.get('Authorization')||''
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
 const userClient=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}})
 const{data:{user}}=await userClient.auth.getUser()
 if(!user)return new Response(JSON.stringify({error:'Chưa đăng nhập'}),{status:401})
 const{data:p}=await admin.from('profiles').select('role,active').eq('id',user.id).single()
 if(p?.role!=='owner'||!p.active)return new Response(JSON.stringify({error:'Chỉ chủ cửa hàng được tạo nhân viên'}),{status:403})
 const body=await req.json()
 const{data,error}=await admin.auth.admin.createUser({phone:body.phone,password:body.password,phone_confirm:true,user_metadata:{full_name:body.full_name}})
 if(error)return new Response(JSON.stringify({error:error.message}),{status:400})
 await admin.from('profiles').update({full_name:body.full_name,phone:body.phone,role:body.role||'sales',active:true,must_change_password:true}).eq('id',data.user.id)
 return new Response(JSON.stringify({ok:true,id:data.user.id}),{headers:{'Content-Type':'application/json'}})
})
