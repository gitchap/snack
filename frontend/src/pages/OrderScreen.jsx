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
  const [customerName, setCustomerName] = useState('');
  const [priority, setPriority] = useState(false);
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
    socket.emit('place_order', { items, customerName, priority });
    setCart([]);
    setCustomerName('');
    setPriority(false);
  };

  const formatSnapshot = (snapshot) => {
    if (!snapshot || Object.keys(snapshot).length === 0) return null;
    try {
      const parsed = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
      const entries = Object.entries(parsed).filter(([_, val]) => Array.isArray(val) && val.length > 0);
      if (entries.length === 0) return null;
      return (
        <div className="options-list" style={{ marginTop: '0.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {entries.map(([groupName, choices]) => (
            <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {groupName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {choices.map((c, idx) => (
                  <div key={idx} className="option-chip" style={{ padding: '0.25rem 0.55rem', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', fontSize: '0.9rem', color: '#a7f3d0', borderLeft: '3px solid var(--primary)', fontWeight: '600' }}>
                    {c}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    } catch (e) {
      return null;
    }
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
                    </div>
                    <button className="btn btn-icon btn-danger" style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => removeFromCart(item.cartId)}>×</button>
                  </div>
                  {formattedOpts}
                </div>
              );
            })}
            {cart.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>Cart is empty</p>}
          </div>
          
          <div className="cart-footer">
            <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Customer Name</label>
              <input
                className="input"
                type="text"
                placeholder="Name (Optional)"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            </div>
            
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="priorityCheck"
                checked={priority}
                onChange={e => setPriority(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="priorityCheck" style={{ fontSize: '1.1rem', cursor: 'pointer', color: priority ? 'var(--warning)' : 'var(--text-main)', fontWeight: priority ? 'bold' : 'normal' }}>
                Priority Order 🔥
              </label>
            </div>

            <button
              className="btn btn-success"
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
              onClick={submitOrder}
              disabled={cart.length === 0}
            >
              Send to Kitchen
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
