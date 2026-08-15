import React, { useState, useEffect, useContext } from 'react';
import { AuthContext, SocketContext } from '../App';
import { useNavigate } from 'react-router-dom';
import ItemEditModal from '../components/ItemEditModal';
import CustomSelect from '../components/CustomSelect';
import useFavicon from '../hooks/useFavicon';
import { formatTicketCode } from '../utils/formatTicket';

// ─── Menu Item Card (clean view only, click opens modal) ────────────────────
function MenuItemCard({ item, onClick }) {
  const priceVal = typeof item.price === 'number' ? item.price : (parseFloat(item.price) || 0);
  const isCooking = item.requiresCooking !== false;

  return (
    <div
      className="glass"
      style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: 'pointer' }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>{item.name}</strong>
          <span style={{ 
            fontSize: '0.75rem', 
            fontWeight: '600', 
            color: isCooking ? 'var(--warning)' : 'var(--info)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.04em' 
          }}>
            {isCooking ? '🍳 Cooking' : '🛍️ Grab & Go'}
          </span>
        </div>
        <span style={{ color: 'var(--success)', fontWeight: '700', fontSize: '1.15rem' }}>
          ${priceVal.toFixed(2)}
        </span>
      </div>

      {item.options?.length > 0 && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '0' }} />
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

      <div style={{ marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)' }}>
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
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemRequiresCooking, setNewItemRequiresCooking] = useState(true);
  const [newItemCategoryId, setNewItemCategoryId] = useState('');
  const [pendingOptions, setPendingOptions] = useState([]);
  const [newOptName, setNewOptName] = useState('Ingredients');
  const [newOptChoices, setNewOptChoices] = useState('');
  const [newOptDefaultOn, setNewOptDefaultOn] = useState(true);
  const [newOptRequired, setNewOptRequired] = useState(false);
  const [createdItemId, setCreatedItemId] = useState(null);

  // Currently editing item (modal state)
  const [editingItem, setEditingItem] = useState(null);

  // User PIN form state
  const [pinUserId, setPinUserId] = useState('');
  const [newPin, setNewPin] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [pinMessage, setPinMessage] = useState(null);

  // Database & Backup state
  const [dbStats, setDbStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [exportMode, setExportMode] = useState('menu');
  const [exportIncludeUsers, setExportIncludeUsers] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Import state
  const [importParsed, setImportParsed] = useState(null);
  const [importFileName, setImportFileName] = useState('');
  const [importMode, setImportMode] = useState('merge');
  const [importIncludeUsers, setImportIncludeUsers] = useState(true);
  const [importIncludeOrders, setImportIncludeOrders] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);

  useEffect(() => { 
    fetchMenu(); 
    fetchUsers(); 
    fetchDbStats();
  }, []);

  const fetchDbStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin/database/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDbStats(data);
      }
    } catch (err) {
      console.error('Error fetching database stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = `/api/admin/database/export?mode=${exportMode}&includeUsers=${exportIncludeUsers}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to generate export file');
        return;
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `snack-shack-${exportMode}-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Export error:', err);
      alert('Error downloading export file');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        if (!json || !json.data || !Array.isArray(json.data.categories)) {
          setImportMessage({ type: 'error', text: 'Invalid backup file. Missing data.categories in JSON.' });
          setImportParsed(null);
          return;
        }
        setImportParsed(json);
        if (json.data.orders && json.data.orders.length > 0) {
          setImportIncludeOrders(true);
        } else {
          setImportIncludeOrders(false);
        }
      } catch (parseErr) {
        setImportMessage({ type: 'error', text: 'Failed to parse JSON file: ' + parseErr.message });
        setImportParsed(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!importParsed) return;
    setIsImporting(true);
    setImportMessage(null);
    try {
      const res = await fetch('/api/admin/database/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payload: importParsed,
          mode: importMode,
          importOrders: importIncludeOrders,
          importUsers: importIncludeUsers
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setImportMessage({
          type: 'success',
          text: `${result.message} Imported ${result.counts?.categories || 0} categories, ${result.counts?.menuItems || 0} items, ${result.counts?.options || 0} option groups, ${result.counts?.users || 0} accounts, and ${result.counts?.orders || 0} orders.`
        });
        fetchMenu();
        fetchUsers();
        fetchDbStats();
        setShowReplaceModal(false);
      } else {
        setImportMessage({ type: 'error', text: result.error || 'Import failed' });
      }
    } catch (err) {
      setImportMessage({ type: 'error', text: 'Import request failed: ' + err.message });
    } finally {
      setIsImporting(false);
    }
  };

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
    setPendingOptions(prev => [...prev, { name: newOptName, choices: newOptChoices.trim(), defaultOn: newOptDefaultOn, required: newOptRequired }]);
    setNewOptChoices('');
    setNewOptDefaultOn(true);
    setNewOptRequired(false);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ 
        name: newItemName, 
        price: parseFloat(newItemPrice) || 0.0,
        requiresCooking: newItemRequiresCooking,
        categoryId: parseInt(newItemCategoryId) 
      })
    });
    const item = await res.json();
    for (const opt of pendingOptions) {
      await fetch(`/api/admin/menu/${item.id}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(opt)
      });
    }
    setNewItemName('');
    setNewItemPrice('');
    setNewItemRequiresCooking(true);
    setPendingOptions([]);
    setCreatedItemId(item.id);
    fetchMenu();
    setTimeout(() => setCreatedItemId(null), 3000);
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    if (!pinUserId) {
      setPinMessage({ type: 'error', text: 'Please select an account.' });
      return;
    }
    if (!newPin.trim()) {
      setPinMessage({ type: 'error', text: 'Please enter a new PIN.' });
      return;
    }
    if (!masterPassword) {
      setPinMessage({ type: 'error', text: 'Master Admin Password is required to change PINs.' });
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${pinUserId}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin: newPin.trim(), masterPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setPinMessage({ type: 'success', text: '✓ PIN successfully updated!' });
        setNewPin('');
        setMasterPassword('');
        setTimeout(() => setPinMessage(null), 4000);
      } else {
        setPinMessage({ type: 'error', text: data.error || 'Failed to update PIN.' });
      }
    } catch (err) {
      setPinMessage({ type: 'error', text: 'Connection error while updating PIN.' });
    }
  };

  return (
    <>
      <div className="topbar glass">
        <h2>Admin Panel</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('menu')}>Menu</button>
          <button className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setActiveTab('history'); fetchHistory(); }}>Order History</button>
          <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('users')}>User PINs</button>
          <button className={`btn ${activeTab === 'data' ? 'btn-primary' : 'btn-outline'}`} onClick={() => { setActiveTab('data'); fetchDbStats(); }}>Data & Backup</button>
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
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div className="input" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '0 0 110px', padding: '0 0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', width: '100%', outline: 'none', fontSize: '1rem', fontFamily: 'inherit', padding: '0.75rem 0' }}
                    placeholder="0.00"
                    value={newItemPrice}
                    onChange={e => setNewItemPrice(e.target.value)}
                    onBlur={() => {
                      const num = parseFloat(newItemPrice);
                      if (!isNaN(num)) setNewItemPrice(num.toFixed(2));
                    }}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <CustomSelect
                    options={categories.map(c => ({ value: c.id, label: c.name }))}
                    value={newItemCategoryId}
                    onChange={val => setNewItemCategoryId(val)}
                    onAddNew={handleCreateCategory}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '0.95rem' }}>
                <input 
                  type="checkbox" 
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  checked={newItemRequiresCooking} 
                  onChange={e => setNewItemRequiresCooking(e.target.checked)} 
                />
                Requires Cooking
              </label>

              {pendingOptions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {pendingOptions.map((o, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)' }}>
                      <span><strong>{o.name}</strong>: {o.choices}</span>
                      <span style={{ color: o.defaultOn ? 'var(--success)' : 'var(--warning)', fontWeight: '600', marginLeft: '0.5rem' }}>{o.defaultOn ? 'ON' : 'OFF'}</span>
                      <button 
                        type="button" 
                        className="btn btn-outline" 
                        style={{ 
                          minWidth: 'var(--touch-min)', 
                          minHeight: 'var(--touch-min)', 
                          padding: 0, 
                          borderRadius: 'var(--radius-sm)', 
                          color: 'var(--danger)', 
                          borderColor: 'rgba(239, 68, 68, 0.3)', 
                          marginLeft: '0.5rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }} 
                        onClick={() => setPendingOptions(prev => prev.filter((_, j) => j !== i))}
                      >×</button>
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
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <input type="checkbox" style={{ width: '16px', height: '16px' }} checked={newOptRequired} onChange={e => setNewOptRequired(e.target.checked)} />
                  Required (At least 1 choice must be selected)
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
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem', alignItems: 'center' }}>
                    <input className="input" value={editCatName} onChange={e => setEditCatName(e.target.value)} placeholder="Category Name" style={{ flex: 1 }} />
                    <button className="btn btn-success" onClick={() => handleSaveCategoryName(cat.id)}>Save</button>
                    <button className="btn btn-outline" onClick={() => setEditingCatId(null)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>{cat.name}</h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-outline"
                          style={{ minHeight: 'var(--touch-min)', padding: '0 1rem', fontSize: '0.9rem' }}
                          onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }}
                        >
                          Rename
                        </button>
                        {(!cat.menuItems || cat.menuItems.length === 0) && (
                          <button
                            className="btn btn-danger"
                            style={{ minHeight: 'var(--touch-min)', padding: '0 1rem', fontSize: '0.9rem' }}
                            onClick={() => handleDeleteCategory(cat.id)}
                          >
                            Delete
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
            {historyOrders.map(order => {
              const orderTotal = (order.orderItems || []).reduce((acc, curr) => acc + (parseFloat(curr.menuItem?.price) || 0) * (curr.quantity || 1), 0);
              return (
                <div key={order.id} className="glass glass-card ticket">
                  <div className="ticket-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                        {order.customerName || formatTicketCode(order.orderNumber)}
                      </h3>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        {order.customerName ? `${formatTicketCode(order.orderNumber)} • ` : ''}{new Date(order.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                      <span className="badge" style={{ background: order.status === 'completed' ? 'var(--success)' : 'var(--danger)', color: '#fff' }}>
                        {order.status === 'completed' ? 'Completed' : 'Recalled'}
                      </span>
                      {orderTotal > 0 && (
                        <span style={{ color: 'var(--success)', fontWeight: '800', fontSize: '1.1rem' }}>
                          ${orderTotal.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ticket-items" style={{ margin: '0.75rem 0' }}>
                    {(order.orderItems || []).map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                          <span className="item-bullet" />
                          <span>{item.menuItem?.name || 'Item'}</span>
                        </div>
                        {item.menuItem?.price > 0 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '500' }}>
                            ${((parseFloat(item.menuItem?.price) || 0) * (item.quantity || 1)).toFixed(2)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <button 
                    className="btn btn-outline" 
                    style={{ width: '100%', borderColor: 'var(--primary)', color: 'var(--primary)', marginTop: '0.5rem', minHeight: 'var(--touch-min)' }}
                    onClick={() => handleRecallOrder(order.id)}
                  >
                    ↩ Recall to Active Queue
                  </button>
                </div>
              );
            })}
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
            {pinMessage && (
              <div style={{
                color: pinMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                background: pinMessage.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${pinMessage.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                marginTop: '1rem',
                fontSize: '0.95rem',
                fontWeight: '600'
              }}>
                {pinMessage.text}
              </div>
            )}
            <form onSubmit={handleChangePin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: '600' }}>Select Account</label>
                <CustomSelect
                  options={users.map(u => ({ value: u.id, label: `${u.username} (${u.role})` }))}
                  value={pinUserId}
                  onChange={val => setPinUserId(val)}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: '600' }}>New PIN</label>
                <input 
                  type="password" 
                  className="input" 
                  placeholder="Enter new 4-digit PIN" 
                  value={newPin} 
                  onChange={e => setNewPin(e.target.value)} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  Master Admin Password <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input 
                  type="password" 
                  className="input" 
                  placeholder="Enter server Master Admin Password" 
                  value={masterPassword} 
                  onChange={e => setMasterPassword(e.target.value)} 
                  autoComplete="current-password"
                />
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Configured in server <code>.env</code> (<code>ADMIN_MASTER_PASSWORD</code>) to protect against unauthorized PIN modifications.
                </span>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.9rem', fontSize: '1.05rem', fontWeight: '700' }}>
                Update PIN
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Data & Backup Tab */}
      {activeTab === 'data' && (
        <div className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem', overflowY: 'auto' }}>
          
          {/* Top: Live Database Statistics Bar */}
          <div className="glass glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Database Overview</h3>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Live summary of local database records
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ padding: '0.5rem 0.85rem', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', textAlign: 'center', minWidth: '90px' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>{dbStats?.categoryCount ?? '...'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Categories</div>
              </div>

              <div style={{ padding: '0.5rem 0.85rem', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', textAlign: 'center', minWidth: '90px' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--primary)' }}>{dbStats?.menuItemCount ?? '...'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Menu Items</div>
              </div>

              <div style={{ padding: '0.5rem 0.85rem', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', textAlign: 'center', minWidth: '90px' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-subtle)' }}>{dbStats?.itemOptionCount ?? '...'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Option Groups</div>
              </div>

              <div style={{ padding: '0.5rem 0.85rem', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', textAlign: 'center', minWidth: '90px' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--success)' }}>{dbStats?.userCount ?? '...'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Accounts</div>
              </div>

              <div style={{ padding: '0.5rem 0.85rem', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', textAlign: 'center', minWidth: '90px' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--warning)' }}>{dbStats?.totalOrdersCount ?? '...'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Orders</div>
              </div>

              <button 
                type="button"
                className="btn btn-outline" 
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem' }} 
                onClick={fetchDbStats}
                disabled={statsLoading}
              >
                {statsLoading ? 'Refreshing...' : '↻ Refresh'}
              </button>
            </div>
          </div>

          {/* Feedback banner */}
          {importMessage && (
            <div 
              style={{ 
                padding: '1rem 1.25rem', 
                borderRadius: 'var(--radius-md)', 
                background: importMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${importMessage.type === 'success' ? 'var(--success-border)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: importMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <span>{importMessage.text}</span>
              <button 
                type="button"
                className="btn btn-icon btn-outline" 
                style={{ border: 'none', color: 'inherit', background: 'transparent', fontSize: '1.2rem', cursor: 'pointer' }}
                onClick={() => setImportMessage(null)}
              >×</button>
            </div>
          )}

          {/* Two Columns: Export on Left, Import on Right */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'flex-start' }}>

            {/* Column 1: Export Database */}
            <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Export Database</h3>
                <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Download a portable JSON snapshot to backup or transfer to an offline server.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ color: 'var(--text-subtle)', fontWeight: '600', fontSize: '0.95rem' }}>Export Scope</label>
                
                {/* Option 1: Menu Only */}
                <div 
                  onClick={() => setExportMode('menu')}
                  style={{ 
                    padding: '0.85rem 1rem', 
                    borderRadius: 'var(--radius-md)', 
                    border: `1px solid ${exportMode === 'menu' ? 'var(--primary)' : 'var(--glass-border)'}`,
                    background: exportMode === 'menu' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Menu & Catalog Only</strong>
                    <input type="radio" name="exportMode" checked={exportMode === 'menu'} onChange={() => setExportMode('menu')} />
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Categories, menu items, and option groups. Ideal for setting up or updating another server without copying order queues.
                  </span>
                </div>

                {/* Option 2: Full Snapshot */}
                <div 
                  onClick={() => setExportMode('full')}
                  style={{ 
                    padding: '0.85rem 1rem', 
                    borderRadius: 'var(--radius-md)', 
                    border: `1px solid ${exportMode === 'full' ? 'var(--primary)' : 'var(--glass-border)'}`,
                    background: exportMode === 'full' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Full Database Snapshot</strong>
                    <input type="radio" name="exportMode" checked={exportMode === 'full'} onChange={() => setExportMode('full')} />
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Complete dump including menu catalog, accounts, active orders, and historical orders.
                  </span>
                </div>
              </div>

              {/* Toggle: Include Users */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '0.95rem' }}>
                <input 
                  type="checkbox" 
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  checked={exportIncludeUsers} 
                  onChange={e => setExportIncludeUsers(e.target.checked)} 
                />
                Include User Accounts & Login PINs
              </label>

              <button 
                type="button"
                className="btn btn-primary" 
                style={{ padding: '0.9rem', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? 'Generating Export...' : '⬇ Download JSON Backup'}
              </button>
            </div>

            {/* Column 2: Import & Restore */}
            <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Import & Restore</h3>
                <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Load an exported JSON file to populate or sync this instance.
                </p>
              </div>

              {/* File selector */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-subtle)', fontSize: '0.95rem', fontWeight: '600' }}>
                  Select Backup JSON File
                </label>
                <input 
                  type="file" 
                  accept=".json,application/json" 
                  onChange={handleFileSelect}
                  className="input"
                  style={{ padding: '0.5rem', cursor: 'pointer' }}
                />
              </div>

              {/* File Inspector Preview */}
              {importParsed && (
                <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--primary)' }}>File Inspected</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{importParsed.exportedAt ? new Date(importParsed.exportedAt).toLocaleString() : 'Valid format'}</span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-main)' }}>
                      {importParsed.data?.categories?.length || 0} Categories
                    </span>
                    <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--primary)' }}>
                      {(importParsed.data?.categories || []).reduce((s, c) => s + (c.menuItems?.length || 0), 0)} Items
                    </span>
                    <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}>
                      {importParsed.data?.users?.length || 0} Accounts
                    </span>
                    <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }}>
                      {importParsed.data?.orders?.length || 0} Orders
                    </span>
                  </div>

                  {/* Mode Selector */}
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-subtle)', fontWeight: '600' }}>Restore Strategy:</label>
                    
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', padding: '0.5rem', background: importMode === 'merge' ? 'rgba(255,255,255,0.06)' : 'transparent', borderRadius: 'var(--radius-sm)' }}>
                      <input 
                        type="radio" 
                        name="importMode" 
                        value="merge" 
                        checked={importMode === 'merge'} 
                        onChange={() => setImportMode('merge')} 
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>Merge (Safe)</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Adds missing categories & items without deleting existing data.</div>
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', padding: '0.5rem', background: importMode === 'replace' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', borderRadius: 'var(--radius-sm)' }}>
                      <input 
                        type="radio" 
                        name="importMode" 
                        value="replace" 
                        checked={importMode === 'replace'} 
                        onChange={() => setImportMode('replace')} 
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <strong style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>Replace (Clean Slate)</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Overwrites the current menu with the backup file.</div>
                      </div>
                    </label>
                  </div>

                  {/* Options */}
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <input 
                        type="checkbox" 
                        checked={importIncludeUsers} 
                        onChange={e => setImportIncludeUsers(e.target.checked)} 
                      />
                      Import User Accounts ({importParsed.data?.users?.length || 0} found)
                    </label>

                    {importParsed.data?.orders?.length > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <input 
                          type="checkbox" 
                          checked={importIncludeOrders} 
                          onChange={e => setImportIncludeOrders(e.target.checked)} 
                        />
                        Import Order History ({importParsed.data?.orders?.length || 0} found)
                      </label>
                    )}
                  </div>
                </div>
              )}

              <button 
                type="button"
                className={`btn ${importMode === 'replace' ? 'btn-danger' : 'btn-success'}`}
                style={{ padding: '0.9rem', fontSize: '1rem' }}
                onClick={() => {
                  if (importMode === 'replace') {
                    setShowReplaceModal(true);
                  } else {
                    handleExecuteImport();
                  }
                }}
                disabled={!importParsed || isImporting}
              >
                {isImporting ? 'Processing Import...' : importMode === 'replace' ? '⚠ Replace Database' : '⬆ Run Merge Import'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Safety Confirmation Modal for Replace Mode */}
      {showReplaceModal && (
        <div className="modal-overlay" onClick={() => setShowReplaceModal(false)}>
          <div className="glass glass-card modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', textAlign: 'center', padding: '2rem' }}>
            <h3 style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '1.4rem' }}>⚠️ Confirm Replace & Overwrite</h3>
            <p style={{ color: 'var(--text-main)', lineHeight: '1.6', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Are you sure you want to replace all current menu categories and items with the backup file <strong>{importFileName}</strong>?
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              This will reset the current menu to match the imported backup file.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                type="button"
                className="btn btn-outline" 
                style={{ flex: 1, minHeight: 'var(--touch-min)' }} 
                onClick={() => setShowReplaceModal(false)}
                disabled={isImporting}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-danger" 
                style={{ flex: 1, minHeight: 'var(--touch-min)' }} 
                onClick={handleExecuteImport}
                disabled={isImporting}
              >
                {isImporting ? 'Restoring...' : 'Yes, Replace'}
              </button>
            </div>
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
