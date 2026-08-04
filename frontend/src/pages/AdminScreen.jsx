import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';

export default function AdminScreen() {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = () => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => {
        setCategories(data);
        if (data.length > 0) setSelectedCategory(data[0].id);
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

  return (
    <>
      <div className="topbar glass">
        <h2>Admin Panel</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => navigate('/order')}>Back to Kiosk</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>
      
      <div className="main-content" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', padding: '0.5rem' }}>
        <div className="glass glass-card" style={{ flex: 1 }}>
          <h3>Add Menu Item</h3>
          <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <input 
              type="text" 
              className="input" 
              placeholder="Item Name" 
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
            <input 
              type="number" 
              step="0.01"
              className="input" 
              placeholder="Price (e.g. 5.99)" 
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
        
        <div className="glass glass-card" style={{ flex: 2, maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
          <h3>Current Menu</h3>
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {categories.map(cat => (
              <div key={cat.id}>
                <h4 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                  {cat.name}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                  {cat.menuItems.map(item => (
                    <div key={item.id} className="glass" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{item.name}</span>
                      <span style={{ color: 'var(--success)' }}>${item.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
