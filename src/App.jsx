import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, BarChart3, Boxes, ChevronRight, CircleDollarSign,
  ClipboardList, Contact, FileText, LayoutDashboard, LogOut, Menu,
  PackagePlus, Plus, RefreshCw, Search, Settings, ShoppingCart,
  Store, Truck, Users, X
} from 'lucide-react'
import { supabase, money, fmtDate } from './lib'

const navItems = [
  ['dashboard', 'Tổng quan', LayoutDashboard],
  ['products', 'Sản phẩm', Boxes],
  ['inventory', 'Kho hàng', PackagePlus],
  ['orders', 'Đơn hàng', ShoppingCart],
  ['customers', 'Khách hàng', Users],
  ['suppliers', 'Nhà cung cấp', Truck],
  ['invoices', 'Hóa đơn', FileText],
  ['reports', 'Báo cáo', BarChart3],
]

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else onLogin(data.session)
    setBusy(false)
  }

  return (
    <div className="auth-layout">
      <section className="auth-brand">
        <div className="brand-logo xl">ZG</div>
        <h1>ZoneG Sport Admin</h1>
        <p>Kết nối thể thao Việt</p>
        <div className="auth-benefits">
          <span><Store size={18}/> Quản lý tập trung</span>
          <span><CircleDollarSign size={18}/> Theo dõi doanh thu</span>
          <span><Boxes size={18}/> Kiểm soát tồn kho</span>
        </div>
      </section>
      <form className="auth-card" onSubmit={submit}>
        <span className="eyebrow">HỆ THỐNG QUẢN TRỊ NỘI BỘ</span>
        <h2>Đăng nhập</h2>
        <label>Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Mật khẩu<input type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        {error && <div className="alert warning">{error}</div>}
        <button className="btn primary full" disabled={busy}>{busy ? 'Đang xử lý...' : 'Đăng nhập'}</button>
      </form>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [mobile, setMobile] = useState(false)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [data, setData] = useState({ products: [], orders: [], customers: [], suppliers: [] })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    loadAll()
    const channel = supabase
      .channel('zoneg-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, loadAll)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session])

  async function loadAll() {
    setSyncing(true)
    setNotice('')
    const results = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').order('created_at', { ascending: false }),
    ])
    const firstError = results.find(r => r.error)?.error
    if (firstError) {
      setNotice(`Không thể tải dữ liệu: ${firstError.message}`)
    } else {
      setData({
        products: results[0].data || [],
        orders: results[1].data || [],
        customers: results[2].data || [],
        suppliers: results[3].data || [],
      })
    }
    setSyncing(false)
  }

  async function createProduct(form) {
    setNotice('')
    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category.trim() || null,
      brand: form.brand.trim() || null,
      price: Number(form.price || 0),
      cost: Number(form.cost || 0),
      stock: Number(form.stock || 0),
      min_stock: Number(form.min_stock || 0),
      status: 'active',
      updated_at: new Date().toISOString(),
    }

    const { data: existing, error: checkError } = await supabase
      .from('products')
      .select('id')
      .eq('sku', payload.sku)
      .maybeSingle()

    if (checkError) throw checkError
    if (existing) throw new Error(`Mã sản phẩm ${payload.sku} đã tồn tại.`)

    const { data: inserted, error } = await supabase
      .from('products')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    setData(current => ({
      ...current,
      products: [inserted, ...current.products.filter(p => p.id !== inserted.id)]
    }))
    setNotice(`Đã lưu sản phẩm ${inserted.sku} lên Supabase.`)
    return inserted
  }

  async function deleteProduct(id) {
    if (!window.confirm('Xóa sản phẩm này khỏi hệ thống?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      setNotice(`Không thể xóa: ${error.message}`)
      return
    }
    setData(current => ({ ...current, products: current.products.filter(p => p.id !== id) }))
    setNotice('Đã xóa sản phẩm.')
  }

  const lowStock = useMemo(
    () => data.products.filter(p => Number(p.stock || 0) <= Number(p.min_stock || 0)),
    [data.products]
  )
  const revenue = useMemo(
    () => data.orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + Number(o.total || 0), 0),
    [data.orders]
  )

  if (loading) return <div className="splash">Đang khởi động ZoneG Sport...</div>
  if (!session) return <Login onLogin={setSession} />

  return (
    <div className="app">
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-logo">ZG</div>
          <div><strong>ZoneG Sport</strong><small>Kết nối thể thao Việt</small></div>
          <button className="icon mobile" onClick={() => setMobile(false)}><X /></button>
        </div>
        <nav>
          {navItems.map(([id, label, Icon]) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setMobile(false) }}>
              <Icon size={19}/><span>{label}</span>
              {id === 'inventory' && lowStock.length > 0 && <b>{lowStock.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div style={{fontSize: 12, color: '#6ee7c7', padding: '8px 12px'}}>• Đã đồng bộ</div>
          <button><Settings size={18}/> Cài đặt</button>
          <button onClick={() => supabase.auth.signOut()}><LogOut size={18}/> Đăng xuất</button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon mobile" onClick={() => setMobile(true)}><Menu /></button>
          <div>
            <span className="eyebrow">HỆ THỐNG QUẢN TRỊ NỘI BỘ</span>
            <h1>{navItems.find(x => x[0] === page)?.[1]}</h1>
          </div>
          <div className="topbar-right">
            <button className="btn" onClick={loadAll}><RefreshCw size={17}/>{syncing ? 'Đang tải...' : 'Làm mới'}</button>
          </div>
        </header>

        <section className="content">
          {notice && <div className="alert info">{notice}</div>}
          {page === 'dashboard' && <Dashboard data={data} lowStock={lowStock} revenue={revenue} setPage={setPage} />}
          {page === 'products' && (
            <Products
              rows={data.products}
              query={query}
              setQuery={setQuery}
              onAdd={() => setModal('product')}
              onDelete={deleteProduct}
            />
          )}
          {page === 'inventory' && <Inventory rows={data.products} />}
          {page === 'orders' && <Orders rows={data.orders} />}
          {page === 'customers' && <Directory title="Khách hàng" rows={data.customers} icon={Contact} />}
          {page === 'suppliers' && <Directory title="Nhà cung cấp" rows={data.suppliers} icon={Truck} />}
          {page === 'invoices' && <Placeholder title="Hóa đơn" text="Module hóa đơn sẽ được hoàn thiện tiếp theo." />}
          {page === 'reports' && <Placeholder title="Báo cáo" text="Module báo cáo sẽ được hoàn thiện tiếp theo." />}
        </section>
      </main>

      {modal === 'product' && (
        <ProductModal
          onClose={() => setModal(null)}
          onSave={async form => {
            await createProduct(form)
            setModal(null)
          }}
        />
      )}
    </div>
  )
}

function ProductModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    sku: '', name: '', category: '', brand: '',
    price: '', cost: '', stock: '', min_stock: ''
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function update(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!form.sku.trim()) throw new Error('Vui lòng nhập mã sản phẩm.')
      if (!form.name.trim()) throw new Error('Vui lòng nhập tên sản phẩm.')
      await onSave(form)
    } catch (err) {
      setError(err.message || 'Không thể lưu sản phẩm.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div><span className="eyebrow">ZONEG SPORT</span><h2>Thêm sản phẩm</h2></div>
          <button type="button" className="icon" onClick={onClose}><X /></button>
        </div>
        {error && <div className="alert warning">{error}</div>}
        <div className="form-grid">
          <label>Mã sản phẩm *<input value={form.sku} onChange={e => update('sku', e.target.value)} placeholder="SP-0001" /></label>
          <label>Tên sản phẩm *<input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Áo bóng đá ZoneG" /></label>
        </div>
        <div className="form-grid">
          <label>Danh mục<input value={form.category} onChange={e => update('category', e.target.value)} /></label>
          <label>Thương hiệu<input value={form.brand} onChange={e => update('brand', e.target.value)} /></label>
        </div>
        <div className="form-grid">
          <label>Giá bán<input type="number" min="0" value={form.price} onChange={e => update('price', e.target.value)} /></label>
          <label>Giá nhập<input type="number" min="0" value={form.cost} onChange={e => update('cost', e.target.value)} /></label>
        </div>
        <div className="form-grid">
          <label>Tồn hiện tại<input type="number" min="0" value={form.stock} onChange={e => update('stock', e.target.value)} /></label>
          <label>Tồn tối thiểu<input type="number" min="0" value={form.min_stock} onChange={e => update('min_stock', e.target.value)} /></label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Hủy</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu sản phẩm'}</button>
        </div>
      </form>
    </div>
  )
}

function Products({ rows, query, setQuery, onAdd, onDelete }) {
  const filtered = rows.filter(p =>
    `${p.sku} ${p.name} ${p.category || ''}`.toLowerCase().includes(query.toLowerCase())
  )
  return (
    <>
      <div style={{display:'flex', justifyContent:'space-between', gap:12, marginBottom:16}}>
        <div className="search-box"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm sản phẩm..." /></div>
        <button className="btn primary" onClick={onAdd}><Plus size={18}/> Thêm sản phẩm</button>
      </div>
      <div className="table-card">
        <table>
          <thead><tr><th>SKU</th><th>Tên sản phẩm</th><th>Danh mục</th><th>Giá bán</th><th>Tồn</th><th></th></tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className={Number(p.stock) <= Number(p.min_stock) ? 'danger-row' : ''}>
                <td><code>{p.sku}</code></td>
                <td><strong>{p.name}</strong><small>{p.brand || '—'}</small></td>
                <td>{p.category || '—'}</td>
                <td>{money(p.price)}</td>
                <td><b>{p.stock}</b><small>Tối thiểu {p.min_stock}</small></td>
                <td><button className="link" onClick={() => onDelete(p.id)}>Xóa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <div className="placeholder" style={{padding:40}}>Chưa có dữ liệu.</div>}
      </div>
    </>
  )
}

function Dashboard({ data, lowStock, revenue, setPage }) {
  const stockQty = data.products.reduce((s, p) => s + Number(p.stock || 0), 0)
  return <>
    {lowStock.length > 0 && <div className="attention"><AlertTriangle/><div><strong>{lowStock.length} sản phẩm cần chú ý</strong><span>Tồn kho thấp hoặc đã hết.</span></div><button onClick={() => setPage('inventory')}>Kiểm tra kho</button></div>}
    <div className="stats">
      <Stat title="Doanh thu hoàn thành" value={money(revenue)} note="Tổng đơn hoàn thành" tone="green"/>
      <Stat title="Đơn hàng" value={data.orders.length} note="Tổng đơn đang quản lý" tone="orange"/>
      <Stat title="Số mẫu sản phẩm" value={data.products.length} note={`${stockQty} đơn vị tồn kho`}/>
      <Stat title="Khách hàng" value={data.customers.length} note="Hồ sơ đang quản lý"/>
    </div>
  </>
}
function Stat({title,value,note,tone=''}) { return <div className={`stat ${tone}`}><span>{title}</span><strong>{value}</strong><small>{note}</small></div> }
function Inventory({rows}) { return <Products rows={rows} query="" setQuery={()=>{}} onAdd={()=>{}} onDelete={()=>{}}/> }
function Orders({rows}) { return <div className="table-card"><table><thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Ngày</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead><tbody>{rows.map(o=><tr key={o.id}><td><code>{o.code}</code></td><td>{o.customer_name||'Khách lẻ'}</td><td>{fmtDate(o.created_at)}</td><td>{money(o.total)}</td><td>{o.status}</td></tr>)}</tbody></table></div> }
function Directory({rows,icon:Icon}) { return <div className="cards">{rows.map(x=><div className="person-card" key={x.id}><div className="avatar"><Icon/></div><div><strong>{x.name}</strong><small>{x.phone||'Chưa có số điện thoại'}</small></div></div>)}</div> }
function Placeholder({title,text}) { return <div className="placeholder"><ClipboardList size={48}/><h2>{title}</h2><p>{text}</p></div> }
