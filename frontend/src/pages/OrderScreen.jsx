import React, { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';
import ItemCustomizerModal from '../components/ItemCustomizerModal';

export default function OrderScreen() {
  const socket = useContext(SocketContext);
  const { logout, role } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [menu, setMenu] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [customizingItem, setCustomizingItem] = useState(null);
  const [cashTendered, setCashTendered] = useState('');
  const menuContainerRef = useRef(null);
  
  const fetchMenu = () => {
    fetch('/api/menu')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setMenu(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchMenu();
    if (socket) {
      socket.on('menu_updated', fetchMenu);
      return () => socket.off('menu_updated', fetchMenu);
    }
  }, [socket]);

  const scrollToCategory = (catId) => {
    setActiveCategory(catId);
    if (!menuContainerRef.current) return;
    if (catId === 'all') {
      menuContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(`category-sec-${catId}`);
      if (el) {
        const containerTop = menuContainerRef.current.getBoundingClientRect().top;
        const elementTop = el.getBoundingClientRect().top;
        const targetScrollTop = elementTop - containerTop + menuContainerRef.current.scrollTop;
        menuContainerRef.current.scrollTo({ top: targetScrollTop - 12, behavior: 'smooth' });
      }
    }
  };

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
        <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Category Navigation Tabs */}
          <div className="tabs" style={{ marginBottom: '1rem', flexShrink: 0 }}>
            <div 
              className={`tab ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => scrollToCategory('all')}
            >
              All Items
            </div>
            {menu.map(cat => (
              <div 
                key={cat.id} 
                className={`tab ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => scrollToCategory(cat.id)}
              >
                {cat.name}
              </div>
            ))}
          </div>
          
          {/* Single continuous scrollable menu list */}
          <div ref={menuContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {menu.map(cat => (
              <div key={cat.id} id={`category-sec-${cat.id}`}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', color: 'var(--text-main)', fontSize: '1.4rem' }}>
                  {cat.name}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
                  {(cat.menuItems || []).map(item => (
                    <div key={item.id} className="glass glass-card menu-item" onClick={() => handleItemClick(item)}>
                      <h3 style={{ fontSize: '1.2rem' }}>{item.name}</h3>
                      <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1.15rem' }}>${item.price.toFixed(2)}</span>
                      {item.options && item.options.length > 0 && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Customizable</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Sidebar */}
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
              <div className="input" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0 0.85rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '1.2rem' }}>$</span>
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={cashTendered}
                  onChange={e => setCashTendered(e.target.value)}
                  onBlur={() => {
                    const num = parseFloat(cashTendered);
                    if (!isNaN(num)) setCashTendered(num.toFixed(2));
                  }}
                  style={{ background: 'transparent', border: 'none', color: 'white', width: '100%', outline: 'none', fontSize: '1.2rem', fontWeight: 'bold', padding: '0.75rem 0' }}
                />
              </div>
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
