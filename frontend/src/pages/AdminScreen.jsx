import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';

export default function AdminScreen() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' | 'users'
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

  // New Menu Item Form
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // New Option Form
  const [selectedMenuItem, setSelectedMenuItem] = useState('');
  const [optionName, setOptionName] = useState('Ingredients');
  const [optionChoices, setOptionChoices] = useState('');

  // Change PIN Form
  const [pinUserId, setPinUserId] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');

  useEffect(() => {
    fetchMenu();
    fetchUsers();
  }, []);

  const fetchMenu = () => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => {
        setCategories(data);
        if (data.length > 0) {
          setSelectedCategory(data[0].id);
          if (data[0].menuItems?.length > 0) {
            setSelectedMenuItem(data[0].menuItems[0].id);
          }
        }
      });
  };

  const fetchUsers = () => {
    fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
          if (data.length > 0) setPinUserId(data[0].id);
        }
      });
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice || !selectedCategory) return;
    
    await fetch('/api/admin/menu', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        name: newItemName, 
        price: parseFloat(newItemPrice), 
        categoryId: parseInt(selectedCategory) 
      })
    });
    
    setNewItemName('');
    setNewItemPrice('');
    fetchMenu();
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this menu item?')) return;
    await fetch(`/api/admin/menu/${itemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchMenu();
  };

  const handleAddOption = async (e) => {
    e.preventDefault();
    if (!selectedMenuItem || !optionName || !optionChoices) return;

    await fetch(`/api/admin/menu/${selectedMenuItem}/options`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: optionName,
        choices: optionChoices
      })
    });

    setOptionChoices('');
    fetchMenu();
  };

  const handleDeleteOption = async (optionId) => {
    await fetch(`/api/admin/options/${optionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchMenu();
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    if (!pinUserId || !newPin) return;

    const res = await fetch(`/api/admin/users/${pinUserId}/pin`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ pin: newPin })
    });

    if (res.ok) {
      setPinMessage('PIN updated successfully!');
      setNewPin('');
      setTimeout(() => setPinMessage(''), 3000);
    }
  };

  const allMenuItems = categories.flatMap(c => c.menuItems || []);

  return (
    <>
      <div className="topbar glass">
        <h2>Admin Panel</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className={`btn ${activeTab === 'menu' ? 'btn-primary' : 'btn-outline'}`} 
            onClick={() => setActiveTab('menu')}
          >
            Menu & Ingredients
          </button>
          <button 
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`} 
            onClick={() => setActiveTab('users')}
          >
            User PINs
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/order')}>Kiosk</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>
      
      {activeTab === 'menu' && (
        <div className="main-content" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', padding: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            {/* Add Menu Item */}
            <div className="glass glass-card">
              <h3>Add Menu Item</h3>
              <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Item Name (e.g. Cheeseburger)" 
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
                <input 
                  type="number" 
                  step="0.01"
                  className="input" 
                  placeholder="Price (e.g. 5.50)" 
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                />
                <select 
                  className="input" 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id} style={{ color: '#000' }}>{cat.name}</option>
                  ))}
                </select>
                <button type="submit" className="btn btn-primary">Add Item</button>
              </form>
            </div>

            {/* Add Ingredient / Option Group */}
            <div className="glass glass-card">
              <h3>Add Ingredients / Options</h3>
              <form onSubmit={handleAddOption} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                <select 
                  className="input" 
                  value={selectedMenuItem} 
                  onChange={(e) => setSelectedMenuItem(e.target.value)}
                >
                  {allMenuItems.map(item => (
                    <option key={item.id} value={item.id} style={{ color: '#000' }}>{item.name}</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Option Group (e.g. Ingredients, Toppings)" 
                  value={optionName}
                  onChange={(e) => setOptionName(e.target.value)}
                />
                <input 
                  type="text" 
                  className="input" 
                  placeholder="Choices (comma-separated: Lettuce, Tomato, Mayo, Pickles)" 
                  value={optionChoices}
                  onChange={(e) => setOptionChoices(e.target.value)}
                />
                <button type="submit" className="btn btn-success">Add Option Group</button>
              </form>
            </div>
          </div>
          
          {/* Current Menu List */}
          <div className="glass glass-card" style={{ flex: 2, maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
            <h3>Menu Overview</h3>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {categories.map(cat => (
                <div key={cat.id}>
                  <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                    {cat.name}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {cat.menuItems?.map(item => (
                      <div key={item.id} className="glass" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '1.1rem' }}>{item.name}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>${item.price.toFixed(2)}</span>
                            <button className="btn btn-icon btn-danger" style={{ padding: '0.2rem 0.5rem' }} onClick={() => handleDeleteItem(item.id)}>×</button>
                          </div>
                        </div>

                        {/* Render item options */}
                        {item.options && item.options.length > 0 && (
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                            {item.options.map(opt => (
                              <div key={opt.id} style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span><strong>{opt.name}:</strong> {opt.choices}</span>
                                <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', marginLeft: '0.5rem' }} onClick={() => handleDeleteOption(opt.id)}>delete</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="main-content" style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass glass-card" style={{ width: '100%', maxWidth: '500px' }}>
            <h3>Manage Account PINs</h3>
            
            {pinMessage && <div style={{ color: 'var(--success)', marginBottom: '1rem', marginTop: '0.5rem' }}>{pinMessage}</div>}

            <form onSubmit={handleChangePin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Select User Account</label>
                <select 
                  className="input" 
                  value={pinUserId} 
                  onChange={(e) => setPinUserId(e.target.value)}
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id} style={{ color: '#000' }}>
                      {u.username} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>New PIN</label>
                <input 
                  type="password" 
                  className="input" 
                  placeholder="Enter new PIN" 
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Update PIN
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
