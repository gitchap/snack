import React, { useState, useEffect, useContext } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';
import ItemCustomizerModal from '../components/ItemCustomizerModal';

export default function OrderScreen() {
  const socket = useContext(SocketContext);
  const { logout, role } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [menu, setMenu] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [customizingItem, setCustomizingItem] = useState(null);
  const [cashTendered, setCashTendered] = useState('');
  
  useEffect(() => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => {
        setMenu(data);
        if (data.length > 0) setActiveCategory(data[0].id);
      });
  }, []);

  const handleItemClick = (item) => {
    if (item.options && item.options.length > 0) {
      setCustomizingItem(item);
    } else {
      addToCart(item, {});
    }
  };

  const addToCart = (item, optionsSnapshot) => {
    setCart([...cart, { ...item, cartId: Date.now(), quantity: 1, optionsSnapshot }]);
  };

  const confirmCustomization = (selections) => {
    if (customizingItem) {
      addToCart(customizingItem, selections);
      setCustomizingItem(null);
    }
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

  const formatSnapshot = (snapshot) => {
    if (!snapshot || Object.keys(snapshot).length === 0) return null;
    const parts = [];
    Object.entries(snapshot).forEach(([key, val]) => {
      if (Array.isArray(val) && val.length > 0) {
        parts.push(val.join(', '));
      }
    });
    return parts.join(' | ');
  };

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
              <div key={item.id} className="glass glass-card menu-item" onClick={() => handleItemClick(item)}>
                <h3>{item.name}</h3>
                <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>${item.price.toFixed(2)}</span>
                {item.options && item.options.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customizable</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="glass glass-card cart-sidebar">
          <h2>Current Order</h2>
          <div className="cart-items">
            {cart.map(item => {
              const formattedOpts = formatSnapshot(item.optionsSnapshot);
              return (
                <div key={item.cartId} className="cart-item glass" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{item.name}</strong>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>${item.price.toFixed(2)}</div>
                    </div>
                    <button className="btn btn-icon btn-danger" onClick={() => removeFromCart(item.cartId)}>×</button>
                  </div>
                  {formattedOpts && (
                    <span className="options-tag">{formattedOpts}</span>
                  )}
                </div>
              );
            })}
            {cart.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>Cart is empty</p>}
          </div>
          
          <div className="cart-footer">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
              <span>Total:</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>

            <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Cash Tendered</label>
              <input
                type="number"
                className="input"
                placeholder="$0.00"
                min="0"
                step="0.01"
                value={cashTendered}
                onChange={e => setCashTendered(e.target.value)}
                style={{ fontSize: '1.2rem', fontWeight: 'bold' }}
              />
              {cashTendered !== '' && parseFloat(cashTendered) >= cartTotal && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                  borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem',
                  fontSize: '1.1rem', fontWeight: 'bold', color: '#6ee7b7'
                }}>
                  <span>Change Due</span>
                  <span>${(parseFloat(cashTendered) - cartTotal).toFixed(2)}</span>
                </div>
              )}
              {cashTendered !== '' && parseFloat(cashTendered) < cartTotal && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                  borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem',
                  fontSize: '1.1rem', fontWeight: 'bold', color: '#fca5a5'
                }}>
                  <span>Still Owed</span>
                  <span>${(cartTotal - parseFloat(cashTendered)).toFixed(2)}</span>
                </div>
              )}
            </div>

            <button
              className="btn btn-success"
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
              onClick={() => { submitOrder(); setCashTendered(''); }}
              disabled={cart.length === 0}
            >
              Submit Order
            </button>
          </div>
        </div>
      </div>

      {customizingItem && (
        <ItemCustomizerModal 
          item={customizingItem}
          onClose={() => setCustomizingItem(null)}
          onConfirm={confirmCustomization}
        />
      )}
    </>
  );
}
