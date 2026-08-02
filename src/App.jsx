import React,{useEffect,useMemo,useRef,useState}from'react'
import{BarChart3,Boxes,Download,Edit3,Eye,FileDown,FileSpreadsheet,LayoutDashboard,LogOut,Menu,PackagePlus,Plus,Printer,ReceiptText,RefreshCw,Search,ShoppingCart,Tags,Trash2,Truck,Upload,UserCog,WalletCards,X}from'lucide-react'
import html2canvas from'html2canvas'
import{jsPDF}from'jspdf'
import*as XLSX from'xlsx'
import{supabase,money,fmtDate,normalizePhone}from'./lib'

const PAGE_SIZE=50
const NAV=[
 ['dashboard','Tổng quan',LayoutDashboard,['owner','manager','sales','warehouse']],
 ['products','Sản phẩm',Boxes,['owner','manager','sales','warehouse']],
 ['catalog','Danh mục & thương hiệu',Tags,['owner','manager']],
 ['inventory','Kho hàng',PackagePlus,['owner','manager','warehouse']],
 ['orders','Đơn hàng',ShoppingCart,['owner','manager','sales']],
 ['invoices','Hóa đơn bán hàng',ReceiptText,['owner','manager','sales']],
 ['payments','Thanh toán & công nợ',WalletCards,['owner','manager','sales']],
 ['purchases','Phiếu nhập hàng',Truck,['owner','manager','warehouse']],
 ['reports','Báo cáo',BarChart3,['owner','manager']],
 ['employees','Nhân viên',UserCog,['owner']],
]
const ROLE={owner:'Chủ cửa hàng',manager:'Quản lý',sales:'Nhân viên bán hàng',warehouse:'Nhân viên kho'}
const VI_LABEL={sku:'Mã hàng',color:'Màu sắc',size:'Kích thước',stock:'Tồn kho',min_stock:'Tồn tối thiểu',code:'Mã chứng từ',customer_name:'Khách hàng',total:'Tổng tiền',balance_due:'Còn phải thu',status:'Trạng thái',created_at:'Ngày tạo',amount:'Số tiền',method:'Phương thức',note:'Ghi chú',supplier_name:'Nhà cung cấp',full_name:'Họ và tên',phone:'Số điện thoại',email:'Email',role:'Vai trò',active:'Hoạt động'}
const VI_VALUE={active:'Đang hoạt động',inactive:'Ngừng hoạt động',draft:'Bản nháp',confirmed:'Đã xác nhận',completed:'Hoàn thành',cancelled:'Đã hủy',issued:'Đã phát hành',cash:'Tiền mặt',transfer:'Chuyển khoản',cod:'Thu hộ'}

function Login({done}){const[id,setId]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState('');async function submit(e){e.preventDefault();const input=id.includes('@')?{email:id,password}:{phone:normalizePhone(id),password};const{data,error}=await supabase.auth.signInWithPassword(input);if(error)setError(error.message);else done(data.session)}return <div className="login"><form onSubmit={submit}><div className="logo">ZG</div><h1>ZoneG Sport ERP</h1><p>Phiên bản 1.7</p><label>Email hoặc số điện thoại<input value={id} onChange={e=>setId(e.target.value)}/></label><label>Mật khẩu<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="notice error">{error}</div>}<button>Đăng nhập</button></form></div>}

export default function App(){
 const[session,setSession]=useState(null),[profile,setProfile]=useState(null),[loading,setLoading]=useState(true),[page,setPage]=useState('dashboard'),[mobile,setMobile]=useState(false),[notice,setNotice]=useState('')
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const{data:s}=supabase.auth.onAuthStateChange((_e,x)=>setSession(x));return()=>s.subscription.unsubscribe()},[])
 useEffect(()=>{if(session)loadProfile()},[session])
 async function loadProfile(){const{data,error}=await supabase.from('profiles').select('*').eq('id',session.user.id).single();if(error)setNotice(error.message);else if(!data.active)await supabase.auth.signOut();else setProfile(data)}
 const nav=NAV.filter(x=>x[3].includes(profile?.role))
 if(loading)return <div className="center">Đang tải...</div>
 if(!session)return <Login done={setSession}/>
 if(!profile)return <div className="center">Đang tải quyền...</div>
 return <div className="app"><aside className={mobile?'open':''}><div className="brand"><b>ZG</b><span>ZoneG Sport<small>{ROLE[profile.role]} · v1.7</small></span><button onClick={()=>setMobile(false)}><X/></button></div><nav>{nav.map(([id,label,I])=><button className={page===id?'active':''} onClick={()=>{setPage(id);setMobile(false)}} key={id}><I size={18}/>{label}</button>)}</nav><button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Đăng xuất</button></aside>
 <main><header><button className="mobile-btn" onClick={()=>setMobile(true)}><Menu/></button><div><small>HỆ THỐNG QUẢN TRỊ</small><h1>{nav.find(x=>x[0]===page)?.[1]}</h1></div></header><section>{notice&&<div className="notice">{notice}</div>}
 {page==='dashboard'&&<Dashboard/>}
 {page==='products'&&<Products profile={profile} setNotice={setNotice}/>}
 {page==='catalog'&&<CatalogPage setNotice={setNotice}/>}
 {page==='inventory'&&<PagedSimple table="product_variants" title="Tồn kho theo biến thể" columns={['sku','color','size','stock','min_stock']}/>}
 {page==='orders'&&<PagedSimple table="orders" title="Đơn hàng" columns={['code','customer_name','total','balance_due','status','created_at']}/>}
 {page==='invoices'&&<InvoicesPage setNotice={setNotice}/>}
 {page==='payments'&&<PagedSimple table="payments" title="Danh sách thanh toán" columns={['amount','method','note','created_at']}/>}
 {page==='purchases'&&<PagedSimple table="purchase_receipts" title="Danh sách phiếu nhập hàng" columns={['code','supplier_name','total','balance_due','status','created_at']}/>}
 {page==='reports'&&<Dashboard/>}
 {page==='employees'&&<EmployeesPage profile={profile} setNotice={setNotice}/>} 
 </section></main></div>
}

function Dashboard(){
 const[kpi,setKpi]=useState({products:0,variants:0,orders:0,low:0})
 useEffect(()=>{(async()=>{const[a,b,c,d]=await Promise.all([supabase.from('products').select('*',{count:'exact',head:true}),supabase.from('product_variants').select('*',{count:'exact',head:true}),supabase.from('orders').select('*',{count:'exact',head:true}),supabase.from('product_variants').select('*',{count:'exact',head:true}).lte('stock',5)]);setKpi({products:a.count||0,variants:b.count||0,orders:c.count||0,low:d.count||0})})()},[])
 return <div className="stats"><Card t="Sản phẩm" v={kpi.products}/><Card t="Biến thể" v={kpi.variants}/><Card t="Đơn hàng" v={kpi.orders}/><Card t="Tồn thấp (≤5)" v={kpi.low}/></div>
}
const Card=({t,v})=><div className="card"><small>{t}</small><b>{v}</b></div>

function Products({profile,setNotice}){
 const[rows,setRows]=useState([]),[count,setCount]=useState(0),[page,setPage]=useState(1),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[loading,setLoading]=useState(false),[manualOpen,setManualOpen]=useState(false),[variantOpen,setVariantOpen]=useState(false),[selectedProduct,setSelectedProduct]=useState(null)
 const[productForm,setProductForm]=useState({sku:'',name:'',category:'',brand:'',price:'',cost:'',min_stock:'0',status:'active'})
 const[variantForm,setVariantForm]=useState({sku:'',color:'',size:'',barcode:'',price:'',cost:'',min_stock:'0',status:'active'})
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

 async function saveManualProduct(e){
  e.preventDefault()
  try{
   if(!productForm.sku.trim()||!productForm.name.trim())throw new Error('Mã và tên sản phẩm là bắt buộc.')
   const{error}=await supabase.from('products').insert({
    sku:productForm.sku.trim(),name:productForm.name.trim(),
    category:productForm.category.trim()||null,brand:productForm.brand.trim()||null,
    price:Number(productForm.price||0),cost:Number(productForm.cost||0),
    stock:0,min_stock:Number(productForm.min_stock||0),status:productForm.status,
    updated_at:new Date().toISOString()
   })
   if(error)throw error
   setNotice('Đã thêm sản phẩm trực tiếp trên web.')
   setManualOpen(false)
   setProductForm({sku:'',name:'',category:'',brand:'',price:'',cost:'',min_stock:'0',status:'active'})
   setPage(1);await load()
  }catch(err){setNotice(err.message)}
 }
 async function openVariant(product){
  setSelectedProduct(product);setVariantOpen(true)
 }
 async function saveManualVariant(e){
  e.preventDefault()
  try{
   if(!variantForm.sku.trim())throw new Error('SKU biến thể là bắt buộc.')
   const{error}=await supabase.from('product_variants').insert({
    product_id:selectedProduct.id,sku:variantForm.sku.trim(),
    color:variantForm.color.trim()||null,size:variantForm.size.trim()||null,
    barcode:variantForm.barcode.trim()||null,
    price:variantForm.price===''?null:Number(variantForm.price),
    cost:variantForm.cost===''?null:Number(variantForm.cost),
    stock:0,min_stock:Number(variantForm.min_stock||0),status:variantForm.status,
    updated_at:new Date().toISOString()
   })
   if(error)throw error
   setNotice('Đã thêm biến thể. Tồn ban đầu nhập tại mục Kho hàng.')
   setVariantOpen(false);setSelectedProduct(null)
   setVariantForm({sku:'',color:'',size:'',barcode:'',price:'',cost:'',min_stock:'0',status:'active'})
  }catch(err){setNotice(err.message)}
 }

 const totalPages=Math.max(1,Math.ceil(count/PAGE_SIZE))
 return <><div className="toolbar"><form className="searchbar" onSubmit={doSearch}><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm mã, tên, danh mục, thương hiệu..."/><button>Tìm</button></form>{['owner','manager'].includes(profile.role)&&<div className="toolbar-actions"><input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFile}/><button className="manual-add" onClick={()=>setManualOpen(true)}><Plus size={16}/>Thêm trực tiếp</button><button onClick={()=>inputRef.current.click()}><Upload size={16}/>Nhập Excel</button><button onClick={exportProducts}><FileSpreadsheet size={16}/>Xuất Excel</button><button onClick={backup}><Download size={16}/>Sao lưu</button></div>}</div>
 <div className="panel"><div className="panel-title"><h3>Danh sách sản phẩm</h3><span>{count.toLocaleString('vi-VN')} kết quả · 50 dòng/trang</span></div><table><thead><tr><th>Mã</th><th>Tên</th><th>Danh mục</th><th>Thương hiệu</th><th>Giá bán</th><th>Tồn</th><th>Thao tác</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><code>{x.sku}</code></td><td>{x.name}</td><td>{x.category||'—'}</td><td>{x.brand||'—'}</td><td>{money(x.price)}</td><td>{x.stock}</td><td>{['owner','manager'].includes(profile.role)&&<button className="row-action" onClick={()=>openVariant(x)}><Plus size={14}/>Biến thể</button>}</td></tr>)}</tbody></table>{loading&&<div className="loading-row">Đang tải...</div>}<Pagination page={page} total={totalPages} setPage={setPage}/></div>
 {manualOpen&&<div className="back" onMouseDown={e=>e.target===e.currentTarget&&setManualOpen(false)}><form className="modal" onSubmit={saveManualProduct}>
  <div className="modalhead"><div><small>NHẬP TRỰC TIẾP</small><h2>Thêm sản phẩm</h2></div><button type="button" onClick={()=>setManualOpen(false)}><X/></button></div>
  <div className="form-grid"><label>Mã sản phẩm *<input value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})}/></label><label>Tên sản phẩm *<input value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})}/></label></div>
  <div className="form-grid"><label>Danh mục<input value={productForm.category} onChange={e=>setProductForm({...productForm,category:e.target.value})}/></label><label>Thương hiệu<input value={productForm.brand} onChange={e=>setProductForm({...productForm,brand:e.target.value})}/></label></div>
  <div className="form-grid"><label>Giá bán<input type="number" value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})}/></label><label>Giá nhập<input type="number" value={productForm.cost} onChange={e=>setProductForm({...productForm,cost:e.target.value})}/></label></div>
  <div className="form-grid"><label>Tồn tối thiểu<input type="number" value={productForm.min_stock} onChange={e=>setProductForm({...productForm,min_stock:e.target.value})}/></label><label>Trạng thái<select value={productForm.status} onChange={e=>setProductForm({...productForm,status:e.target.value})}><option value="active">Đang bán</option><option value="inactive">Ngừng bán</option></select></label></div>
  <div className="actions"><button type="button" onClick={()=>setManualOpen(false)}>Hủy</button><button className="primary">Lưu sản phẩm</button></div>
 </form></div>}
 {variantOpen&&<div className="back" onMouseDown={e=>e.target===e.currentTarget&&setVariantOpen(false)}><form className="modal" onSubmit={saveManualVariant}>
  <div className="modalhead"><div><small>{selectedProduct?.sku}</small><h2>Thêm biến thể</h2></div><button type="button" onClick={()=>setVariantOpen(false)}><X/></button></div>
  <div className="form-grid"><label>SKU biến thể *<input value={variantForm.sku} onChange={e=>setVariantForm({...variantForm,sku:e.target.value})}/></label><label>Mã vạch<input value={variantForm.barcode} onChange={e=>setVariantForm({...variantForm,barcode:e.target.value})}/></label></div>
  <div className="form-grid"><label>Màu sắc<input value={variantForm.color} onChange={e=>setVariantForm({...variantForm,color:e.target.value})}/></label><label>Kích thước<input value={variantForm.size} onChange={e=>setVariantForm({...variantForm,size:e.target.value})}/></label></div>
  <div className="form-grid"><label>Giá bán riêng<input type="number" value={variantForm.price} onChange={e=>setVariantForm({...variantForm,price:e.target.value})}/></label><label>Giá nhập riêng<input type="number" value={variantForm.cost} onChange={e=>setVariantForm({...variantForm,cost:e.target.value})}/></label></div>
  <div className="notice">Biến thể được tạo với tồn bằng 0. Nhập tồn tại mục Kho hàng để có lịch sử giao dịch.</div>
  <div className="actions"><button type="button" onClick={()=>setVariantOpen(false)}>Hủy</button><button className="primary">Lưu biến thể</button></div>
 </form></div>}
 </>
}



function InvoicesPage({setNotice}){
 const[rows,setRows]=useState([]),[orders,setOrders]=useState([]),[count,setCount]=useState(0),[page,setPage]=useState(1)
 const[open,setOpen]=useState(false),[orderId,setOrderId]=useState(''),[note,setNote]=useState('')
 const[preview,setPreview]=useState(null),[items,setItems]=useState([]),[paper,setPaper]=useState('a4')
 useEffect(()=>{load()},[page])
 async function load(){const from=(page-1)*PAGE_SIZE;const[a,b]=await Promise.all([supabase.from('sales_invoices').select('*',{count:'exact'}).order('created_at',{ascending:false}).range(from,from+PAGE_SIZE-1),supabase.from('orders').select('id,code,customer_name,total,created_at').order('created_at',{ascending:false}).limit(500)]);if(a.error||b.error)setNotice(a.error?.message||b.error?.message);else{setRows(a.data||[]);setCount(a.count||0);setOrders(b.data||[])}}
 async function createInvoice(e){e.preventDefault();if(!orderId){setNotice('Vui lòng chọn đơn hàng.');return}const{data,error}=await supabase.rpc('create_sales_invoice_from_order',{p_order_id:orderId,p_note:note||null});if(error)setNotice(error.message);else{setOpen(false);setOrderId('');setNote('');setNotice('Đã lập hóa đơn.');await load();await showInvoice(data)}}
 async function showInvoice(id){const[a,b]=await Promise.all([supabase.from('sales_invoices').select('*').eq('id',id).single(),supabase.from('sales_invoice_items').select('*').eq('invoice_id',id).order('id')]);if(a.error||b.error)setNotice(a.error?.message||b.error?.message);else{setPreview(a.data);setItems(b.data||[])}}
 return <><div className="toolbar employee-toolbar"><div><h3>Quản lý hóa đơn bán hàng</h3><p>Lập hóa đơn từ đơn hàng, in khổ A4/A5 hoặc xuất PDF.</p></div><button className="employee-add" onClick={()=>setOpen(true)}><Plus size={17}/>Lập hóa đơn</button></div><div className="panel"><div className="panel-title"><h3>Danh sách hóa đơn</h3><span>{count} hóa đơn</span></div><table><thead><tr><th>Số hóa đơn</th><th>Khách hàng</th><th>Tổng tiền</th><th>Đã thanh toán</th><th>Còn phải thu</th><th>Ngày lập</th><th>Thao tác</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><b>{x.invoice_number}</b></td><td>{x.customer_name||'Khách lẻ'}</td><td>{money(x.total)}</td><td>{money(x.paid_amount)}</td><td>{money(x.balance_due)}</td><td>{fmtDate(x.created_at)}</td><td><button className="row-action" onClick={()=>showInvoice(x.id)}><Eye size={15}/>Xem và in</button></td></tr>)}</tbody></table><Pagination page={page} total={Math.max(1,Math.ceil(count/PAGE_SIZE))} setPage={setPage}/></div>
 {open&&<div className="back"><form className="modal" onSubmit={createInvoice}><div className="modalhead"><div><small>ZONEG SPORT</small><h2>Lập hóa đơn từ đơn hàng</h2></div><button type="button" onClick={()=>setOpen(false)}><X/></button></div><label>Đơn hàng<select value={orderId} onChange={e=>setOrderId(e.target.value)}><option value="">-- Chọn đơn hàng --</option>{orders.map(o=><option value={o.id} key={o.id}>{o.code} - {o.customer_name||'Khách lẻ'} - {money(o.total)}</option>)}</select></label><label>Ghi chú<textarea rows="3" value={note} onChange={e=>setNote(e.target.value)}/></label><div className="actions"><button type="button" onClick={()=>setOpen(false)}>Hủy</button><button className="primary">Lập hóa đơn</button></div></form></div>}
 {preview&&<InvoicePreview invoice={preview} items={items} paper={paper} setPaper={setPaper} close={()=>setPreview(null)} setNotice={setNotice}/>}</>
}
function InvoicePreview({invoice,items,paper,setPaper,close,setNotice}){const ref=useRef();function printInvoice(){document.documentElement.style.setProperty('--invoice-paper',paper==='a5'?'A5':'A4');window.print()}async function exportPdf(){try{const canvas=await html2canvas(ref.current,{scale:2,backgroundColor:'#fff',useCORS:true});const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:paper});const w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight(),ratio=Math.min((w-8)/canvas.width,(h-8)/canvas.height),iw=canvas.width*ratio,ih=canvas.height*ratio;pdf.addImage(canvas.toDataURL('image/jpeg',0.95),'JPEG',(w-iw)/2,4,iw,ih);pdf.save(`${invoice.invoice_number}-${paper.toUpperCase()}.pdf`)}catch(e){setNotice('Không thể xuất PDF: '+e.message)}}return <div className="invoice-overlay"><div className="invoice-window"><div className="invoice-tools"><div><b>Xem trước hóa đơn</b><span>Chọn khổ giấy trước khi in hoặc xuất PDF.</span></div><label>Khổ giấy<select value={paper} onChange={e=>setPaper(e.target.value)}><option value="a4">A4</option><option value="a5">A5</option></select></label><button onClick={printInvoice}><Printer size={16}/>In hóa đơn</button><button onClick={exportPdf}><FileDown size={16}/>Xuất PDF</button><button onClick={close}><X size={17}/></button></div><div className={`invoice-paper ${paper}`} ref={ref}><div className="invoice-company"><div className="invoice-logo">ZG</div><div><h2>ZONEG SPORT</h2><p>Kết nối thể thao Việt</p><p>Website: zoneg.io.vn</p></div></div><div className="invoice-title"><h1>HÓA ĐƠN BÁN HÀNG</h1><p>Số: <b>{invoice.invoice_number}</b></p><p>Ngày lập: {fmtDate(invoice.created_at)}</p></div><div className="invoice-customer"><p><b>Khách hàng:</b> {invoice.customer_name||'Khách lẻ'}</p><p><b>Số điện thoại:</b> {invoice.customer_phone||'—'}</p><p><b>Địa chỉ:</b> {invoice.customer_address||'—'}</p></div><table className="invoice-table"><thead><tr><th>STT</th><th>Mã hàng</th><th>Tên sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>{items.map((x,i)=><tr key={x.id}><td>{i+1}</td><td>{x.sku||'—'}</td><td>{x.product_name}</td><td>{x.quantity}</td><td>{money(x.unit_price)}</td><td>{money(x.line_total)}</td></tr>)}</tbody></table><div className="invoice-summary"><p><span>Tiền hàng:</span><b>{money(invoice.subtotal)}</b></p><p><span>Giảm giá:</span><b>{money(invoice.discount)}</b></p><p><span>Phí vận chuyển:</span><b>{money(invoice.shipping_fee)}</b></p><p className="invoice-total"><span>Tổng thanh toán:</span><b>{money(invoice.total)}</b></p><p><span>Đã thanh toán:</span><b>{money(invoice.paid_amount)}</b></p><p><span>Còn phải thu:</span><b>{money(invoice.balance_due)}</b></p></div>{invoice.note&&<div className="invoice-note"><b>Ghi chú:</b> {invoice.note}</div>}<div className="invoice-sign"><div><b>Khách hàng</b><span>(Ký và ghi rõ họ tên)</span></div><div><b>Người lập hóa đơn</b><span>(Ký và ghi rõ họ tên)</span></div></div><div className="invoice-footer">Cảm ơn quý khách đã tin tưởng ZoneG Sport!</div></div></div></div>}

function EmployeesPage({profile,setNotice}){
 const[rows,setRows]=useState([]),[count,setCount]=useState(0),[page,setPage]=useState(1),[open,setOpen]=useState(false),[busy,setBusy]=useState(false)
 const[form,setForm]=useState({full_name:'',phone:'',password:'',role:'sales'})
 useEffect(()=>{load()},[page])
 async function load(){
  const from=(page-1)*PAGE_SIZE
  const{data,error,count}=await supabase.from('profiles').select('*',{count:'exact'}).order('created_at',{ascending:true}).range(from,from+PAGE_SIZE-1)
  if(error)setNotice(error.message);else{setRows(data||[]);setCount(count||0)}
 }
 async function createEmployee(e){
  e.preventDefault();setBusy(true);setNotice('')
  try{
   if(!form.full_name.trim())throw new Error('Vui lòng nhập họ tên.')
   if(!form.phone.trim())throw new Error('Vui lòng nhập số điện thoại.')
   if((form.password||'').length<8)throw new Error('Mật khẩu tạm phải có ít nhất 8 ký tự.')
   const{data,error}=await supabase.functions.invoke('create-employee',{body:{
    full_name:form.full_name.trim(),
    phone:normalizePhone(form.phone),
    password:form.password,
    role:form.role
   }})
   if(error)throw error
   if(data?.error)throw new Error(data.error)
   setNotice('Đã tạo tài khoản nhân viên.')
   setOpen(false)
   setForm({full_name:'',phone:'',password:'',role:'sales'})
   await load()
  }catch(err){setNotice(err.message||'Không thể tạo nhân viên.')}
  finally{setBusy(false)}
 }
 async function updateEmployee(emp,changes){
  const{error}=await supabase.from('profiles').update({...changes,updated_at:new Date().toISOString()}).eq('id',emp.id)
  if(error)setNotice(error.message);else{setNotice('Đã cập nhật nhân viên.');await load()}
 }
 const total=Math.max(1,Math.ceil(count/PAGE_SIZE))
 return <>
  <div className="toolbar employee-toolbar">
   <div><h3>Quản lý nhân viên</h3><p>Chủ cửa hàng có thể tạo tài khoản bằng số điện thoại và phân quyền.</p></div>
   <button className="employee-add" onClick={()=>setOpen(true)}><Plus size={17}/> Thêm nhân viên</button>
  </div>
  <div className="panel">
   <div className="panel-title"><h3>Nhân viên</h3><span>{count} bản ghi</span></div>
   <table><thead><tr><th>Họ tên</th><th>Số điện thoại</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th></tr></thead>
   <tbody>{rows.map(emp=><tr key={emp.id}>
    <td><b>{emp.full_name||'Chưa đặt tên'}</b>{emp.id===profile.id&&<small className="current-user">Tài khoản hiện tại</small>}</td>
    <td>{emp.phone||'—'}</td><td>{emp.email||'—'}</td>
    <td><select value={emp.role} disabled={emp.id===profile.id&&emp.role==='owner'} onChange={e=>updateEmployee(emp,{role:e.target.value})}>
     <option value="owner">Chủ cửa hàng</option><option value="manager">Quản lý</option><option value="sales">Bán hàng</option><option value="warehouse">Nhân viên kho</option>
    </select></td>
    <td><label className="employee-active"><input type="checkbox" checked={!!emp.active} disabled={emp.id===profile.id} onChange={e=>updateEmployee(emp,{active:e.target.checked})}/>{emp.active?'Hoạt động':'Đã khóa'}</label></td>
   </tr>)}</tbody></table>
   <Pagination page={page} total={total} setPage={setPage}/>
  </div>
  {open&&<div className="back" onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}>
   <form className="modal" onSubmit={createEmployee}>
    <div className="modalhead"><div><small>ZONEG SPORT ERP</small><h2>Thêm nhân viên</h2></div><button type="button" onClick={()=>setOpen(false)}><X/></button></div>
    <label>Họ tên *<input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Nguyễn Văn A"/></label>
    <label>Số điện thoại *<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="0901234567"/></label>
    <label>Mật khẩu tạm *<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Tối thiểu 8 ký tự"/></label>
    <label>Vai trò<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
     <option value="sales">Bán hàng</option><option value="warehouse">Nhân viên kho</option><option value="manager">Quản lý</option>
    </select></label>
    <div className="notice">Nhân viên đăng nhập bằng số điện thoại và mật khẩu tạm. Không cần email.</div>
    <div className="actions"><button type="button" onClick={()=>setOpen(false)}>Hủy</button><button className="primary" disabled={busy}>{busy?'Đang tạo...':'Tạo tài khoản'}</button></div>
   </form>
  </div>}
 </>
}


function CatalogPage({setNotice}){
 const[categories,setCategories]=useState([]),[brands,setBrands]=useState([])
 const[newCategory,setNewCategory]=useState(''),[newBrand,setNewBrand]=useState('')
 useEffect(()=>{load()},[])
 async function load(){
  const[c,b]=await Promise.all([supabase.from('categories').select('*').order('name'),supabase.from('brands').select('*').order('name')])
  if(c.error||b.error)setNotice(c.error?.message||b.error?.message);else{setCategories(c.data||[]);setBrands(b.data||[])}
 }
 async function add(table,name,setName){
  try{
   if(!name.trim())throw new Error('Vui lòng nhập tên.')
   const{error}=await supabase.from(table).insert({name:name.trim(),active:true})
   if(error)throw error
   setName('');setNotice('Đã thêm dữ liệu.');await load()
  }catch(e){setNotice(e.message)}
 }
 async function remove(table,id){
  if(!confirm('Xóa mục này?'))return
  const{error}=await supabase.from(table).delete().eq('id',id)
  if(error)setNotice(error.message);else{setNotice('Đã xóa.');await load()}
 }
 return <div className="catalog-layout">
  <div className="panel"><div className="panel-title"><h3>Danh mục</h3><span>{categories.length} mục</span></div>
   <div className="inline-create"><input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Tên danh mục"/><button onClick={()=>add('categories',newCategory,setNewCategory)}><Plus size={15}/>Thêm</button></div>
   <div className="lookup-list">{categories.map(x=><div key={x.id}><span>{x.name}</span><button onClick={()=>remove('categories',x.id)}><Trash2 size={15}/></button></div>)}</div>
  </div>
  <div className="panel"><div className="panel-title"><h3>Thương hiệu</h3><span>{brands.length} mục</span></div>
   <div className="inline-create"><input value={newBrand} onChange={e=>setNewBrand(e.target.value)} placeholder="Tên thương hiệu"/><button onClick={()=>add('brands',newBrand,setNewBrand)}><Plus size={15}/>Thêm</button></div>
   <div className="lookup-list">{brands.map(x=><div key={x.id}><span>{x.name}</span><button onClick={()=>remove('brands',x.id)}><Trash2 size={15}/></button></div>)}</div>
  </div>
 </div>
}

function PagedSimple({table,title,columns}){
 const[rows,setRows]=useState([]),[count,setCount]=useState(0),[page,setPage]=useState(1)
 useEffect(()=>{(async()=>{const from=(page-1)*PAGE_SIZE;const{data,count}=await supabase.from(table).select('*',{count:'exact'}).order('created_at',{ascending:false}).range(from,from+PAGE_SIZE-1);setRows(data||[]);setCount(count||0)})()},[table,page])
 function show(c,v){if(c.includes('amount')||c==='total'||c==='balance_due')return money(v);if(c==='created_at')return fmtDate(v);if(c==='status'||c==='method')return VI_VALUE[v]||v;if(c==='role')return ROLE[v]||v;if(c==='active')return v?'Đang hoạt động':'Đã khóa';return String(v??'—')} return <div className="panel"><div className="panel-title"><h3>{title}</h3><span>{count.toLocaleString('vi-VN')} bản ghi</span></div><table><thead><tr>{columns.map(c=><th key={c}>{VI_LABEL[c]||c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{columns.map(c=><td key={c}>{show(c,r[c])}</td>)}</tr>)}</tbody></table><Pagination page={page} total={Math.max(1,Math.ceil(count/PAGE_SIZE))} setPage={setPage}/></div>
}
function Pagination({page,total,setPage}){return <div className="pagination"><button disabled={page<=1} onClick={()=>setPage(page-1)}>Trang trước</button><span>Trang {page}/{total}</span><button disabled={page>=total} onClick={()=>setPage(page+1)}>Trang sau</button></div>}
