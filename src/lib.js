import { createClient } from '@supabase/supabase-js'
export const supabase=createClient(import.meta.env.VITE_SUPABASE_URL||'',import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})
export const money=v=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(v||0))
export const fmtDate=v=>v?new Date(v).toLocaleString('vi-VN'):'—'
export const normalizePhone=value=>{let s=(value||'').replace(/\D/g,'');if(s.startsWith('84'))return `+${s}`;if(s.startsWith('0'))return `+84${s.slice(1)}`;return value.startsWith('+')?value:`+${s}`}
