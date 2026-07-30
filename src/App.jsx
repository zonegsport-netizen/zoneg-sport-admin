import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, BarChart3, Boxes, ChevronDown, CircleDollarSign, ClipboardList,
  Contact, Edit3, FileText, LayoutDashboard, LogOut, Menu, PackagePlus, Plus,
  RefreshCw, Search, Settings, ShoppingCart, Store, Tags, Trash2, Truck,
  Users, X
} from 'lucide-react'
import { supabase, money, fmtDate } from './lib'

const NAV = [
  ['dashboard','Tổng quan',LayoutDashboard],
  ['products','Sản phẩm',Boxes],
  ['catalog','Danh mục & thương hiệu',Tags],
  ['inventory','Kho hàng',PackagePlus],
  ['orders','Đơn hàng',ShoppingCart],
  ['customers','Khách hàng',Users],
  ['suppliers','Nhà cung cấp',Truck],
  ['invoices','Hóa đơn',FileText],
  ['reports','Báo cáo',BarChart3],
]

const EMPTY = {
  products: [], variants: [], categories: [], brands: [],
  stockTransactions: [], orders: [], customers: [], suppliers: []
}

const STOCK_LABELS = {
  in:'Nhập kho', out:'Xuất kho', adjust_in:'Điều chỉnh tăng',
  adjust_out:'Điều chỉnh giảm', return_in:'Khách trả hàng',
  return_supplier:'Trả nhà cung cấp'
}

function Login({onLogin}) {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  async function submit(e){
    e.preventDefault(); setBusy(true); setError('')
    const {data,error}=await supabase.auth.signInWithPassword({email,password})
    if(error) setError(error.message); else onLogin(data.session)
    setBusy(false)
  }
  return <div className="auth-layout">
    <section className="auth-brand">
      <div className="brand-logo xl">ZG</div><h1>ZoneG Sport Admin</h1>
      <p>Kết nối thể thao Việt</p>
      <div className="auth-benefits">
        <span><Store size={18}/> Quản lý tập trung</span>
        <span><CircleDollarSign size={18}/> Theo dõi doanh thu</span>
        <span><Boxes size={18}/> Kiểm soát tồn kho</span>
      </div>
    </section>
    <form className="auth-card" onSubmit={submit}>
      <span className="eyebrow">HỆ THỐNG QUẢN TRỊ NỘI BỘ</span><h2>Đăng nhập</h2>
      <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Mật khẩu<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
      {error&&<div className="alert warning">{error}</div>}
      <button className="btn primary full" disabled={busy}>{busy?'Đang xử lý...':'Đăng nhập'}</button>
    </form>
  </div>
}

export default function App(){
  const [session,setSession]=useState(null)
  const [loading,setLoading]=useState(true)
  const [page,setPage]=useState('dashboard')
  const [mobile,setMobile]=useState(false)
  const [query,setQuery]=useState('')
  const [data,setData]=useState(EMPTY)
  const [syncing,setSyncing]=useState(false)
  const [notice,setNotice]=useState(null)
  const [modal,setModal]=useState(null)

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)})
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s))
    return ()=>sub.subscription.unsubscribe()
  },[])

  useEffect(()=>{
    if(!session) return
    loadAll()
    const tables=['products','product_variants','categories','brands','stock_transactions']
    const channel=supabase.channel('zoneg-v12')
    tables.forEach(table=>channel.on('postgres_changes',{event:'*',schema:'public',table},()=>loadAll(false)))
    channel.subscribe()
    return ()=>supabase.removeChannel(channel)
  },[session])

  async function loadAll(show=true){
    if(show) setSyncing(true)
    const results=await Promise.all([
      supabase.from('products').select('*').order('created_at',{ascending:false}),
      supabase.from('product_variants').select('*').order('created_at',{ascending:true}),
      supabase.from('categories').select('*').order('name'),
      supabase.from('brands').select('*').order('name'),
      supabase.from('stock_transactions').select('*').order('created_at',{ascending:false}).limit(100),
      supabase.from('orders').select('*').order('created_at',{ascending:false}),
      supabase.from('customers').select('*').order('created_at',{ascending:false}),
      supabase.from('suppliers').select('*').order('created_at',{ascending:false}),
    ])
    const err=results.find(x=>x.error)?.error
    if(err) toast('error',`Không thể tải dữ liệu: ${err.message}`)
    else setData({
      products:results[0].data||[], variants:results[1].data||[],
      categories:results[2].data||[], brands:results[3].data||[],
      stockTransactions:results[4].data||[], orders:results[5].data||[],
      customers:results[6].data||[], suppliers:results[7].data||[]
    })
    setSyncing(false)
  }

  function toast(type,text){setNotice({type,text});setTimeout(()=>setNotice(null),5000)}
  function variantsOf(productId){return data.variants.filter(v=>v.product_id===productId)}

  async function saveProduct(form,editing){
    const cat=data.categories.find(x=>x.id===form.category_id)
    const brand=data.brands.find(x=>x.id===form.brand_id)
    const payload={
      sku:form.sku.trim(), name:form.name.trim(),
      category_id:form.category_id||null, brand_id:form.brand_id||null,
      category:cat?.name||null, brand:brand?.name||null,
      price:Number(form.price||0), cost:Number(form.cost||0),
      min_stock:Number(form.min_stock||0), status:form.status||'active',
      updated_at:new Date().toISOString()
    }
    let result
    if(editing) result=await supabase.from('products').update(payload).eq('id',editing.id).select().single()
    else result=await supabase.from('products').insert({...payload,stock:0}).select().single()
    if(result.error) throw result.error
    toast('success',editing?'Đã cập nhật sản phẩm.':'Đã tạo sản phẩm.')
    await loadAll(false)
  }

  async function removeProduct(product){
    if(variantsOf(product.id).length) throw new Error('Hãy xóa các biến thể trước khi xóa sản phẩm.')
    if(!confirm(`Xóa sản phẩm "${product.name}"?`)) return
    const {error}=await supabase.from('products').delete().eq('id',product.id)
    if(error) throw error
    toast('success','Đã xóa sản phẩm.'); await loadAll(false)
  }

  async function saveVariant(form,editing){
    const product=data.products.find(p=>p.id===form.product_id)
    const payload={
      product_id:form.product_id, sku:form.sku.trim(),
      color:form.color.trim()||null, size:form.size.trim()||null,
      barcode:form.barcode.trim()||null,
      price:form.price===''?null:Number(form.price),
      cost:form.cost===''?null:Number(form.cost),
      min_stock:Number(form.min_stock||0), status:form.status||'active',
      updated_at:new Date().toISOString()
    }
    let result
    if(editing) result=await supabase.from('product_variants').update(payload).eq('id',editing.id).select().single()
    else result=await supabase.from('product_variants').insert({...payload,stock:0}).select().single()
    if(result.error) throw result.error
    toast('success',editing?'Đã cập nhật biến thể.':`Đã thêm biến thể cho ${product?.name||'sản phẩm'}.`)
    await loadAll(false)
  }

  async function removeVariant(v){
    if(Number(v.stock)!==0) throw new Error('Chỉ được xóa biến thể có tồn kho bằng 0.')
    if(!confirm(`Xóa biến thể ${v.sku}?`)) return
    const {error}=await supabase.from('product_variants').delete().eq('id',v.id)
    if(error) throw error
    toast('success','Đã xóa biến thể.'); await loadAll(false)
  }

  async function saveLookup(type,form,editing){
    const table=type==='category'?'categories':'brands'
    const payload={name:form.name.trim(),active:form.active}
    const result=editing
      ? await supabase.from(table).update(payload).eq('id',editing.id)
      : await supabase.from(table).insert(payload)
    if(result.error) throw result.error
    toast('success',`Đã lưu ${type==='category'?'danh mục':'thương hiệu'}.`)
    await loadAll(false)
  }

  async function removeLookup(type,item){
    const table=type==='category'?'categories':'brands'
    const field=type==='category'?'category_id':'brand_id'
    if(data.products.some(p=>p[field]===item.id)) throw new Error('Mục này đang được sản phẩm sử dụng, không thể xóa.')
    if(!confirm(`Xóa "${item.name}"?`)) return
    const {error}=await supabase.from(table).delete().eq('id',item.id)
    if(error) throw error
    toast('success','Đã xóa.'); await loadAll(false)
  }

  async function adjustStock(form){
    const {error}=await supabase.rpc('adjust_variant_stock',{
      p_variant_id:form.variant_id,p_type:form.type,
      p_quantity:Number(form.quantity),
      p_reference_code:form.reference_code||null,p_note:form.note||null
    })
    if(error) throw error
    toast('success','Đã cập nhật tồn kho và ghi lịch sử giao dịch.')
    await loadAll(false)
  }

  const lowVariants=useMemo(()=>data.variants.filter(v=>v.status==='active'&&Number(v.stock)<=Number(v.min_stock)),[data.variants])
  const stockValue=useMemo(()=>data.variants.reduce((s,v)=>{
    const p=data.products.find(x=>x.id===v.product_id)
    return s+Number(v.stock||0)*Number(v.cost??p?.cost??0)
  },0),[data])
  const revenue=useMemo(()=>data.orders.filter(o=>o.status==='completed').reduce((s,o)=>s+Number(o.total||0),0),[data.orders])

  if(loading) return <div className="splash">Đang khởi động ZoneG Sport...</div>
  if(!session) return <Login onLogin={setSession}/>

  return <div className="app">
    <aside className={`sidebar ${mobile?'open':''}`}>
      <div className="sidebar-brand"><div className="brand-logo">ZG</div>
        <div><strong>ZoneG Sport</strong><small>ERP v1.2</small></div>
        <button className="icon mobile" onClick={()=>setMobile(false)}><X/></button>
      </div>
      <nav>{NAV.map(([id,label,Icon])=><button key={id} className={page===id?'active':''}
        onClick={()=>{setPage(id);setMobile(false)}}>
        <Icon size={19}/><span>{label}</span>{id==='inventory'&&lowVariants.length>0&&<b>{lowVariants.length}</b>}
      </button>)}</nav>
      <div className="sidebar-bottom">
        <div className="sync-state">• Đã đồng bộ Cloud</div>
        <button><Settings size={18}/> Cài đặt</button>
        <button onClick={()=>supabase.auth.signOut()}><LogOut size={18}/> Đăng xuất</button>
      </div>
    </aside>
    <main>
      <header className="topbar">
        <button className="icon mobile" onClick={()=>setMobile(true)}><Menu/></button>
        <div><span className="eyebrow">HỆ THỐNG QUẢN TRỊ NỘI BỘ</span><h1>{NAV.find(x=>x[0]===page)?.[1]}</h1></div>
        <div className="topbar-right"><button className="btn" onClick={()=>loadAll()}><RefreshCw size={17}/>{syncing?'Đang tải...':'Làm mới'}</button></div>
      </header>
      <section className="content">
        {notice&&<div className={`alert ${notice.type==='error'?'warning':'info'}`}>{notice.text}</div>}
        {page==='dashboard'&&<Dashboard data={data} low={lowVariants} revenue={revenue} stockValue={stockValue} setPage={setPage}/>}
        {page==='products'&&<ProductsPage data={data} query={query} setQuery={setQuery} variantsOf={variantsOf}
          onAdd={()=>setModal({type:'product'})}
          onEdit={p=>setModal({type:'product',item:p})}
          onDelete={p=>safe(()=>removeProduct(p))}
          onAddVariant={p=>setModal({type:'variant',product:p})}
          onEditVariant={v=>setModal({type:'variant',item:v,product:data.products.find(p=>p.id===v.product_id)})}
          onDeleteVariant={v=>safe(()=>removeVariant(v))}/>}
        {page==='catalog'&&<CatalogPage data={data}
          addCategory={()=>setModal({type:'category'})} editCategory={x=>setModal({type:'category',item:x})}
          deleteCategory={x=>safe(()=>removeLookup('category',x))}
          addBrand={()=>setModal({type:'brand'})} editBrand={x=>setModal({type:'brand',item:x})}
          deleteBrand={x=>safe(()=>removeLookup('brand',x))}/>}
        {page==='inventory'&&<InventoryPage data={data} low={lowVariants}
          openAdjust={v=>setModal({type:'stock',item:v})}/>}
        {page==='orders'&&<SimpleTable rows={data.orders} type="orders"/>}
        {page==='customers'&&<Directory rows={data.customers} icon={Contact}/>}
        {page==='suppliers'&&<Directory rows={data.suppliers} icon={Truck}/>}
        {page==='invoices'&&<Placeholder title="Hóa đơn" text="Module hóa đơn sẽ được hoàn thiện ở v1.3."/>}
        {page==='reports'&&<Placeholder title="Báo cáo" text="Module báo cáo chi tiết sẽ được hoàn thiện ở v1.3."/>}
      </section>
    </main>
    {modal&&<ModalRouter modal={modal} data={data} close={()=>setModal(null)}
      saveProduct={saveProduct} saveVariant={saveVariant} saveLookup={saveLookup} adjustStock={adjustStock}/>}
  </div>

  async function safe(fn){try{await fn()}catch(e){toast('error',e.message||'Có lỗi xảy ra.')}}
}

function Dashboard({data,low,revenue,stockValue,setPage}){
  return <>
    {low.length>0&&<div className="attention"><AlertTriangle/><div><strong>{low.length} biến thể cần chú ý</strong><span>Tồn kho bằng hoặc thấp hơn mức tối thiểu.</span></div><button onClick={()=>setPage('inventory')}>Kiểm tra kho</button></div>}
    <div className="stats">
      <Stat title="Doanh thu hoàn thành" value={money(revenue)} note="Tổng đơn hoàn thành" tone="green"/>
      <Stat title="Giá trị tồn kho" value={money(stockValue)} note="Theo giá nhập biến thể" tone="orange"/>
      <Stat title="Mẫu / biến thể" value={`${data.products.length} / ${data.variants.length}`} note="Danh mục sản phẩm"/>
      <Stat title="Cảnh báo tồn" value={low.length} note="Biến thể cần nhập thêm"/>
    </div>
    <div className="two-col">
      <Panel title="Giao dịch kho gần đây">
        <StockHistory rows={data.stockTransactions.slice(0,8)} data={data}/>
      </Panel>
      <Panel title="Tồn kho thấp">
        <div className="list">{low.slice(0,8).map(v=>{
          const p=data.products.find(x=>x.id===v.product_id)
          return <div key={v.id}><span><strong>{p?.name}</strong><small>{v.color||'—'} / {v.size||'—'} · {v.sku}</small></span><span className="stock-alert">{v.stock}</span></div>
        })}</div>
      </Panel>
    </div>
  </>
}
function Stat({title,value,note,tone=''}){return <div className={`stat ${tone}`}><span>{title}</span><strong>{value}</strong><small>{note}</small></div>}
function Panel({title,children}){return <div className="panel"><div className="panel-head"><h3>{title}</h3></div>{children}</div>}

function ProductsPage({data,query,setQuery,variantsOf,onAdd,onEdit,onDelete,onAddVariant,onEditVariant,onDeleteVariant}){
  const [expanded,setExpanded]=useState({})
  const rows=data.products.filter(p=>`${p.sku} ${p.name} ${p.category||''} ${p.brand||''}`.toLowerCase().includes(query.toLowerCase()))
  return <>
    <div className="toolbar">
      <div className="search-box wide"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm mã, tên, danh mục, thương hiệu..."/></div>
      <button className="btn primary" onClick={onAdd}><Plus size={18}/> Thêm sản phẩm</button>
    </div>
    <div className="table-card">
      <table><thead><tr><th></th><th>Mã</th><th>Sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Tồn</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>{rows.map(p=>{
        const variants=variantsOf(p.id), open=expanded[p.id]
        return <React.Fragment key={p.id}>
          <tr>
            <td><button className="icon small" onClick={()=>setExpanded(x=>({...x,[p.id]:!open}))}><ChevronDown className={open?'rotated':''} size={17}/></button></td>
            <td><code>{p.sku}</code></td><td><strong>{p.name}</strong><small>{p.brand||'Chưa có thương hiệu'} · {variants.length} biến thể</small></td>
            <td>{p.category||'—'}</td><td>{money(p.price)}</td><td><b>{p.stock||0}</b></td>
            <td><span className={`badge ${p.status==='active'?'success':'muted'}`}>{p.status==='active'?'Đang bán':'Ngừng bán'}</span></td>
            <td><div className="actions"><button title="Thêm biến thể" onClick={()=>onAddVariant(p)}><Plus size={16}/></button><button title="Sửa" onClick={()=>onEdit(p)}><Edit3 size={16}/></button><button title="Xóa" className="danger" onClick={()=>onDelete(p)}><Trash2 size={16}/></button></div></td>
          </tr>
          {open&&<tr className="variant-row"><td colSpan="8"><div className="variant-box">
            <div className="variant-title"><strong>Biến thể màu / size</strong><button className="btn mini primary" onClick={()=>onAddVariant(p)}><Plus size={15}/> Thêm biến thể</button></div>
            {!variants.length?<div className="empty-inline">Chưa có biến thể.</div>:
            <table className="inner-table"><thead><tr><th>SKU</th><th>Màu</th><th>Size</th><th>Mã vạch</th><th>Giá bán</th><th>Tồn</th><th>Tối thiểu</th><th></th></tr></thead>
            <tbody>{variants.map(v=><tr key={v.id}><td><code>{v.sku}</code></td><td>{v.color||'—'}</td><td>{v.size||'—'}</td><td>{v.barcode||'—'}</td><td>{money(v.price??p.price)}</td><td><b>{v.stock}</b></td><td>{v.min_stock}</td><td><div className="actions"><button onClick={()=>onEditVariant(v)}><Edit3 size={15}/></button><button className="danger" onClick={()=>onDeleteVariant(v)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table>}
          </div></td></tr>}
        </React.Fragment>
      })}</tbody></table>
      {!rows.length&&<Empty text="Chưa có sản phẩm phù hợp."/>}
    </div>
  </>
}

function CatalogPage({data,addCategory,editCategory,deleteCategory,addBrand,editBrand,deleteBrand}){
  return <div className="two-col catalog-grid">
    <Panel title="Danh mục sản phẩm"><LookupList rows={data.categories} onAdd={addCategory} onEdit={editCategory} onDelete={deleteCategory}/></Panel>
    <Panel title="Thương hiệu"><LookupList rows={data.brands} onAdd={addBrand} onEdit={editBrand} onDelete={deleteBrand}/></Panel>
  </div>
}
function LookupList({rows,onAdd,onEdit,onDelete}){
  return <><div className="lookup-add"><button className="btn primary" onClick={onAdd}><Plus size={16}/> Thêm mới</button></div>
    <div className="lookup-list">{rows.map(x=><div key={x.id}><span><strong>{x.name}</strong><small>{x.active?'Đang sử dụng':'Đã ẩn'}</small></span><div className="actions"><button onClick={()=>onEdit(x)}><Edit3 size={15}/></button><button className="danger" onClick={()=>onDelete(x)}><Trash2 size={15}/></button></div></div>)}</div>
    {!rows.length&&<Empty text="Chưa có dữ liệu."/>}</>
}

function InventoryPage({data,low,openAdjust}){
  const [filter,setFilter]=useState('all')
  const rows=data.variants.filter(v=>filter==='low'?Number(v.stock)<=Number(v.min_stock):true)
  return <>
    <div className="inventory-head">
      <div><h3>Quản lý tồn theo từng biến thể</h3><p>Mọi thay đổi tồn kho được ghi vào lịch sử giao dịch.</p></div>
      <div className="filter-tabs"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Tất cả</button><button className={filter==='low'?'active':''} onClick={()=>setFilter('low')}>Cần chú ý ({low.length})</button></div>
    </div>
    <div className="table-card"><table><thead><tr><th>Sản phẩm</th><th>Biến thể</th><th>SKU</th><th>Tồn</th><th>Tối thiểu</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>{rows.map(v=>{const p=data.products.find(x=>x.id===v.product_id);const alert=Number(v.stock)<=Number(v.min_stock)
      return <tr key={v.id} className={alert?'danger-row':''}><td><strong>{p?.name||'—'}</strong><small>{p?.category||'—'}</small></td><td>{v.color||'—'} / {v.size||'—'}</td><td><code>{v.sku}</code></td><td><b className="stock-number">{v.stock}</b></td><td>{v.min_stock}</td><td><span className={`badge ${alert?'warning':'success'}`}>{alert?'Cần nhập':'Ổn định'}</span></td><td><button className="btn mini primary" onClick={()=>openAdjust(v)}>Điều chỉnh kho</button></td></tr>})}</tbody></table>
      {!rows.length&&<Empty text="Chưa có biến thể kho."/ >}</div>
    <div className="panel history-panel"><div className="panel-head"><h3>Lịch sử giao dịch kho</h3></div><StockHistory rows={data.stockTransactions} data={data}/></div>
  </>
}
function StockHistory({rows,data}){
  if(!rows.length) return <Empty text="Chưa có giao dịch kho."/>
  return <div className="history-list">{rows.map(t=>{const v=data.variants.find(x=>x.id===t.variant_id);const p=data.products.find(x=>x.id===t.product_id)
  return <div key={t.id}><span className={`move-icon ${Number(t.quantity)>=0?'in':'out'}`}>{Number(t.quantity)>=0?'+':'−'}</span><span className="history-main"><strong>{STOCK_LABELS[t.type]||t.type} · {p?.name||'Sản phẩm'}</strong><small>{v?.color||'—'} / {v?.size||'—'} · {v?.sku||'—'} · {fmtDate(t.created_at)}{t.reference_code?` · ${t.reference_code}`:''}</small></span><span className="history-qty"><b>{Number(t.quantity)>0?'+':''}{t.quantity}</b><small>Tồn sau: {t.balance_after??'—'}</small></span></div>})}</div>
}

function ModalRouter({modal,data,close,saveProduct,saveVariant,saveLookup,adjustStock}){
  if(modal.type==='product') return <ProductModal item={modal.item} data={data} close={close} save={saveProduct}/>
  if(modal.type==='variant') return <VariantModal item={modal.item} product={modal.product} close={close} save={saveVariant}/>
  if(modal.type==='category'||modal.type==='brand') return <LookupModal type={modal.type} item={modal.item} close={close} save={saveLookup}/>
  if(modal.type==='stock') return <StockModal variant={modal.item} data={data} close={close} save={adjustStock}/>
}

function ProductModal({item,data,close,save}){
  const [form,setForm]=useState({sku:item?.sku||'',name:item?.name||'',category_id:item?.category_id||'',brand_id:item?.brand_id||'',price:item?.price||'',cost:item?.cost||'',min_stock:item?.min_stock||0,status:item?.status||'active'})
  return <BaseModal title={item?'Sửa sản phẩm':'Thêm sản phẩm'} close={close} submit={()=>save(form,item)}>
    <FormGrid><Field label="Mã sản phẩm *" value={form.sku} set={v=>setForm({...form,sku:v})}/><Field label="Tên sản phẩm *" value={form.name} set={v=>setForm({...form,name:v})}/></FormGrid>
    <FormGrid><Select label="Danh mục" value={form.category_id} set={v=>setForm({...form,category_id:v})} options={data.categories}/><Select label="Thương hiệu" value={form.brand_id} set={v=>setForm({...form,brand_id:v})} options={data.brands}/></FormGrid>
    <FormGrid><Field label="Giá bán mặc định" type="number" value={form.price} set={v=>setForm({...form,price:v})}/><Field label="Giá nhập mặc định" type="number" value={form.cost} set={v=>setForm({...form,cost:v})}/></FormGrid>
    <FormGrid><Field label="Tồn tối thiểu mặc định" type="number" value={form.min_stock} set={v=>setForm({...form,min_stock:v})}/><SelectRaw label="Trạng thái" value={form.status} set={v=>setForm({...form,status:v})} options={[['active','Đang bán'],['inactive','Ngừng bán']]}/></FormGrid>
  </BaseModal>
}
function VariantModal({item,product,close,save}){
  const [form,setForm]=useState({product_id:product.id,sku:item?.sku||'',color:item?.color||'',size:item?.size||'',barcode:item?.barcode||'',price:item?.price??'',cost:item?.cost??'',min_stock:item?.min_stock||0,status:item?.status||'active'})
  return <BaseModal title={item?'Sửa biến thể':`Thêm biến thể · ${product.name}`} close={close} submit={()=>save(form,item)}>
    <FormGrid><Field label="SKU biến thể *" value={form.sku} set={v=>setForm({...form,sku:v})}/><Field label="Mã vạch" value={form.barcode} set={v=>setForm({...form,barcode:v})}/></FormGrid>
    <FormGrid><Field label="Màu sắc" value={form.color} set={v=>setForm({...form,color:v})}/><Field label="Kích thước" value={form.size} set={v=>setForm({...form,size:v})}/></FormGrid>
    <FormGrid><Field label="Giá bán riêng" type="number" value={form.price} set={v=>setForm({...form,price:v})}/><Field label="Giá nhập riêng" type="number" value={form.cost} set={v=>setForm({...form,cost:v})}/></FormGrid>
    <FormGrid><Field label="Tồn tối thiểu" type="number" value={form.min_stock} set={v=>setForm({...form,min_stock:v})}/><SelectRaw label="Trạng thái" value={form.status} set={v=>setForm({...form,status:v})} options={[['active','Đang sử dụng'],['inactive','Ngừng sử dụng']]}/></FormGrid>
    {!item&&<div className="alert info">Tồn ban đầu của biến thể là 0. Hãy dùng mục Kho hàng để nhập kho và tạo lịch sử giao dịch.</div>}
  </BaseModal>
}
function LookupModal({type,item,close,save}){
  const [form,setForm]=useState({name:item?.name||'',active:item?.active??true})
  return <BaseModal title={`${item?'Sửa':'Thêm'} ${type==='category'?'danh mục':'thương hiệu'}`} close={close} submit={()=>save(type,form,item)}>
    <Field label="Tên *" value={form.name} set={v=>setForm({...form,name:v})}/>
    <SelectRaw label="Trạng thái" value={String(form.active)} set={v=>setForm({...form,active:v==='true'})} options={[['true','Đang sử dụng'],['false','Đã ẩn']]}/>
  </BaseModal>
}
function StockModal({variant,data,close,save}){
  const product=data.products.find(p=>p.id===variant.product_id)
  const [form,setForm]=useState({variant_id:variant.id,type:'in',quantity:'',reference_code:'',note:''})
  return <BaseModal title="Điều chỉnh kho" close={close} submit={()=>save(form)}>
    <div className="stock-summary"><strong>{product?.name}</strong><span>{variant.color||'—'} / {variant.size||'—'} · {variant.sku}</span><b>Tồn hiện tại: {variant.stock}</b></div>
    <FormGrid><SelectRaw label="Loại giao dịch" value={form.type} set={v=>setForm({...form,type:v})} options={Object.entries(STOCK_LABELS)}/><Field label="Số lượng *" type="number" value={form.quantity} set={v=>setForm({...form,quantity:v})}/></FormGrid>
    <Field label="Mã tham chiếu" value={form.reference_code} set={v=>setForm({...form,reference_code:v})} placeholder="VD: NK-0001"/>
    <Field label="Ghi chú" value={form.note} set={v=>setForm({...form,note:v})}/>
  </BaseModal>
}
function BaseModal({title,close,submit,children}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  async function handle(e){e.preventDefault();setBusy(true);setError('');try{await submit();close()}catch(err){setError(err.message||'Không thể lưu dữ liệu.')}finally{setBusy(false)}}
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><form className="modal" onSubmit={handle}>
    <div className="modal-head"><div><span className="eyebrow">ZONEG SPORT ERP v1.2</span><h2>{title}</h2></div><button type="button" className="icon" onClick={close}><X/></button></div>
    {error&&<div className="alert warning">{error}</div>}{children}
    <div className="modal-actions"><button type="button" className="btn" onClick={close}>Hủy</button><button className="btn primary" disabled={busy}>{busy?'Đang lưu...':'Lưu dữ liệu'}</button></div>
  </form></div>
}
function FormGrid({children}){return <div className="form-grid">{children}</div>}
function Field({label,value,set,type='text',placeholder=''}){return <label>{label}<input type={type} min={type==='number'?0:undefined} value={value??''} onChange={e=>set(e.target.value)} placeholder={placeholder}/></label>}
function Select({label,value,set,options}){return <label>{label}<select value={value||''} onChange={e=>set(e.target.value)}><option value="">— Chưa chọn —</option>{options.filter(x=>x.active).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
function SelectRaw({label,value,set,options}){return <label>{label}<select value={value} onChange={e=>set(e.target.value)}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}
function SimpleTable({rows}){return <div className="table-card"><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>{rows.map(o=><tr key={o.id}><td><code>{o.code}</code></td><td>{o.customer_name||'Khách lẻ'}</td><td>{fmtDate(o.created_at)}</td><td>{money(o.total)}</td><td>{o.status}</td></tr>)}</tbody></table>{!rows.length&&<Empty text="Chưa có đơn hàng."/>}</div>}
function Directory({rows,icon:Icon}){return <div className="cards">{rows.map(x=><div className="person-card" key={x.id}><div className="avatar"><Icon/></div><div><strong>{x.name}</strong><small>{x.phone||'Chưa có số điện thoại'}</small></div></div>)}{!rows.length&&<Empty text="Chưa có dữ liệu."/>}</div>}
function Placeholder({title,text}){return <div className="placeholder"><ClipboardList size={48}/><h2>{title}</h2><p>{text}</p></div>}
function Empty({text}){return <div className="empty"><ClipboardList size={30}/><span>{text}</span></div>}
