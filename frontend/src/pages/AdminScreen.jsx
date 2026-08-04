import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';

export default function AdminScreen() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('menu');
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  // Form 1: Add New Menu Item
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategoryId, setNewItemCategoryId] = useState('');

  // Form 2: Add Option Group
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [optionName, setOptionName] = useState('Ingredients');
  const [optionChoices, setOptionChoices] = useState('');
  const [optionDefaultOn, setOptionDefaultOn] = useState(true);

  // Edit Mode state for Item Card
  const [editingItemId, setEditingItemId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');

  // Edit Option state
  const [editingOptionId, setEditingOptionId] = useState(null);
  const [editOptName, setEditOptName] = useState('');
  const [editOptChoices, setEditOptChoices] = useState('');
  const [editOptDefaultOn, setEditOptDefaultOn] = useState(true);

  // User PINs state
  const [pinUserId, setPinUserId] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  useEffect(() => {
    fetchMenu();
    fetchUsers();
  }, []);

  const fetchMenu = () => {
    fetch('/api/menu').then(r => r.json()).then(data => {
      setCategories(data);
      if (data.length > 0) {
        if (!newItemCategoryId) setNewItemCategoryId(data[0].id);
        const allItems = data.flatMap(c => c.menuItems || []);
        if (allItems.length > 0 && !selectedMenuItemId) {
          setSelectedMenuItemId(allItems[0].id);
        }
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

  // Add Item
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice || !newItemCategoryId) return;

    await fetch('/api/admin/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: newItemName, price: parseFloat(newItemPrice), categoryId: parseInt(newItemCategoryId) })
    });

    setNewItemName('');
    setNewItemPrice('');
    fetchMenu();
  };

  // Add Option Group
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

  // Delete Item
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this menu item and all its options?')) return;
    await fetch(`/api/admin/menu/${itemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchMenu();
  };

  // Delete Option
  const handleDeleteOption = async (optionId) => {
    await fetch(`/api/admin/options/${optionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchMenu();
  };

  // Start Editing Item
  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditPrice(item.price);
    setEditCategoryId(item.categoryId);
  };

  // Save Item Edit
  const saveEditItem = async (itemId) => {
    await fetch(`/api/admin/menu/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: editName, price: parseFloat(editPrice), categoryId: parseInt(editCategoryId) })
    });
    setEditingItemId(null);
    fetchMenu();
  };

  // Start Editing Option
  const startEditOption = (opt) => {
    setEditingOptionId(opt.id);
    setEditOptName(opt.name);
    setEditOptChoices(opt.choices);
    setEditOptDefaultOn(opt.defaultOn !== false);
  };

  // Save Option Edit
  const saveEditOption = async (optId) => {
    await fetch(`/api/admin/options/${optId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ name: editOptName, choices: editOptChoices.trim(), defaultOn: editOptDefaultOn })
    });
    setEditingOptionId(null);
    fetchMenu();
  };

  // Change PIN
  const handleChangePin = async (e) => {
    e.preventDefault();
    if (!pinUserId || !newPin) return;
    const res = await fetch(`/api/admin/users/${pinUserId}/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ pin: newPin })
    });
    if (res.ok) {
      setPinMessage('PIN updated successfully!');
      setNewPin('');
      setTimeout(() => setPinMessage(''), 3000);
    }
  };

  const allMenuItems = categories.flatMap(c => (c.menuItems || []).map(i => ({ ...i, categoryName: c.name })));

  return (
    <>
      <div className="topbar glass">
        <h2>Admin Panel</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('menu')}>
            Menu & Ingredients
          </button>
          <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('users')}>
            User PINs
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/order')}>Kiosk</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>

      {activeTab === 'menu' && (
        <div className="main-content" style={{ display: 'flex', gap: '1.5rem', padding: '0.5rem', alignItems: 'flex-start', overflowY: 'auto' }}>
          
          {/* LEFT SIDE: Two distinct cards for Add Item and Add Options (matching Picture 1) */}
          <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Card 1: Add Menu Item */}
            <div className="glass glass-card">
              <h3 style={{ marginBottom: '1rem' }}>Add Menu Item</h3>
              <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input 
                  className="input" 
                  placeholder="Item Name (e.g. Cheeseburger)" 
                  value={newItemName} 
                  onChange={e => setNewItemName(e.target.value)} 
                  required 
                />
                <input 
                  type="number" 
                  step="0.01" 
                  className="input" 
                  placeholder="Price (e.g. 5.50)" 
                  value={newItemPrice} 
                  onChange={e => setNewItemPrice(e.target.value)} 
                  required 
                />
                <select 
                  className="input" 
                  value={newItemCategoryId} 
                  onChange={e => setNewItemCategoryId(e.target.value)}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.name}</option>
                  ))}
                </select>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.9rem', fontSize: '1.05rem' }}>
                  Add Item
                </button>
              </form>
            </div>

            {/* Card 2: Add Ingredients / Options */}
            <div className="glass glass-card">
              <h3 style={{ marginBottom: '1rem' }}>Add Ingredients / Options</h3>
              <form onSubmit={handleAddOption} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>Select Menu Item</label>
                  <select 
                    className="input" 
                    value={selectedMenuItemId} 
                    onChange={e => setSelectedMenuItemId(e.target.value)}
                  >
                    {allMenuItems.map(item => (
                      <option key={item.id} value={item.id} style={{ color: '#000' }}>
                        {item.name} ({item.categoryName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>Group Name</label>
                  <input 
                    className="input" 
                    placeholder="e.g. Ingredients, Toppings, Condiments" 
                    value={optionName} 
                    onChange={e => setOptionName(e.target.value)} 
                    required 
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>Choices (comma-separated)</label>
                  <input 
                    className="input" 
                    placeholder="e.g. Lettuce, Tomato, Mayo, Pickles" 
                    value={optionChoices} 
                    onChange={e => setOptionChoices(e.target.value)} 
                    required 
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                  <input 
                    type="checkbox" 
                    checked={optionDefaultOn} 
                    onChange={e => setOptionDefaultOn(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span>Default ON (pre-selected when ordering)</span>
                </label>

                <button type="submit" className="btn btn-success" style={{ padding: '0.9rem', fontSize: '1.05rem' }}>
                  Add Option Group
                </button>
              </form>
            </div>

          </div>

          {/* RIGHT SIDE: Menu Overview with clear, large text matching Picture 1 */}
          <div style={{ flex: 1, maxHeight: 'calc(100vh - 130px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Menu Overview</h3>

            {categories.map(cat => (
              <div key={cat.id} className="glass glass-card">
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', color: 'var(--text-main)' }}>
                  {cat.name}
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                  {(cat.menuItems || []).map(item => {
                    const isEditingThisItem = editingItemId === item.id;

                    if (isEditingThisItem) {
                      return (
                        <div key={item.id} className="glass" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--primary)' }}>
                          <h4 style={{ margin: 0, color: 'var(--primary)' }}>Edit {item.name}</h4>
                          <input 
                            className="input" 
                            value={editName} 
                            onChange={e => setEditName(e.target.value)} 
                            placeholder="Item name" 
                          />
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input 
                              type="number" 
                              step="0.01" 
                              className="input" 
                              value={editPrice} 
                              onChange={e => setEditPrice(e.target.value)} 
                              placeholder="Price" 
                              style={{ flex: 1 }} 
                            />
                            <select 
                              className="input" 
                              value={editCategoryId} 
                              onChange={e => setEditCategoryId(e.target.value)} 
                              style={{ flex: 1 }}
                            >
                              {categories.map(c => (
                                <option key={c.id} value={c.id} style={{ color: '#000' }}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-success" style={{ flex: 1 }} onClick={() => saveEditItem(item.id)}>Save Item</button>
                            <button className="btn btn-outline" onClick={() => setEditingItemId(null)}>Cancel</button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={item.id} className="glass" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
                        {/* Header: Item Name, Price, Delete Badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '1.25rem', color: '#fff' }}>{item.name}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1.2rem' }}>${item.price.toFixed(2)}</span>
                            <button 
                              className="btn btn-icon btn-danger" 
                              style={{ width: '28px', height: '28px', fontSize: '1.1rem', padding: 0 }}
                              onClick={() => handleDeleteItem(item.id)}
                              title="Delete Item"
                            >
                              ×
                            </button>
                          </div>
                        </div>

                        {/* Options list in clear, large text matching Picture 1 */}
                        {item.options && item.options.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                            {item.options.map(opt => {
                              const isEditingOpt = editingOptionId === opt.id;

                              if (isEditingOpt) {
                                return (
                                  <div key={opt.id} style={{ background: 'rgba(0,0,0,0.25)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <input className="input" value={editOptName} onChange={e => setEditOptName(e.target.value)} placeholder="Option Name" />
                                    <input className="input" value={editOptChoices} onChange={e => setEditOptChoices(e.target.value)} placeholder="Choices" />
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                      <input type="checkbox" checked={editOptDefaultOn} onChange={e => setEditOptDefaultOn(e.target.checked)} />
                                      Default ON (pre-selected)
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button className="btn btn-success" style={{ flex: 1, padding: '0.4rem' }} onClick={() => saveEditOption(opt.id)}>Save</button>
                                      <button className="btn btn-outline" style={{ padding: '0.4rem' }} onClick={() => setEditingOptionId(null)}>Cancel</button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div 
                                  key={opt.id} 
                                  style={{ 
                                    fontSize: '1.05rem', 
                                    color: '#cbd5e1', 
                                    display: 'flex', 
                                    justify: 'space-between', 
                                    alignItems: 'baseline',
                                    lineHeight: '1.5' 
                                  }}
                                >
                                  <span>
                                    <strong style={{ color: '#fff' }}>{opt.name}:</strong> {opt.choices}
                                    <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem', color: opt.defaultOn !== false ? 'var(--success)' : 'var(--warning)' }}>
                                      ({opt.defaultOn !== false ? 'Default ON' : 'Default OFF'})
                                    </span>
                                  </span>

                                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                                    <button 
                                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
                                      onClick={() => startEditOption(opt)}
                                    >
                                      edit
                                    </button>
                                    <button 
                                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
                                      onClick={() => handleDeleteOption(opt.id)}
                                    >
                                      delete
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Edit Item button */}
                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'right' }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.9rem' }}
                            onClick={() => startEditItem(item)}
                          >
                            Edit Item Details
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <div className="main-content" style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass glass-card" style={{ width: '100%', maxWidth: '500px' }}>
            <h3>Manage Account PINs</h3>
            {pinMessage && <div style={{ color: 'var(--success)', margin: '1rem 0' }}>{pinMessage}</div>}
            <form onSubmit={handleChangePin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '1rem' }}>Select Account</label>
                <select className="input" value={pinUserId} onChange={e => setPinUserId(e.target.value)}>
                  {users.map(u => <option key={u.id} value={u.id} style={{ color: '#000' }}>{u.username} ({u.role})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '1rem' }}>New PIN</label>
                <input type="password" className="input" placeholder="Enter new PIN" value={newPin} onChange={e => setNewPin(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.9rem', fontSize: '1.05rem' }}>Update PIN</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
