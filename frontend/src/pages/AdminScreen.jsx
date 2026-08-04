import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';

// ─── Small helper ────────────────────────────────────────────────────────────
function OptionGroupRow({ opt, token, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(opt.name);
  const [choices, setChoices] = useState(opt.choices);
  const [defaultOn, setDefaultOn] = useState(opt.defaultOn !== false);

  const save = async () => {
    await fetch(`/api/admin/options/${opt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, choices, defaultOn })
    });
    setEditing(false);
    onSaved();
  };

  const del = async () => {
    await fetch(`/api/admin/options/${opt.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    onDeleted();
  };

  if (editing) {
    return (
      <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <input className="input" style={{ fontSize: '0.875rem', padding: '0.4rem 0.75rem' }} value={name} onChange={e => setName(e.target.value)} placeholder="Group name" />
        <input className="input" style={{ fontSize: '0.875rem', padding: '0.4rem 0.75rem' }} value={choices} onChange={e => setChoices(e.target.value)} placeholder="Comma-separated choices" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={defaultOn} onChange={e => setDefaultOn(e.target.checked)} />
            Default ON (pre-selected)
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-success" style={{ flex: 1, padding: '0.4rem' }} onClick={save}>Save</button>
          <button className="btn btn-outline" style={{ padding: '0.4rem 0.75rem' }} onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-danger" style={{ padding: '0.4rem 0.75rem' }} onClick={del}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      onClick={() => setEditing(true)}
    >
      <span>
        <strong style={{ color: 'var(--text-main)' }}>{opt.name}:</strong> {opt.choices}
      </span>
      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: opt.defaultOn !== false ? 'var(--success)' : 'var(--warning)' }}>
        {opt.defaultOn !== false ? 'Default ON' : 'Default OFF'}
      </span>
    </div>
  );
}

// ─── New Option Group Form ───────────────────────────────────────────────────
function NewOptionForm({ itemId, token, onAdded }) {
  const [name, setName] = useState('Ingredients');
  const [choices, setChoices] = useState('');
  const [defaultOn, setDefaultOn] = useState(true);

  const add = async (e) => {
    e.preventDefault();
    if (!choices.trim()) return;
    await fetch(`/api/admin/menu/${itemId}/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, choices: choices.trim(), defaultOn })
    });
    setChoices('');
    onAdded();
  };

  return (
    <form onSubmit={add} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(139,92,246,0.08)', border: '1px dashed rgba(139,92,246,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.75rem' }}>
      <p style={{ fontSize: '0.8rem', color: 'var(--primary)', margin: 0 }}>+ Add Option Group</p>
      <input className="input" style={{ fontSize: '0.875rem', padding: '0.4rem 0.75rem' }} placeholder="Group name (e.g. Ingredients)" value={name} onChange={e => setName(e.target.value)} />
      <input className="input" style={{ fontSize: '0.875rem', padding: '0.4rem 0.75rem' }} placeholder="Choices: Lettuce, Tomato, Mayo, Pickles" value={choices} onChange={e => setChoices(e.target.value)} />
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <input type="checkbox" checked={defaultOn} onChange={e => setDefaultOn(e.target.checked)} />
        Default ON — all choices pre-selected (use for standard toppings; uncheck for add-ons)
      </label>
      <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem' }}>Add Group</button>
    </form>
  );
}

// ─── Inline Item Editor Card ─────────────────────────────────────────────────
function MenuItemCard({ item, categories, token, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price);
  const [categoryId, setCategoryId] = useState(item.categoryId);

  const save = async () => {
    await fetch(`/api/admin/menu/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name, price: parseFloat(price), categoryId })
    });
    setEditing(false);
    onSaved();
  };

  const del = async () => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    await fetch(`/api/admin/menu/${item.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    onDeleted();
  };

  return (
    <div className="glass" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', cursor: editing ? 'default' : 'pointer' }} onClick={() => !editing && setEditing(true)}>
      {!editing ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '1.05rem' }}>{item.name}</strong>
            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>${item.price.toFixed(2)}</span>
          </div>
          {item.options?.length > 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {item.options.map(o => (
                <div key={o.id}>
                  <span style={{ color: opt_color(o.defaultOn) }}>● </span>
                  <strong>{o.name}:</strong> {o.choices}
                </div>
              ))}
            </div>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', opacity: 0.8 }}>Click to edit</span>
        </>
      ) : (
        <>
          <input className="input" style={{ fontSize: '0.95rem' }} value={name} onChange={e => setName(e.target.value)} placeholder="Item name" />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="number" step="0.01" className="input" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" style={{ flex: 1 }} />
            <select className="input" value={categoryId} onChange={e => setCategoryId(parseInt(e.target.value))} style={{ flex: 1 }}>
              {categories.map(c => <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.name}</option>)}
            </select>
          </div>

          {/* Existing option groups */}
          {item.options?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Option Groups (click to edit):</p>
              {item.options.map(opt => (
                <OptionGroupRow key={opt.id} opt={opt} token={token} onSaved={onSaved} onDeleted={onSaved} />
              ))}
            </div>
          )}

          {/* Add new option group */}
          <NewOptionForm itemId={item.id} token={token} onAdded={onSaved} />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-success" style={{ flex: 2 }} onClick={save}>Save Changes</button>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={del}>Delete</button>
          </div>
        </>
      )}
    </div>
  );
}

function opt_color(defaultOn) {
  return defaultOn !== false ? '#6ee7b7' : '#fbbf24';
}

// ─── Main Admin Screen ───────────────────────────────────────────────────────
export default function AdminScreen() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('menu');
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  // New Item form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategoryId, setNewItemCategoryId] = useState('');
  const [pendingOptions, setPendingOptions] = useState([]); // [{name, choices, defaultOn}]
  const [newOptName, setNewOptName] = useState('Ingredients');
  const [newOptChoices, setNewOptChoices] = useState('');
  const [newOptDefaultOn, setNewOptDefaultOn] = useState(true);
  const [createdItemId, setCreatedItemId] = useState(null);

  // Change PIN
  const [pinUserId, setPinUserId] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  useEffect(() => { fetchMenu(); fetchUsers(); }, []);

  const fetchMenu = () => {
    fetch('/api/menu').then(r => r.json()).then(data => {
      setCategories(data);
      if (data.length > 0 && !newItemCategoryId) setNewItemCategoryId(data[0].id);
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

  const addPendingOption = (e) => {
    e.preventDefault();
    if (!newOptChoices.trim()) return;
    setPendingOptions(prev => [...prev, { name: newOptName, choices: newOptChoices.trim(), defaultOn: newOptDefaultOn }]);
    setNewOptChoices('');
    setNewOptDefaultOn(true);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice || !newItemCategoryId) return;

    // 1) create the item
    const res = await fetch('/api/admin/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: newItemName, price: parseFloat(newItemPrice), categoryId: parseInt(newItemCategoryId) })
    });
    const item = await res.json();

    // 2) create any pending option groups
    for (const opt of pendingOptions) {
      await fetch(`/api/admin/menu/${item.id}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(opt)
      });
    }

    setNewItemName(''); setNewItemPrice(''); setPendingOptions([]);
    setCreatedItemId(item.id);
    fetchMenu();
    setTimeout(() => setCreatedItemId(null), 3000);
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
          <button className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('menu')}>Menu</button>
          <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('users')}>User PINs</button>
          <button className="btn btn-outline" onClick={() => navigate('/order')}>Kiosk</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>

      {/* ── MENU TAB ── */}
      {activeTab === 'menu' && (
        <div className="main-content" style={{ display: 'flex', gap: '1.5rem', padding: '0.5rem', alignItems: 'flex-start', overflowY: 'auto' }}>

          {/* Left: Add new item */}
          <div className="glass glass-card" style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3>Add New Item</h3>
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input className="input" placeholder="Item Name" value={newItemName} onChange={e => setNewItemName(e.target.value)} required />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="number" step="0.01" className="input" placeholder="Price" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} required style={{ flex: 1 }} />
                <select className="input" value={newItemCategoryId} onChange={e => setNewItemCategoryId(e.target.value)} style={{ flex: 1 }}>
                  {categories.map(c => <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.name}</option>)}
                </select>
              </div>

              {/* Pending option groups preview */}
              {pendingOptions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {pendingOptions.map((o, i) => (
                    <div key={i} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0.5rem', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-sm)' }}>
                      <span><strong>{o.name}</strong>: {o.choices}</span>
                      <span style={{ color: o.defaultOn ? 'var(--success)' : 'var(--warning)', fontSize: '0.75rem' }}>{o.defaultOn ? 'ON' : 'OFF'}</span>
                      <button type="button" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => setPendingOptions(prev => prev.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add option group inline */}
              <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px dashed rgba(139,92,246,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--primary)', margin: 0 }}>+ Option Group (optional)</p>
                <input className="input" style={{ fontSize: '0.875rem', padding: '0.4rem 0.75rem' }} placeholder="Group name" value={newOptName} onChange={e => setNewOptName(e.target.value)} />
                <input className="input" style={{ fontSize: '0.875rem', padding: '0.4rem 0.75rem' }} placeholder="Choices: Lettuce, Tomato, Mayo" value={newOptChoices} onChange={e => setNewOptChoices(e.target.value)} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={newOptDefaultOn} onChange={e => setNewOptDefaultOn(e.target.checked)} />
                  Default ON (pre-selected when ordering)
                </label>
                <button type="button" className="btn btn-outline" style={{ padding: '0.4rem' }} onClick={addPendingOption}>Add Group</button>
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '0.85rem' }}>Create Item</button>
              {createdItemId && <p style={{ color: 'var(--success)', textAlign: 'center', margin: 0 }}>✓ Item created!</p>}
            </form>
          </div>

          {/* Right: All existing items grouped by category */}
          <div style={{ flex: 1, maxHeight: 'calc(100vh - 130px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {categories.map(cat => (
              <div key={cat.id} className="glass glass-card">
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>{cat.name}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
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

      {/* ── USERS TAB ── */}
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
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Update PIN</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
