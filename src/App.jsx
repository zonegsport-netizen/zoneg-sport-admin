import React,{useEffect,useMemo,useRef,useState}from'react'
import{BarChart3,Boxes,Download,FileSpreadsheet,LayoutDashboard,LogOut,Menu,PackagePlus,Plus,RefreshCw,Search,ShoppingCart,Truck,Upload,UserCog,WalletCards,X}from'lucide-react'
import*as XLSX from'xlsx'
import{supabase,money,fmtDate,normalizePhone}from'./lib'

const PAGE_SIZE=50
const NAV=[
 ['dashboard','Tổng quan',LayoutDashboard,['owner','manager','sales','warehouse']],
 ['products','Sản phẩm',Boxes,['owner','manager','sales','warehouse']],
 ['inventory','Kho hàng',PackagePlus,['owner','manager','warehouse']],
 ['orders','Đơn hàng',ShoppingCart,['owner','manager','sales']],
 ['payments','Thanh toán & công nợ',WalletCards,['owner','manager','sales']],
 ['purchases','Phiếu nhập hàng',Truck,['owner','manager','warehouse']],
 ['reports','Báo cáo',BarChart3,['owner','manager']],
 ['employees','Nhân viên',UserCog,['owner']],
]
const ROLE={owner:'Chủ cửa hàng',manager:'Quản lý',sales:'Bán hàng',warehouse:'Nhân viên kho'}

function Login({done}){const[id,setId]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState('');async function submit(e){e.preventDefault();const input=id.includes('@')?{email:id,password}:{phone:normalizePhone(id),password};const{data,error}=await supabase.auth.signInWithPassword(input);if(error)setError(error.message);else done(data.session)}return <div className="login"><form onSubmit={submit}><div className="logo">ZG</div><h1>ZoneG Sport ERP</h1><p>v1.6.1 · Dữ liệu lớn</p><label>Email hoặc số điện thoại<input value={id} onChange={e=>setId(e.target.value)}/></label><label>Mật khẩu<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="notice error">{error}</div>}<button>Đăng nhập</button></form></div>}

export default function App(){
 const[session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[page,setPage]=useState('dashboard'),[mobile,setMobile]=useState(false),[notice,setNotice]=useState('')
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const{data:s}=supabase.auth.onAuthStateChange((_e,x)=>setSession(x));return()=>s.subscription.unsubscribe()},[])
 useEffect(()=>{if(session)loadProfile()},[session])
 async function loadProfile(){const{data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).single();if(error)setNotice(error.message);else if(!data.active)await supabase.auth.signOut();else setProfile(data)}
 const nav=NAV.filter(x=>x[3].includes(profile?.role))
 if(loading)return <div className="center">Đang tải...</div>
 if(!session)return <Login done={setSession}/>
 if(!profile)return <div className="center">Đang tải quyền...</div>
 return <div className="app"><aside className={mobile?'open':''}><div className="brand"><b>ZG</b><span>ZoneG Sport<small>{ROLE[profile.role]} · v1.6.1</small></span><button onClick={()=>setMobile(false)}><X/></button></div><nav>{nav.map(([id,label,I])=><button className={page===id?'active':''} onClick={()=>{setPage(id);setMobile(false)}} key={id}><I size={18}/>{label}</button>)}</nav><button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Đăng xuất</button></aside>
 <main><header><button className="mobile-btn" onClick={()=>setMobile(true)}><Menu/></button><div><small>HỆ THỐNG QUẢN TRỊ</small><h1>{nav.find(x=>x[0]===page)?.[1]}</h1></div></header><section>{notice&&<div className="notice">{notice}</div>}
 {page==='dashboard'&&<Dashboard/>}
 {page==='products'&&<Products profile={profile} setNotice={setNotice}/>}
 {page==='inventory'&&<PagedSimple table="product_variants" title="Kho theo biến thể" columns={['sku','color','size','stock','min_stock']}/>}
 {page==='orders'&&<PagedSimple table="orders" title="Đơn hàng" columns={['code','customer_name','total','balance_due','status','created_at']}/>}
 {page==='payments'&&<PagedSimple table="payments" title="Thanh toán" columns={['amount','method','note','created_at']}/>}
 {page==='purchases'&&<PagedSimple table="purchase_receipts" title="Phiếu nhập hàng" columns={['code','supplier_name','total','balance_due','status','created_at']}/>}
 {page==='reports'&&<Dashboard/>}
 {page==='employees'&&<PagedSimple table="profiles" title="Nhân viên" columns={['full_name','phone','email','role','active']}/>}
 </section></main></div>
}

function Dashboard(){
 const[kpi,setKpi]=useState({products:0,variants:0,orders:0,low:0})
 useEffect(()=>{(async()=>{const[a,b,c,d]=await Promise.all([supabase.from('products').select('*',{count:'exact',head:true}),supabase.from('product_variants').select('*',{count:'exact',head:true}),supabase.from('orders').select('*',{count:'exact',head:true}),supabase.from('product_variants').select('*',{count:'exact',head:true}).lte('stock',5)]);setKpi({products:a.count||0,variants:b.count||0,orders:c.count||0,low:d.count||0})})()},[])
 return <div className="stats"><Card t="Sản phẩm" v={kpi.products}/><Card t="Biến thể" v={kpi.variants}/><Card t="Đơn hàng" v={kpi.orders}/><Card t="Tồn thấp (≤5)" v={kpi.low}/></div>
}
const Card=({t,v})=><div className="card"><small>{t}</small><b>{v}</b></div>

function Products({profile,setNotice}){
 const[rows,setRows]=useState([]),[count,setCount]=useState(0),[page,setPage]=useState(1),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[loading,setLoading]=useState(false)
 const inputRef=useRef()
 useEffect(()=>{load()},[page,search])
 async function load(){setLoading(true);const from=(page-1)*PAGE_SIZE,to=from+PAGE_SIZE-1;let q=supabase.from('products').select('id,sku,name,category,brand,price,stock,status,created_at',{count:'exact'}).order('created_at',{ascending:false}).range(from,to);if(search)q=q.or(`sku.ilike.%${search}%,name.ilike.%${search}%,category.ilike.%${search}%,brand.ilike.%${search}%`);const{data,error,count}=await q;if(error)setNotice(error.message);else{setRows(data||[]);setCount(count||0)}setLoading(false)}
 function doSearch(e){e.preventDefault();setPage(1);setSearch(query.trim())}
 async function importExcel(file){
  const buf=await file.arrayBuffer(),wb=XLSX.read(buf,{type:'array'}),ps=XLSX.utils.sheet_to_json(wb.Sheets['SAN_PHAM']||{}),vs=XLSX.utils.sheet_to_json(wb.Sheets['BIEN_THE']||{})
  const products=ps.filter(x=>x.ma_san_pham&&x.ten_san_pham).map(x=>({sku:String(x.ma_san_pham).trim(),name:String(x.ten_san_pham).trim(),category:String(x.danh_muc||''),brand:String(x.thuong_hieu||''),price:Number(x.gia_ban_mac_dinh||0),cost:Number(x.gia_nhap_mac_dinh||0),min_stock:Number(x.ton_toi_thieu||0),status:String(x.trang_thai||'active')}))
  const variants=vs.filter(x=>x.ma_san_pham&&x.sku_bien_the).map(x=>({product_sku:String(x.ma_san_pham).trim(),sku:String(x.sku_bien_the).trim(),color:String(x.mau_sac||''),size:String(x.kich_thuoc||''),barcode:String(x.ma_vach||''),price:x.gia_ban_rieng===''||x.gia_ban_rieng==null?'':Number(x.gia_ban_rieng),cost:x.gia_nhap_rieng===''||x.gia_nhap_rieng==null?'':Number(x.gia_nhap_rieng),initial_stock:Number(x.ton_ban_dau||0),min_stock:Number(x.ton_toi_thieu||0),status:String(x.trang_thai||'active')}))
  if(!products.length)throw new Error('Không tìm thấy dữ liệu trong sheet SAN_PHAM.')
  const skuSet=new Set(),dup=[];for(const p of products){if(skuSet.has(p.sku))dup.push(p.sku);skuSet.add(p.sku)}for(const v of variants){if(skuSet.has(v.sku))dup.push(v.sku);skuSet.add(v.sku)}if(dup.length)throw new Error(`Mã trùng trong file: ${[...new Set(dup)].slice(0,10).join(', ')}`)
  const{data,error}=await supabase.rpc('bulk_import_catalog',{p_products:products,p_variants:variants});if(error)throw error
  setNotice(`Nhập thành công: ${data.products_processed} sản phẩm, ${data.variants_processed} biến thể.`);setPage(1);await load()
 }
 async function backup(){
  const tables=['products','product_variants','categories','brands','stock_transactions','customers','orders','order_items','payments','suppliers','purchase_receipts','purchase_receipt_items','supplier_payments']
  const backup={exported_at:new Date().toISOString(),version:'1.6.1',tables:{}}
  for(const table of tables){let all=[],from=0;while(true){const{data,error}=await supabase.from(table).select('*').range(from,from+999);if(error)throw error;all.push(...(data||[]));if(!data||data.length<1000)break;from+=1000}backup.tables[table]=all}
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`zoneg-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);setNotice('Đã xuất bản sao lưu JSON.')
 }
 async function exportProducts(){
  let products=[],variants=[],from=0;while(true){const{data}=await supabase.from('products').select('*').range(from,from+999);products.push(...(data||[]));if(!data||data.length<1000)break;from+=1000}from=0;while(true){const{data}=await supabase.from('product_variants').select('*').range(from,from+999);variants.push(...(data||[]));if(!data||data.length<1000)break;from+=1000}
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(products),'SAN_PHAM_EXPORT');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(variants),'BIEN_THE_EXPORT');XLSX.writeFile(wb,`zoneg-san-pham-${new Date().toISOString().slice(0,10)}.xlsx`)
 }
 async function handleFile(e){try{if(e.target.files?.[0])await importExcel(e.target.files[0])}catch(err){setNotice(err.message)}finally{e.target.value=''}}
 const totalPages=Math.max(1,Math.ceil(count/PAGE_SIZE))
 return <><div className="toolbar"><form className="searchbar" onSubmit={doSearch}><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm mã, tên, danh mục, thương hiệu..."/><button>Tìm</button></form>{['owner','manager'].includes(profile.role)&&<div className="toolbar-actions"><input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFile}/><button onClick={()=>inputRef.current.click()}><Upload size={16}/>Nhập Excel</button><button onClick={exportProducts}><FileSpreadsheet size={16}/>Xuất Excel</button><button onClick={backup}><Download size={16}/>Sao lưu</button></div>}</div>
 <div className="panel"><div className="panel-title"><h3>Danh sách sản phẩm</h3><span>{count.toLocaleString('vi-VN')} kết quả · 50 dòng/trang</span></div><table><thead><tr><th>Mã</th><th>Tên</th><th>Danh mục</th><th>Thương hiệu</th><th>Giá bán</th><th>Tồn</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><code>{x.sku}</code></td><td>{x.name}</td><td>{x.category||'—'}</td><td>{x.brand||'—'}</td><td>{money(x.price)}</td><td>{x.stock}</td></tr>)}</tbody></table>{loading&&<div className="loading-row">Đang tải...</div>}<Pagination page={page} total={totalPages} setPage={setPage}/></div></>
}

function PagedSimple({table,title,columns}){
 const[rows,setRows]=useState([]),[count,setCount]=useState(0),[page,setPage]=useState(1)
 useEffect(()=>{(async()=>{const from=(page-1)*PAGE_SIZE;const{data,count}=await supabase.from(table).select('*',{count:'exact'}).order('created_at',{ascending:false}).range(from,from+PAGE_SIZE-1);setRows(data||[]);setCount(count||0)})()},[table,page])
 return <div className="panel"><div className="panel-title"><h3>{title}</h3><span>{count.toLocaleString('vi-VN')} bản ghi</span></div><table><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{columns.map(c=><td key={c}>{c.includes('amount')||c==='total'||c==='balance_due'?money(r[c]):c==='created_at'?fmtDate(r[c]):String(r[c]??'—')}</td>)}</tr>)}</tbody></table><Pagination page={page} total={Math.max(1,Math.ceil(count/PAGE_SIZE))} setPage={setPage}/></div>
}
function Pagination({page,total,setPage}){return <div className="pagination"><button disabled={page<=1} onClick={()=>setPage(page-1)}>Trước</button><span>Trang {page}/{total}</span><button disabled={page>=total} onClick={()=>setPage(page+1)}>Sau</button></div>}
