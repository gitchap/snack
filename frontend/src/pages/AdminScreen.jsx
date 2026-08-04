import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';

// ─── Inline Item Editor Card ─────────────────────────────────────────────────
function MenuItemCard({ item, categories, token, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price);
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [editOptName, setEditOptName] = useState('');
  const [editOptChoices, setEditOptChoices] = useState('');
  const [editOptDefaultOn, setEditOptDefaultOn] = useState(true);

  const saveItem = async () => {
    await fetch(`/api/admin/menu/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, price: parseFloat(price), categoryId })
    });
    setEditing(false);
    onSaved();
  };

  const deleteItem = async () => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/admin/menu/${item.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    onDeleted();
  };

  const startEditOption = (opt) => {
    setEditingOptionId(opt.id);
    setEditOptName(opt.name);
    setEditOptChoices(opt.choices);
    setEditOptDefaultOn(opt.defaultOn !== false);
  };

  const saveOption = async (optId) => {
    await fetch(`/api/admin/options/${optId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: editOptName, choices: editOptChoices.trim(), defaultOn: editOptDefaultOn })
    });
    setEditingOptionId(null);
    onSaved();
  };

  const deleteOption = async (optId) => {
    await fetch(`/api/admin/options/${optId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    onSaved();
  };

  return (
    <div className="glass" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '1.25rem' }}>{item.name}</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1.2rem' }}>${item.price.toFixed(2)}</span>
          <button
            className="btn btn-icon btn-danger"
            style={{ width: '28px', height: '28px', fontSize: '1.1rem', padding: 0 }}
            onClick={deleteItem}
          >×</button>
        </div>
      </div>

      {/* Option groups listed clearly — full size matching Picture 1 */}
      {item.options && item.options.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {item.options.map(opt => {
            if (editingOptionId === opt.id) {
              return (
                <div key={opt.id} style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <input className="input" value={editOptName} onChange={e => setEditOptName(e.target.value)} placeholder="Group name" />
                  <input className="input" value={editOptChoices} onChange={e => setEditOptChoices(e.target.value)} placeholder="Choices" />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <input type="checkbox" checked={editOptDefaultOn} onChange={e => setEditOptDefaultOn(e.target.checked)} />
                    Default ON (pre-selected)
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-success" style={{ flex: 1 }} onClick={() => saveOption(opt.id)}>Save</button>
                    <button className="btn btn-outline" onClick={() => setEditingOptionId(null)}>Cancel</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={opt.id} style={{ color: '#cbd5e1', lineHeight: '1.5', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span>
                  <strong style={{ color: '#fff' }}>{opt.name}:</strong> {opt.choices}
                  <span style={{ marginLeft: '0.5rem', color: opt.defaultOn !== false ? 'var(--success)' : 'var(--warning)', fontSize: '0.85rem' }}>
                    ({opt.defaultOn !== false ? 'Default ON' : 'Default OFF'})
                  </span>
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.75rem', flexShrink: 0 }}>
                  <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => startEditOption(opt)}>edit</button>
                  <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => deleteOption(opt.id)}>delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit item details button / form */}
      {!editing ? (
        <div style={{ paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
          <button className="btn btn-outline" style={{ padding: '0.35rem 0.85rem' }} onClick={() => setEditing(true)}>
            Edit Item Details
          </button>
        </div>
      ) : (
        <>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Item name" />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="number" step="0.01" className="input" value={price} onChange={e => setPrice(e.target.value)} style={{ flex: 1 }} />
            <select className="input" value={categoryId} onChange={e => setCategoryId(parseInt(e.target.value))} style={{ flex: 1 }}>
              {categories.map(c => <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-success" style={{ flex: 2 }} onClick={saveItem}>Save Changes</button>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Admin Screen ───────────────────────────────────────────────────────
export default function AdminScreen() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('menu');
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  // Add Item form
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategoryId, setNewItemCategoryId] = useState('');

  // Add Option form
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [optionName, setOptionName] = useState('Ingredients');
  const [optionChoices, setOptionChoices] = useState('');
  const [optionDefaultOn, setOptionDefaultOn] = useState(true);

  // User PIN form
  const [pinUserId, setPinUserId] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  useEffect(() => { fetchMenu(); fetchUsers(); }, []);

  const fetchMenu = () => {
    fetch('/api/menu').then(r => r.json()).then(data => {
      setCategories(data);
      if (data.length > 0) {
        if (!newItemCategoryId) setNewItemCategoryId(data[0].id);
        const allItems = data.flatMap(c => c.menuItems || []);
        if (allItems.length > 0 && !selectedMenuItemId) setSelectedMenuItemId(allItems[0].id);
      }
    });
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

  const handleAddItem = async (e) => {
    e.preventDefault();
    await fetch('/api/admin/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: newItemName, price: parseFloat(newItemPrice), categoryId: parseInt(newItemCategoryId) })
    });
    setNewItemName('');
    setNewItemPrice('');
    fetchMenu();
  };

  const handleAddOption = async (e) => {
    e.preventDefault();
    if (!selectedMenuItemId || !optionName || !optionChoices) return;
    await fetch(`/api/admin/menu/${selectedMenuItemId}/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: optionName, choices: optionChoices.trim(), defaultOn: optionDefaultOn })
    });
    setOptionChoices('');
    fetchMenu();
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    if (!pinUserId || !newPin) return;
    const res = await fetch(`/api/admin/users/${pinUserId}/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ pin: newPin })
    });
    if (res.ok) { setPinMessage('PIN updated!'); setNewPin(''); setTimeout(() => setPinMessage(''), 3000); }
  };

  const allMenuItems = categories.flatMap(c => (c.menuItems || []).map(i => ({ ...i, categoryId: c.id })));

  return (
    <>
      <div className="topbar glass">
        <h2>Admin Panel</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('menu')}>Menu & Ingredients</button>
          <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('users')}>User PINs</button>
          <button className="btn btn-outline" onClick={() => navigate('/order')}>Kiosk</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>

      {activeTab === 'menu' && (
        <div className="main-content" style={{ display: 'flex', gap: '1.5rem', padding: '0.5rem', alignItems: 'flex-start', overflowY: 'auto' }}>

          {/* Left: Two cards matching Picture 1 layout */}
          <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Card 1: Add Menu Item */}
            <div className="glass glass-card">
              <h3 style={{ marginBottom: '1rem' }}>Add Menu Item</h3>
              <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input className="input" placeholder="Item Name (e.g. Cheeseburger)" value={newItemName} onChange={e => setNewItemName(e.target.value)} required />
                <input type="number" step="0.01" className="input" placeholder="Price (e.g. 5.50)" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} required />
                <select className="input" value={newItemCategoryId} onChange={e => setNewItemCategoryId(e.target.value)}>
                  {categories.map(c => <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.name}</option>)}
                </select>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.9rem' }}>Add Item</button>
              </form>
            </div>

            {/* Card 2: Add Ingredients / Options — full-size inputs, no fontSize overrides */}
            <div className="glass glass-card">
              <h3 style={{ marginBottom: '1rem' }}>Add Ingredients / Options</h3>
              <form onSubmit={handleAddOption} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <select className="input" value={selectedMenuItemId} onChange={e => setSelectedMenuItemId(e.target.value)}>
                  {allMenuItems.map(item => (
                    <option key={item.id} value={item.id} style={{ color: '#000' }}>{item.name}</option>
                  ))}
                </select>
                <input className="input" placeholder="Group Name (e.g. Ingredients)" value={optionName} onChange={e => setOptionName(e.target.value)} required />
                <input className="input" placeholder="Choices (comma-separated: Lettuce, Tomato, Mayo, Pickles)" value={optionChoices} onChange={e => setOptionChoices(e.target.value)} required />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                  <input type="checkbox" checked={optionDefaultOn} onChange={e => setOptionDefaultOn(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  Default ON (pre-selected when ordering)
                </label>
                <button type="submit" className="btn btn-success" style={{ padding: '0.9rem' }}>Add Option Group</button>
              </form>
            </div>

          </div>

          {/* Right: Menu Overview */}
          <div style={{ flex: 1, maxHeight: 'calc(100vh - 130px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {categories.map(cat => (
              <div key={cat.id} className="glass glass-card">
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{cat.name}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                  {(cat.menuItems || []).map(item => (
                    <MenuItemCard
                      key={item.id}
                      item={{ ...item, categoryId: cat.id }}
                      categories={categories}
                      token={token}
                      onSaved={fetchMenu}
                      onDeleted={fetchMenu}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {activeTab === 'users' && (
        <div className="main-content" style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass glass-card" style={{ width: '100%', maxWidth: '500px' }}>
            <h3>Manage Account PINs</h3>
            {pinMessage && <div style={{ color: 'var(--success)', margin: '1rem 0' }}>{pinMessage}</div>}
            <form onSubmit={handleChangePin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Select Account</label>
                <select className="input" value={pinUserId} onChange={e => setPinUserId(e.target.value)}>
                  {users.map(u => <option key={u.id} value={u.id} style={{ color: '#000' }}>{u.username} ({u.role})</option>)}
                </select>
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
    </>
  );
}
