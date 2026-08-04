import React, { useState, useEffect, useContext } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';

export default function OrderScreen() {
  const socket = useContext(SocketContext);
  const { logout, role } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [menu, setMenu] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState([]);
  
  useEffect(() => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => {
        setMenu(data);
        if (data.length > 0) setActiveCategory(data[0].id);
      });
  }, []);

  const addToCart = (item) => {
    setCart([...cart, { ...item, cartId: Date.now(), quantity: 1, optionsSnapshot: {} }]);
  };

  const removeFromCart = (cartId) => {
    setCart(cart.filter(c => c.cartId !== cartId));
  };

  const submitOrder = () => {
    if (cart.length === 0) return;
    const items = cart.map(c => ({
      menuItemId: c.id,
      quantity: c.quantity,
      optionsSnapshot: c.optionsSnapshot
    }));
    socket.emit('place_order', { items });
    setCart([]);
  };

  const activeCategoryItems = menu.find(c => c.id === activeCategory)?.menuItems || [];
  const cartTotal = cart.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

  return (
    <>
      <div className="topbar glass">
        <h2>Order Kiosk</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {role === 'admin' && (
            <button className="btn btn-outline" onClick={() => navigate('/admin')}>Admin Panel</button>
          )}
          <button className="btn btn-outline" onClick={() => navigate('/kitchen')}>Kitchen</button>
          <button className="btn btn-outline" onClick={() => navigate('/service')}>Service</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>
      
      <div className="main-content order-grid">
        <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="tabs">
            {menu.map(cat => (
              <div 
                key={cat.id} 
                className={`tab ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.name}
              </div>
            ))}
          </div>
          
          <div className="menu-grid">
            {activeCategoryItems.map(item => (
              <div key={item.id} className="glass glass-card menu-item" onClick={() => addToCart(item)}>
                <h3>{item.name}</h3>
                <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>${item.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass glass-card cart-sidebar">
          <h2>Current Order</h2>
          <div className="cart-items">
            {cart.map(item => (
              <div key={item.cartId} className="cart-item glass">
                <div>
                  <strong>{item.name}</strong>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>${item.price.toFixed(2)}</div>
                </div>
                <button className="btn btn-icon btn-danger" onClick={() => removeFromCart(item.cartId)}>×</button>
              </div>
            ))}
            {cart.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>Cart is empty</p>}
          </div>
          
          <div className="cart-footer">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
              <span>Total:</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            <button className="btn btn-success" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }} onClick={submitOrder} disabled={cart.length === 0}>
              Submit Order
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
