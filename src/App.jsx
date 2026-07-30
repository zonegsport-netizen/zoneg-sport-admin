import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, BarChart3, Boxes, ChevronDown, CircleDollarSign, ClipboardList,
  Contact, Edit3, FileText, LayoutDashboard, LogOut, Menu, PackagePlus, Plus,
  RefreshCw, Search, Settings, ShieldCheck, ShoppingCart, Store, Tags, Trash2,
  Truck, UserCog, Users, X
} from 'lucide-react'
import { supabase, money, fmtDate } from './lib'

const ALL_NAV = [
  ['dashboard','Tổng quan',LayoutDashboard,['owner','manager','sales','warehouse']],
  ['products','Sản phẩm',Boxes,['owner','manager','sales','warehouse']],
  ['catalog','Danh mục & thương hiệu',Tags,['owner','manager']],
  ['inventory','Kho hàng',PackagePlus,['owner','manager','warehouse']],
  ['orders','Đơn hàng',ShoppingCart,['owner','manager','sales']],
  ['customers','Khách hàng',Users,['owner','manager','sales']],
  ['suppliers','Nhà cung cấp',Truck,['owner','manager','warehouse']],
  ['invoices','Hóa đơn',FileText,['owner','manager','sales']],
  ['reports','Báo cáo',BarChart3,['owner','manager']],
  ['employees','Nhân viên',UserCog,['owner']],
]
const ROLE_LABEL={owner:'Chủ cửa hàng',manager:'Quản lý',sales:'Bán hàng',warehouse:'Nhân viên kho'}
const EMPTY={products:[],variants:[],categories:[],brands:[],stockTransactions:[],orders:[],customers:[],suppliers:[],profiles:[]}
const STOCK_LABELS={in:'Nhập kho',out:'Xuất kho',adjust_in:'Điều chỉnh tăng',adjust_out:'Điều chỉnh giảm',return_in:'Khách trả hàng',return_supplier:'Trả nhà cung cấp'}

function Login({onLogin}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  async function submit(e){e.preventDefault();setBusy(true);setError('');const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)setError(error.message);else onLogin(data.session);setBusy(false)}
  return <div className="auth-layout"><section className="auth-brand"><div className="brand-logo xl">ZG</div><h1>ZoneG Sport Admin</h1><p>Kết nối thể thao Việt</p><div className="auth-benefits"><span><ShieldCheck size={18}/> Phân quyền theo vai trò</span><span><Store size={18}/> Quản lý tập trung</span><span><Boxes size={18}/> Kiểm soát tồn kho</span></div></section><form className="auth-card" onSubmit={submit}><span className="eyebrow">HỆ THỐNG QUẢN TRỊ NỘI BỘ</span><h2>Đăng nhập</h2><label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Mật khẩu<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="alert warning">{error}</div>}<button className="btn primary full" disabled={busy}>{busy?'Đang xử lý...':'Đăng nhập'}</button></form></div>
}

export default function App(){
  const [session,setSession]=useState(null),[loading,setLoading]=useState(true),[profile,setProfile]=useState(null)
  const [page,setPage]=useState('dashboard'),[mobile,setMobile]=useState(false),[query,setQuery]=useState('')
  const [data,setData]=useState(EMPTY),[syncing,setSyncing]=useState(false),[notice,setNotice]=useState(null),[modal,setModal]=useState(null)

  useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>sub.subscription.unsubscribe()},[])
  useEffect(()=>{if(!session)return;initialize();const tables=['profiles','products','product_variants','categories','brands','stock_transactions'];const channel=supabase.channel('zoneg-role-live');tables.forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table},()=>initialize(false)));channel.subscribe();return()=>supabase.removeChannel(channel)},[session])

  async function initialize(show=true){
    if(show)setSyncing(true)
    const {data:p,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle()
    if(error||!p){setNotice({type:'error',text:'Tài khoản chưa có hồ sơ phân quyền. Hãy chạy migration v1.2.1.'});setSyncing(false);return}
    if(!p.active){await supabase.auth.signOut();alert('Tài khoản đã bị khóa.');return}
    setProfile(p)
    await loadAll(p.role)
    setSyncing(false)
  }
  async function loadAll(role=profile?.role){
    const queries=[
      supabase.from('products').select('*').order('created_at',{ascending:false}),
      supabase.from('product_variants').select('*').order('created_at'),
      role&&['owner','manager'].includes(role)?supabase.from('categories').select('*').order('name'):Promise.resolve({data:[],error:null}),
      role&&['owner','manager'].includes(role)?supabase.from('brands').select('*').order('name'):Promise.resolve({data:[],error:null}),
      role&&['owner','manager','warehouse'].includes(role)?supabase.from('stock_transactions').select('*').order('created_at',{ascending:false}).limit(100):Promise.resolve({data:[],error:null}),
      role&&['owner','manager','sales'].includes(role)?supabase.from('orders').select('*').order('created_at',{ascending:false}):Promise.resolve({data:[],error:null}),
      role&&['owner','manager','sales'].includes(role)?supabase.from('customers').select('*').order('created_at',{ascending:false}):Promise.resolve({data:[],error:null}),
      role&&['owner','manager','warehouse'].includes(role)?supabase.from('suppliers').select('*').order('created_at',{ascending:false}):Promise.resolve({data:[],error:null}),
      role==='owner'?supabase.from('profiles').select('*').order('created_at'):Promise.resolve({data:[],error:null}),
    ]
    const r=await Promise.all(queries),err=r.find(x=>x.error)?.error
    if(err)toast('error',err.message);else setData({products:r[0].data||[],variants:r[1].data||[],categories:r[2].data||[],brands:r[3].data||[],stockTransactions:r[4].data||[],orders:r[5].data||[],customers:r[6].data||[],suppliers:r[7].data||[],profiles:r[8].data||[]})
  }
  function toast(type,text){setNotice({type,text});setTimeout(()=>setNotice(null),5000)}
  function can(...roles){return roles.includes(profile?.role)}
  function variantsOf(id){return data.variants.filter(v=>v.product_id===id)}
  async function safe(fn){try{await fn()}catch(e){toast('error',e.message||'Có lỗi xảy ra.')}}

  async function saveProduct(form,item){
    if(!can('owner','manager'))throw new Error('Bạn không có quyền sửa sản phẩm.')
    const cat=data.categories.find(x=>x.id===form.category_id),brand=data.brands.find(x=>x.id===form.brand_id)
    const payload={sku:form.sku.trim(),name:form.name.trim(),category_id:form.category_id||null,brand_id:form.brand_id||null,category:cat?.name||null,brand:brand?.name||null,price:Number(form.price||0),cost:Number(form.cost||0),min_stock:Number(form.min_stock||0),status:form.status,updated_at:new Date().toISOString()}
    const res=item?await supabase.from('products').update(payload).eq('id',item.id):await supabase.from('products').insert({...payload,stock:0})
    if(res.error)throw res.error;toast('success',item?'Đã cập nhật sản phẩm.':'Đã tạo sản phẩm.');await loadAll()
  }
  async function removeProduct(p){if(profile.role!=='owner')throw new Error('Chỉ chủ cửa hàng được xóa sản phẩm.');if(variantsOf(p.id).length)throw new Error('Hãy xóa biến thể trước.');if(!confirm(`Xóa "${p.name}"?`))return;const {error}=await supabase.from('products').delete().eq('id',p.id);if(error)throw error;await loadAll()}
  async function saveVariant(form,item){if(!can('owner','manager'))throw new Error('Bạn không có quyền sửa biến thể.');const payload={product_id:form.product_id,sku:form.sku.trim(),color:form.color||null,size:form.size||null,barcode:form.barcode||null,price:form.price===''?null:Number(form.price),cost:form.cost===''?null:Number(form.cost),min_stock:Number(form.min_stock||0),status:form.status,updated_at:new Date().toISOString()};const res=item?await supabase.from('product_variants').update(payload).eq('id',item.id):await supabase.from('product_variants').insert({...payload,stock:0});if(res.error)throw res.error;await loadAll()}
  async function removeVariant(v){if(profile.role!=='owner')throw new Error('Chỉ chủ cửa hàng được xóa biến thể.');if(Number(v.stock)!==0)throw new Error('Biến thể phải có tồn bằng 0.');if(!confirm(`Xóa ${v.sku}?`))return;const {error}=await supabase.from('product_variants').delete().eq('id',v.id);if(error)throw error;await loadAll()}
  async function saveLookup(type,form,item){if(!can('owner','manager'))throw new Error('Không có quyền.');const table=type==='category'?'categories':'brands',res=item?await supabase.from(table).update(form).eq('id',item.id):await supabase.from(table).insert(form);if(res.error)throw res.error;await loadAll()}
  async function removeLookup(type,item){if(profile.role!=='owner')throw new Error('Chỉ chủ cửa hàng được xóa.');const table=type==='category'?'categories':'brands';if(!confirm(`Xóa "${item.name}"?`))return;const {error}=await supabase.from(table).delete().eq('id',item.id);if(error)throw error;await loadAll()}
  async function adjustStock(form){if(!can('owner','manager','warehouse'))throw new Error('Không có quyền kho.');const {error}=await supabase.rpc('adjust_variant_stock',{p_variant_id:form.variant_id,p_type:form.type,p_quantity:Number(form.quantity),p_reference_code:form.reference_code||null,p_note:form.note||null});if(error)throw error;await loadAll();toast('success','Đã cập nhật kho.')}
  async function updateEmployee(emp,changes){if(profile.role!=='owner')throw new Error('Chỉ chủ cửa hàng được quản lý nhân viên.');if(emp.id===profile.id&&changes.active===false)throw new Error('Không thể tự khóa tài khoản chủ đang đăng nhập.');const {error}=await supabase.from('profiles').update({...changes,updated_at:new Date().toISOString()}).eq('id',emp.id);if(error)throw error;await loadAll();toast('success','Đã cập nhật nhân viên.')}

  const nav=ALL_NAV.filter(x=>x[3].includes(profile?.role))
  useEffect(()=>{if(profile&&!nav.some(x=>x[0]===page))setPage(nav[0]?.[0]||'products')},[profile,page])
  const low=useMemo(()=>data.variants.filter(v=>v.status==='active'&&Number(v.stock)<=Number(v.min_stock)),[data.variants])
  const revenue=useMemo(()=>data.orders.filter(o=>o.status==='completed').reduce((s,o)=>s+Number(o.total||0),0),[data.orders])
  const stockValue=useMemo(()=>can('owner','manager')?data.variants.reduce((s,v)=>{const p=data.products.find(x=>x.id===v.product_id);return s+Number(v.stock||0)*Number(v.cost??p?.cost??0)},0):0,[data,profile])

  if(loading)return <div className="splash">Đang khởi động...</div>
  if(!session)return <Login onLogin={setSession}/>
  if(!profile)return <div className="splash">Đang tải quyền tài khoản...</div>

  return <div className="app">
    <aside className={`sidebar ${mobile?'open':''}`}><div className="sidebar-brand"><div className="brand-logo">ZG</div><div><strong>ZoneG Sport</strong><small>{ROLE_LABEL[profile.role]} · v1.2.1</small></div><button className="icon mobile" onClick={()=>setMobile(false)}><X/></button></div><nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setMobile(false)}}><Icon size={19}/><span>{label}</span>{id==='inventory'&&low.length>0&&<b>{low.length}</b>}</button>)}</nav><div className="sidebar-bottom"><div className="sync-state">• {profile.full_name||profile.email}</div><button><Settings size={18}/> Cài đặt</button><button onClick={()=>supabase.auth.signOut()}><LogOut size={18}/> Đăng xuất</button></div></aside>
    <main><header className="topbar"><button className="icon mobile" onClick={()=>setMobile(true)}><Menu/></button><div><span className="eyebrow">HỆ THỐNG QUẢN TRỊ NỘI BỘ</span><h1>{nav.find(x=>x[0]===page)?.[1]}</h1></div><div className="topbar-right"><span className={`role-chip ${profile.role}`}>{ROLE_LABEL[profile.role]}</span><button className="btn" onClick={()=>initialize()}><RefreshCw size={17}/>{syncing?'Đang tải...':'Làm mới'}</button></div></header>
      <section className="content">{notice&&<div className={`alert ${notice.type==='error'?'warning':'info'}`}>{notice.text}</div>}
        {page==='dashboard'&&<Dashboard role={profile.role} data={data} low={low} revenue={revenue} stockValue={stockValue}/>}
        {page==='products'&&<Products data={data} query={query} setQuery={setQuery} role={profile.role} variantsOf={variantsOf} add={()=>setModal({type:'product'})} edit={p=>setModal({type:'product',item:p})} del={p=>safe(()=>removeProduct(p))} addV={p=>setModal({type:'variant',product:p})} editV={v=>setModal({type:'variant',item:v,product:data.products.find(p=>p.id===v.product_id)})} delV={v=>safe(()=>removeVariant(v))}/>}
        {page==='catalog'&&<Catalog data={data} addC={()=>setModal({type:'category'})} editC={x=>setModal({type:'category',item:x})} delC={x=>safe(()=>removeLookup('category',x))} addB={()=>setModal({type:'brand'})} editB={x=>setModal({type:'brand',item:x})} delB={x=>safe(()=>removeLookup('brand',x))}/>}
        {page==='inventory'&&<Inventory data={data} low={low} open={v=>setModal({type:'stock',item:v})}/>}
        {page==='orders'&&<BasicTable rows={data.orders}/>}
        {page==='customers'&&<Cards rows={data.customers}/>}
        {page==='suppliers'&&<Cards rows={data.suppliers}/>}
        {page==='invoices'&&<Placeholder title="Hóa đơn"/>}{page==='reports'&&<Placeholder title="Báo cáo"/>}
        {page==='employees'&&<Employees rows={data.profiles} current={profile} update={(e,c)=>safe(()=>updateEmployee(e,c))}/>}
      </section>
    </main>
    {modal&&<ModalRouter modal={modal} data={data} close={()=>setModal(null)} saveProduct={saveProduct} saveVariant={saveVariant} saveLookup={saveLookup} adjustStock={adjustStock}/>}
  </div>
}

function Dashboard({role,data,low,revenue,stockValue}){return <><div className="stats">{role!=='warehouse'&&<Stat title="Doanh thu hoàn thành" value={money(revenue)} note="Tổng đơn hoàn thành" tone="green"/>}{['owner','manager'].includes(role)&&<Stat title="Giá trị tồn kho" value={money(stockValue)} note="Theo giá nhập" tone="orange"/>}<Stat title="Mẫu / biến thể" value={`${data.products.length} / ${data.variants.length}`} note="Danh mục sản phẩm"/><Stat title="Cảnh báo tồn" value={low.length} note="Biến thể cần chú ý"/></div></>}
function Stat({title,value,note,tone=''}){return <div className={`stat ${tone}`}><span>{title}</span><strong>{value}</strong><small>{note}</small></div>}

function Products({data,query,setQuery,role,variantsOf,add,edit,del,addV,editV,delV}){
  const [expanded,setExpanded]=useState({}),rows=data.products.filter(p=>`${p.sku} ${p.name} ${p.category||''}`.toLowerCase().includes(query.toLowerCase())),canEdit=['owner','manager'].includes(role)
  return <><div className="toolbar"><div className="search-box wide"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm sản phẩm..."/></div>{canEdit&&<button className="btn primary" onClick={add}><Plus size={18}/> Thêm sản phẩm</button>}</div><div className="table-card"><table><thead><tr><th></th><th>Mã</th><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Tồn</th><th></th></tr></thead><tbody>{rows.map(p=>{const vs=variantsOf(p.id),open=expanded[p.id];return <React.Fragment key={p.id}><tr><td><button className="icon small" onClick={()=>setExpanded(x=>({...x,[p.id]:!open}))}><ChevronDown className={open?'rotated':''} size={17}/></button></td><td><code>{p.sku}</code></td><td><strong>{p.name}</strong><small>{p.brand||'—'} · {vs.length} biến thể</small></td><td>{p.category||'—'}</td><td>{money(p.price)}</td><td><b>{p.stock||0}</b></td><td>{canEdit&&<div className="actions"><button onClick={()=>addV(p)}><Plus size={15}/></button><button onClick={()=>edit(p)}><Edit3 size={15}/></button>{role==='owner'&&<button className="danger" onClick={()=>del(p)}><Trash2 size={15}/></button>}</div>}</td></tr>{open&&<tr className="variant-row"><td colSpan="7"><div className="variant-box">{vs.length?vs.map(v=><div className="variant-line" key={v.id}><span><code>{v.sku}</code> · {v.color||'—'} / {v.size||'—'}</span><span>Tồn: <b>{v.stock}</b></span>{canEdit&&<div className="actions"><button onClick={()=>editV(v)}><Edit3 size={15}/></button>{role==='owner'&&<button className="danger" onClick={()=>delV(v)}><Trash2 size={15}/></button>}</div>}</div>):<div>Chưa có biến thể.</div>}</div></td></tr>}</React.Fragment>})}</tbody></table></div></>
}

function Catalog({data,addC,editC,delC,addB,editB,delB}){return <div className="two-col"><Lookup title="Danh mục" rows={data.categories} add={addC} edit={editC} del={delC}/><Lookup title="Thương hiệu" rows={data.brands} add={addB} edit={editB} del={delB}/></div>}
function Lookup({title,rows,add,edit,del}){return <div className="panel"><div className="panel-head"><h3>{title}</h3><button className="btn mini primary" onClick={add}><Plus size={15}/> Thêm</button></div><div className="lookup-list">{rows.map(x=><div key={x.id}><strong>{x.name}</strong><div className="actions"><button onClick={()=>edit(x)}><Edit3 size={15}/></button><button className="danger" onClick={()=>del(x)}><Trash2 size={15}/></button></div></div>)}</div></div>}
function Inventory({data,low,open}){return <><div className="table-card"><table><thead><tr><th>Sản phẩm</th><th>Biến thể</th><th>SKU</th><th>Tồn</th><th>Tối thiểu</th><th></th></tr></thead><tbody>{data.variants.map(v=>{const p=data.products.find(x=>x.id===v.product_id);return <tr key={v.id} className={Number(v.stock)<=Number(v.min_stock)?'danger-row':''}><td>{p?.name}</td><td>{v.color||'—'} / {v.size||'—'}</td><td><code>{v.sku}</code></td><td><b>{v.stock}</b></td><td>{v.min_stock}</td><td><button className="btn mini primary" onClick={()=>open(v)}>Điều chỉnh kho</button></td></tr>})}</tbody></table></div><div className="panel history-panel"><div className="panel-head"><h3>Lịch sử kho</h3></div><div className="history-list">{data.stockTransactions.map(t=><div key={t.id}><span className={`move-icon ${Number(t.quantity)>=0?'in':'out'}`}>{Number(t.quantity)>=0?'+':'−'}</span><span className="history-main"><strong>{STOCK_LABELS[t.type]||t.type}</strong><small>{fmtDate(t.created_at)} · {t.reference_code||'Không có mã tham chiếu'}</small></span><span className="history-qty"><b>{t.quantity}</b><small>Tồn sau: {t.balance_after}</small></span></div>)}</div></div></>}
function Employees({rows,current,update}){return <><div className="employee-note"><ShieldCheck/><div><strong>Tạo tài khoản mới trong Supabase → Authentication → Users</strong><span>Sau khi tạo, tài khoản sẽ tự xuất hiện tại đây với vai trò Bán hàng.</span></div></div><div className="table-card"><table><thead><tr><th>Nhân viên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}><td><strong>{e.full_name||'Chưa đặt tên'}</strong>{e.id===current.id&&<small>Tài khoản hiện tại</small>}</td><td>{e.email||'—'}</td><td><select value={e.role} disabled={e.id===current.id&&e.role==='owner'} onChange={x=>update(e,{role:x.target.value})}>{Object.entries(ROLE_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td><td><label className="switch-line"><input type="checkbox" checked={e.active} disabled={e.id===current.id} onChange={x=>update(e,{active:x.target.checked})}/>{e.active?'Đang hoạt động':'Đã khóa'}</label></td></tr>)}</tbody></table></div></>}
function BasicTable({rows}){return <div className="table-card"><table><thead><tr><th>Mã</th><th>Khách hàng</th><th>Tổng</th><th>Ngày</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{x.code}</td><td>{x.customer_name}</td><td>{money(x.total)}</td><td>{fmtDate(x.created_at)}</td></tr>)}</tbody></table></div>}
function Cards({rows}){return <div className="cards">{rows.map(x=><div className="person-card" key={x.id}><div className="avatar"><Contact/></div><div><strong>{x.name}</strong><small>{x.phone||'—'}</small></div></div>)}</div>}
function Placeholder({title}){return <div className="placeholder"><ClipboardList size={48}/><h2>{title}</h2><p>Module đang tiếp tục hoàn thiện.</p></div>}

function ModalRouter({modal,data,close,saveProduct,saveVariant,saveLookup,adjustStock}){
  if(modal.type==='product')return <ProductModal item={modal.item} data={data} close={close} save={saveProduct}/>
  if(modal.type==='variant')return <VariantModal item={modal.item} product={modal.product} close={close} save={saveVariant}/>
  if(['category','brand'].includes(modal.type))return <LookupModal type={modal.type} item={modal.item} close={close} save={saveLookup}/>
  if(modal.type==='stock')return <StockModal variant={modal.item} data={data} close={close} save={adjustStock}/>
}
function BaseModal({title,close,submit,children}){const [busy,setBusy]=useState(false),[error,setError]=useState('');async function go(e){e.preventDefault();setBusy(true);setError('');try{await submit();close()}catch(x){setError(x.message)}finally{setBusy(false)}}return <div className="modal-backdrop"><form className="modal" onSubmit={go}><div className="modal-head"><div><span className="eyebrow">ZONEG SPORT ERP</span><h2>{title}</h2></div><button type="button" className="icon" onClick={close}><X/></button></div>{error&&<div className="alert warning">{error}</div>}{children}<div className="modal-actions"><button type="button" className="btn" onClick={close}>Hủy</button><button className="btn primary" disabled={busy}>{busy?'Đang lưu...':'Lưu dữ liệu'}</button></div></form></div>}
const Field=({label,value,set,type='text'})=><label>{label}<input type={type} value={value??''} onChange={e=>set(e.target.value)}/></label>
const Select=({label,value,set,options})=><label>{label}<select value={value||''} onChange={e=>set(e.target.value)}><option value="">— Chưa chọn —</option>{options.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
function ProductModal({item,data,close,save}){const [f,setF]=useState({sku:item?.sku||'',name:item?.name||'',category_id:item?.category_id||'',brand_id:item?.brand_id||'',price:item?.price||'',cost:item?.cost||'',min_stock:item?.min_stock||0,status:item?.status||'active'});return <BaseModal title={item?'Sửa sản phẩm':'Thêm sản phẩm'} close={close} submit={()=>save(f,item)}><div className="form-grid"><Field label="Mã *" value={f.sku} set={v=>setF({...f,sku:v})}/><Field label="Tên *" value={f.name} set={v=>setF({...f,name:v})}/></div><div className="form-grid"><Select label="Danh mục" value={f.category_id} set={v=>setF({...f,category_id:v})} options={data.categories}/><Select label="Thương hiệu" value={f.brand_id} set={v=>setF({...f,brand_id:v})} options={data.brands}/></div><div className="form-grid"><Field label="Giá bán" type="number" value={f.price} set={v=>setF({...f,price:v})}/><Field label="Giá nhập" type="number" value={f.cost} set={v=>setF({...f,cost:v})}/></div></BaseModal>}
function VariantModal({item,product,close,save}){const [f,setF]=useState({product_id:product.id,sku:item?.sku||'',color:item?.color||'',size:item?.size||'',barcode:item?.barcode||'',price:item?.price??'',cost:item?.cost??'',min_stock:item?.min_stock||0,status:item?.status||'active'});return <BaseModal title={item?'Sửa biến thể':'Thêm biến thể'} close={close} submit={()=>save(f,item)}><div className="form-grid"><Field label="SKU *" value={f.sku} set={v=>setF({...f,sku:v})}/><Field label="Mã vạch" value={f.barcode} set={v=>setF({...f,barcode:v})}/></div><div className="form-grid"><Field label="Màu" value={f.color} set={v=>setF({...f,color:v})}/><Field label="Size" value={f.size} set={v=>setF({...f,size:v})}/></div><div className="form-grid"><Field label="Giá bán riêng" type="number" value={f.price} set={v=>setF({...f,price:v})}/><Field label="Giá nhập riêng" type="number" value={f.cost} set={v=>setF({...f,cost:v})}/></div></BaseModal>}
function LookupModal({type,item,close,save}){const [name,setName]=useState(item?.name||'');return <BaseModal title={type==='category'?'Danh mục':'Thương hiệu'} close={close} submit={()=>save(type,{name,active:true},item)}><Field label="Tên *" value={name} set={setName}/></BaseModal>}
function StockModal({variant,data,close,save}){const [f,setF]=useState({variant_id:variant.id,type:'in',quantity:'',reference_code:'',note:''});return <BaseModal title="Điều chỉnh kho" close={close} submit={()=>save(f)}><div className="stock-summary"><strong>{data.products.find(p=>p.id===variant.product_id)?.name}</strong><span>{variant.sku} · Tồn hiện tại: {variant.stock}</span></div><div className="form-grid"><label>Loại<select value={f.type} onChange={e=>setF({...f,type:e.target.value})}>{Object.entries(STOCK_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><Field label="Số lượng *" type="number" value={f.quantity} set={v=>setF({...f,quantity:v})}/></div><Field label="Mã tham chiếu" value={f.reference_code} set={v=>setF({...f,reference_code:v})}/><Field label="Ghi chú" value={f.note} set={v=>setF({...f,note:v})}/></BaseModal>}
