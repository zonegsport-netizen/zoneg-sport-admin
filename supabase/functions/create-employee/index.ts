import{serve}from'https://deno.land/std@0.224.0/http/server.ts'
import{createClient}from'https://esm.sh/@supabase/supabase-js@2'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json'}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors})
const digits=(v:string)=>v.replace(/\D/g,'')
serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 try{
  const auth=req.headers.get('Authorization')||'',url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!
  const admin=createClient(url,service),client=createClient(url,anon,{global:{headers:{Authorization:auth}}})
  const{data:{user}}=await client.auth.getUser();if(!user)return json({error:'Phiên đăng nhập không hợp lệ.'},401)
  const{data:owner}=await admin.from('profiles').select('full_name,role,active').eq('id',user.id).single();if(owner?.role!=='owner'||!owner.active)return json({error:'Chỉ chủ cửa hàng được tạo nhân viên.'},403)
  const b=await req.json(),d=digits(String(b.phone||''));if(!/^0\d{9}$/.test(d))return json({error:'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.'},400)
  if(String(b.password||'').length<8)return json({error:'Mật khẩu phải có ít nhất 8 ký tự.'},400)
  if(!['manager','sales','warehouse'].includes(b.role))return json({error:'Vai trò không hợp lệ.'},400)
  const email=`${d}@staff.zoneg.io.vn`,phone=`+84${d.slice(1)}`
  const{data,error}=await admin.auth.admin.createUser({email,password:b.password,email_confirm:true,user_metadata:{full_name:b.full_name,phone}});if(error)return json({error:error.message},400)
  const{error:profileError}=await admin.from('profiles').upsert({id:data.user.id,full_name:String(b.full_name||'').trim(),phone,email,role:b.role,active:true,must_change_password:true,created_by:user.id,updated_at:new Date().toISOString()})
  if(profileError){await admin.auth.admin.deleteUser(data.user.id);return json({error:profileError.message},400)}
  await admin.from('activity_logs').insert({actor_id:user.id,actor_name:owner.full_name,action:'create_employee',entity_type:'employee',entity_id:data.user.id,description:`Tạo tài khoản ${b.full_name} - ${phone}`})
  return json({ok:true,id:data.user.id,login_phone:d})
 }catch(e){return json({error:e instanceof Error?e.message:'Có lỗi xảy ra.'},500)}
})
