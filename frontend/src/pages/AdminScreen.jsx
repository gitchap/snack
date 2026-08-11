import React, { useState, useEffect, useContext } from 'react';
import { AuthContext, SocketContext } from '../App';
import { useNavigate } from 'react-router-dom';
import ItemEditModal from '../components/ItemEditModal';
import CustomSelect from '../components/CustomSelect';
import useFavicon from '../hooks/useFavicon';
import { formatTicketCode } from '../utils/formatTicket';

// ─── Menu Item Card (clean view only, click opens modal) ────────────────────
function MenuItemCard({ item, onClick }) {
  return (
    <div
      className="glass"
      style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '1.2rem', color: '#fff' }}>{item.name}</strong>
      </div>

      {item.options?.length > 0 && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {item.options.map(o => (
              <div key={o.id}>
                {/* Header on its own line */}
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>{o.name}:</strong>
                </div>
                {/* Choices indented below with clean word wrap */}
                <div style={{ paddingLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5', wordBreak: 'break-word' }}>
                  {o.choices}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ color: 'var(--primary)', fontSize: '0.9rem', opacity: 0.9 }}>Click to edit</span>
      </div>
    </div>
  );
}

// ─── Main Admin Screen ───────────────────────────────────────────────────────
export default function AdminScreen() {
  useFavicon('admin.png', 'Admin Panel - Snack Shack');
  const { token, logout } = useContext(AuthContext);
  const socket = useContext(SocketContext);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('menu');
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  // Order History state
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historySearch, setHistorySearch] = useState('');

  // Add Item form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategoryId, setNewItemCategoryId] = useState('');
  const [pendingOptions, setPendingOptions] = useState([]);
  const [newOptName, setNewOptName] = useState('Ingredients');
  const [newOptChoices, setNewOptChoices] = useState('');
  const [newOptDefaultOn, setNewOptDefaultOn] = useState(true);
  const [createdItemId, setCreatedItemId] = useState(null);

  // Currently editing item (modal state)
  const [editingItem, setEditingItem] = useState(null);

  // User PIN form state
  const [pinUserId, setPinUserId] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  useEffect(() => { fetchMenu(); fetchUsers(); }, []);

  const fetchHistory = async (searchQuery = historySearch) => {
    try {
      const url = `/api/orders/history${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`;
      const r = await fetch(url);
      const data = await r.json();
      if (Array.isArray(data)) setHistoryOrders(data);
    } catch (e) {
      console.error('Error fetching order history:', e);
    }
  };

  const handleRecallOrder = (orderId) => {
    if (socket) {
      socket.emit('recall_order', { orderId });
      setTimeout(() => fetchHistory(), 300);
    }
  };

  // Category management state
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState('');

  const handleCreateCategory = async (name) => {
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      const created = await res.json();
      await fetchMenu();
      setNewItemCategoryId(created.id);
      return created;
    }
  };

  const handleSaveCategoryName = async (catId) => {
    if (!editCatName.trim()) return;
    const res = await fetch(`/api/admin/categories/${catId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: editCatName.trim() })
    });
    if (res.ok) {
      setEditingCatId(null);
      fetchMenu();
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Delete this category?')) return;
    const res = await fetch(`/api/admin/categories/${catId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      fetchMenu();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to delete category');
    }
  };

  const fetchMenu = async () => {
    try {
      const r = await fetch('/api/menu');
      const data = await r.json();
      setCategories(data);
      if (data.length > 0 && !newItemCategoryId) setNewItemCategoryId(data[0].id);
    } catch (e) {
      console.error('Error fetching menu:', e);
    }
  };

  const fetchUsers = () => {
    fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json()).then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
          if (data.length > 0) setPinUserId(data[0].id);
        }
      });
  };

  const addPendingOption = (e) => {
    e.preventDefault();
    if (!newOptChoices.trim()) return;
    setPendingOptions(prev => [...prev, { name: newOptName, choices: newOptChoices.trim(), defaultOn: newOptDefaultOn }]);
    setNewOptChoices('');
    setNewOptDefaultOn(true);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: newItemName, categoryId: parseInt(newItemCategoryId) })
    });
    const item = await res.json();
    for (const opt of pendingOptions) {
      await fetch(`/api/admin/menu/${item.id}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(opt)
      });
    }
    setNewItemName(''); setPendingOptions([]);
    setCreatedItemId(item.id);
    fetchMenu();
    setTimeout(() => setCreatedItemId(null), 3000);
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/admin/users/${pinUserId}/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ pin: newPin })
    });
    if (res.ok) { setPinMessage('PIN updated!'); setNewPin(''); setTimeout(() => setPinMessage(''), 3000); }
  };

  return (
    <>
      <div className="topbar glass">
        <h2>Admin Panel</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('menu')}>Menu</button>
          <button className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setActiveTab('history'); fetchHistory(); }}>Order History</button>
          <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('users')}>User PINs</button>
          <button className="btn btn-outline" onClick={() => navigate('/order')}>Kiosk</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>

      {activeTab === 'menu' && (
        <div className="main-content" style={{ display: 'flex', gap: '1.5rem', padding: '0.75rem', alignItems: 'flex-start', overflowY: 'auto' }}>

          {/* Left: Add New Item card */}
          <div className="glass glass-card" style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3>Add New Item</h3>
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input className="input" placeholder="Item Name" value={newItemName} onChange={e => setNewItemName(e.target.value)} required />
              <CustomSelect
                options={categories.map(c => ({ value: c.id, label: c.name }))}
                value={newItemCategoryId}
                onChange={val => setNewItemCategoryId(val)}
                onAddNew={handleCreateCategory}
              />

              {pendingOptions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {pendingOptions.map((o, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)' }}>
                      <span><strong>{o.name}</strong>: {o.choices}</span>
                      <span style={{ color: o.defaultOn ? 'var(--success)' : 'var(--warning)', fontWeight: '600', marginLeft: '0.5rem' }}>{o.defaultOn ? 'ON' : 'OFF'}</span>
                      <button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.2rem', marginLeft: '0.5rem' }} onClick={() => setPendingOptions(prev => prev.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px dashed rgba(139,92,246,0.3)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ margin: 0, color: 'var(--primary)', fontWeight: '600' }}>+ Option Group (optional)</p>
                <input className="input" placeholder="Group name" value={newOptName} onChange={e => setNewOptName(e.target.value)} />
                <input className="input" placeholder="Choices: Lettuce, Tomato, Mayo" value={newOptChoices} onChange={e => setNewOptChoices(e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <input type="checkbox" style={{ width: '16px', height: '16px' }} checked={newOptDefaultOn} onChange={e => setNewOptDefaultOn(e.target.checked)} />
                  Default ON (pre-selected when ordering)
                </label>
                <button type="button" className="btn btn-outline" onClick={addPendingOption}>Save Group</button>
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '0.85rem' }}>Create Item</button>
              {createdItemId && <p style={{ color: 'var(--success)', textAlign: 'center', margin: 0 }}>✓ Item created!</p>}
            </form>
          </div>

          {/* Right: Menu overview */}
          <div style={{ flex: 1, maxHeight: 'calc(100vh - 130px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {categories.map(cat => (
              <div key={cat.id} className="glass glass-card">
                {editingCatId === cat.id ? (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem', alignItems: 'center' }}>
                    <input className="input" value={editCatName} onChange={e => setEditCatName(e.target.value)} placeholder="Category Name" style={{ flex: 1 }} />
                    <button className="btn btn-success" onClick={() => handleSaveCategoryName(cat.id)}>Save</button>
                    <button className="btn btn-outline" onClick={() => setEditingCatId(null)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>{cat.name}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                        onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }}
                      >
                        Rename
                      </button>
                      {(!cat.menuItems || cat.menuItems.length === 0) && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                          onClick={() => handleDeleteCategory(cat.id)}
                        >
                          Delete Category
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {(cat.menuItems || []).map(item => (
                    <MenuItemCard
                      key={item.id}
                      item={{ ...item, categoryId: cat.id }}
                      onClick={() => setEditingItem({ ...item, categoryId: cat.id })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Order History Tab */}
      {activeTab === 'history' && (
        <div className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0.75rem', overflowY: 'auto' }}>
          <div className="glass glass-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input 
              className="input" 
              placeholder="Search by customer name or order number..." 
              value={historySearch} 
              onChange={e => {
                setHistorySearch(e.target.value);
                fetchHistory(e.target.value);
              }}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={() => fetchHistory()}>Search</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {historyOrders.map(order => (
              <div key={order.id} className="glass glass-card ticket">
                <div className="ticket-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                      {order.customerName || formatTicketCode(order.orderNumber)}
                    </h3>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {order.customerName ? `${formatTicketCode(order.orderNumber)} • ` : ''}{new Date(order.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <span className="badge" style={{ background: order.status === 'completed' ? 'var(--success)' : 'var(--danger)', color: '#fff' }}>
                    {order.status}
                  </span>
                </div>

                <div className="ticket-items" style={{ margin: '0.75rem 0' }}>
                  {(order.orderItems || []).map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem' }}>
                      <span>{item.quantity}x {item.menuItem?.name || 'Item'}</span>
                    </div>
                  ))}
                </div>

                <button 
                  className="btn btn-outline" 
                  style={{ width: '100%', borderColor: 'var(--primary)', color: 'var(--primary)', marginTop: '0.5rem' }}
                  onClick={() => handleRecallOrder(order.id)}
                >
                  ↩ Recall to Active Queue
                </button>
              </div>
            ))}
            {historyOrders.length === 0 && (
              <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', marginTop: '2rem' }}>No past orders found</p>
            )}
          </div>
        </div>
      )}

      {/* User PINs Tab */}
      {activeTab === 'users' && (
        <div className="main-content" style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass glass-card" style={{ width: '100%', maxWidth: '500px' }}>
            <h3>Manage Account PINs</h3>
            {pinMessage && <div style={{ color: 'var(--success)', margin: '1rem 0' }}>{pinMessage}</div>}
            <form onSubmit={handleChangePin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Select Account</label>
                <CustomSelect
                  options={users.map(u => ({ value: u.id, label: `${u.username} (${u.role})` }))}
                  value={pinUserId}
                  onChange={val => setPinUserId(val)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>New PIN</label>
                <input type="password" className="input" placeholder="Enter new PIN" value={newPin} onChange={e => setNewPin(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.9rem' }}>Update PIN</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <ItemEditModal
          item={editingItem}
          categories={categories}
          token={token}
          onClose={() => setEditingItem(null)}
          onSaved={fetchMenu}
        />
      )}
    </>
  );
}
