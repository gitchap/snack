import React, { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';
import ItemCustomizerModal from '../components/ItemCustomizerModal';
import useFavicon from '../hooks/useFavicon';
import { useActionLock } from '../hooks/useActionLock';

export default function OrderScreen() {
  useFavicon('order.png', 'Order Kiosk - Snack Shack');
  const socket = useContext(SocketContext);
  const { logout, role } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [menu, setMenu] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [customizingItem, setCustomizingItem] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [priority, setPriority] = useState(false);
  const [showCashCalc, setShowCashCalc] = useState(false);
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

  const handleItemClick = (item) => {
    if (item.options && item.options.length > 0) {
      setCustomizingItem(item);
    } else {
      addToCart(item, {});
    }
  };

  const addToCart = (item, optionsSnapshot) => {
    setCart(prev => [...prev, { ...item, cartId: Date.now() + Math.random(), quantity: 1, optionsSnapshot }]);
  };

  const confirmCustomization = (selections) => {
    if (customizingItem) {
      addToCart(customizingItem, selections);
      setCustomizingItem(null);
    }
  };

  const removeFromCart = (cartId) => {
    setCart(prev => prev.filter(c => c.cartId !== cartId));
  };

  const { withLock, isLocked } = useActionLock(1500);

  const cartTotal = cart.reduce((acc, curr) => acc + (parseFloat(curr.price) || 0) * (curr.quantity || 1), 0);

  const handleQuickCash = (amount) => {
    if (amount === 'exact') {
      setCashTendered(cartTotal.toFixed(2));
    } else {
      setCashTendered(parseFloat(amount).toFixed(2));
    }
  };

  const submitOrder = withLock('submitOrder', () => {
    if (cart.length === 0) return;
    const items = cart.map(c => ({
      menuItemId: c.id,
      quantity: c.quantity || 1,
      optionsSnapshot: c.optionsSnapshot
    }));
    socket.emit('place_order', { items, customerName, priority });
    setCart([]);
    setCustomerName('');
    setPriority(false);
    setCashTendered('');
    setShowCashCalc(false);
  });

  const formatSnapshot = (optionsSnapshot) => {
    if (!optionsSnapshot) return null;
    try {
      const parsed = typeof optionsSnapshot === 'string' ? JSON.parse(optionsSnapshot) : optionsSnapshot;
      const entries = Object.entries(parsed).filter(([_, val]) => Array.isArray(val) && val.length > 0);
      if (entries.length === 0) return null;
      return (
        <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {entries.map(([groupName, choices]) => (
            choices.map((c, idx) => (
              <span key={`${groupName}-${idx}`} style={{
                padding: '0.15rem 0.45rem',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                color: 'var(--text-subtle)',
                borderLeft: '2px solid var(--primary)',
                fontWeight: '500'
              }}>
                {c}
              </span>
            ))
          ))}
        </div>
      );
    } catch (e) {
      return null;
    }
  };

  // Filter categories and menu items
  const displayedCategories = activeCategory === 'all' 
    ? menu 
    : menu.filter(c => c.id === activeCategory);

  return (
    <>
      <div className="topbar glass">
        <h2>Order Kiosk</h2>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {role === 'admin' && (
            <button className="btn btn-outline" onClick={() => navigate('/admin')}>Admin Panel</button>
          )}
          <button className="btn btn-outline" onClick={() => navigate('/kitchen')}>Kitchen</button>
          <button className="btn btn-outline" onClick={() => navigate('/service')}>Service</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>
      
      <div className="main-content order-grid">
        {/* Menu Side (72% Width) */}
        <div className="glass glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '1rem' }}>
          {/* Category Navigation Tabs */}
          <div className="tabs">
            <div 
              className={`tab ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All Items
            </div>
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
          
          {/* Menu Items Grid */}
          <div ref={menuContainerRef} style={{ flex: 1, overflowY: 'auto', paddingRight: '0.35rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {displayedCategories.map(cat => (
              <div key={cat.id}>
                {activeCategory === 'all' && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem', 
                    marginBottom: '0.65rem',
                    paddingBottom: '0.35rem',
                    borderBottom: '1px solid var(--glass-border)'
                  }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>
                      {cat.name}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ({cat.menuItems?.length || 0})
                    </span>
                  </div>
                )}

                <div className="menu-grid">
                  {(cat.menuItems || []).map(item => (
                    <div 
                      key={item.id} 
                      className="glass glass-card menu-item" 
                      onClick={() => handleItemClick(item)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: '1.25' }}>
                          {item.name}
                        </div>
                        {item.options && item.options.length > 0 && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Options Available
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ color: 'var(--success)', fontWeight: '800', fontSize: '1.15rem' }}>
                          ${(parseFloat(item.price) || 0).toFixed(2)}
                        </span>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          background: 'var(--primary)', 
                          color: '#fff', 
                          width: '26px', 
                          height: '26px', 
                          borderRadius: '50%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontWeight: 'bold'
                        }}>
                          +
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {displayedCategories.length === 0 && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '3rem' }}>No menu items found</p>
            )}
          </div>
        </div>

        {/* Cart Sidebar (28% Width) */}
        <div className="glass glass-card cart-sidebar" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Current Order</h3>
            {cart.length > 0 && (
              <span style={{ fontSize: '0.8rem', background: 'var(--glass-hover)', padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontWeight: '600' }}>
                {cart.length} item{cart.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Cart Items List */}
          <div className="cart-items" style={{ flex: 1, minHeight: '120px', overflowY: 'auto' }}>
            {cart.map(item => {
              const formattedOpts = formatSnapshot(item.optionsSnapshot);
              const itemSubtotal = (parseFloat(item.price) || 0) * (item.quantity || 1);
              return (
                <div key={item.cartId} className="cart-item glass" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                      <div style={{ fontSize: '0.98rem', fontWeight: '700', lineHeight: '1.2', color: 'var(--text-main)' }}>{item.name}</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: '700', marginTop: '0.15rem' }}>
                        ${itemSubtotal.toFixed(2)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{
                        height: '32px',
                        width: '32px',
                        padding: '0',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '1.15rem',
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                      onClick={() => removeFromCart(item.cartId)}
                      title="Remove item"
                    >×</button>
                  </div>
                  {formattedOpts}
                </div>
              );
            })}
            {cart.length === 0 && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto 0', padding: '2rem 1rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.5 }}>🛒</div>
                <span>Order is empty</span>
              </div>
            )}
          </div>
          
          {/* Cart Footer Controls */}
          <div className="cart-footer" style={{ marginTop: 'auto', paddingTop: '0.75rem' }}>
            {/* Total Display */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', fontSize: '1.25rem', fontWeight: '800' }}>
              <span style={{ color: 'var(--text-main)' }}>Total:</span>
              <span style={{ color: 'var(--success)' }}>${cartTotal.toFixed(2)}</span>
            </div>

            {/* Collapsible Cash Calculator Toggle */}
            <div style={{ marginBottom: '0.65rem' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ 
                  width: '100%', 
                  padding: '0.45rem 0.75rem', 
                  fontSize: '0.85rem', 
                  fontWeight: '600',
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  borderColor: showCashCalc ? 'var(--primary)' : 'var(--glass-border)',
                  color: showCashCalc ? 'var(--primary)' : 'var(--text-muted)',
                  borderRadius: 'var(--radius-sm)'
                }}
                onClick={() => setShowCashCalc(!showCashCalc)}
              >
                <span>💵 Cash / Change Calculator</span>
                <span>{showCashCalc ? '▲' : '▼'}</span>
              </button>

              {showCashCalc && (
                <div style={{ marginTop: '0.5rem', padding: '0.65rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {/* Preset quick buttons */}
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button type="button" className="btn btn-outline" style={{ flex: 1, padding: '0.35rem 0', fontSize: '0.8rem', fontWeight: '700' }} onClick={() => handleQuickCash('exact')} disabled={cartTotal <= 0}>Exact</button>
                    <button type="button" className="btn btn-outline" style={{ flex: 1, padding: '0.35rem 0', fontSize: '0.8rem', fontWeight: '700' }} onClick={() => handleQuickCash('5')}>$5</button>
                    <button type="button" className="btn btn-outline" style={{ flex: 1, padding: '0.35rem 0', fontSize: '0.8rem', fontWeight: '700' }} onClick={() => handleQuickCash('10')}>$10</button>
                    <button type="button" className="btn btn-outline" style={{ flex: 1, padding: '0.35rem 0', fontSize: '0.8rem', fontWeight: '700' }} onClick={() => handleQuickCash('20')}>$20</button>
                  </div>

                  {/* Cash input */}
                  <div className="input" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.65rem', minHeight: '38px' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '1rem' }}>$</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={cashTendered}
                      onChange={e => setCashTendered(e.target.value)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', width: '100%', outline: 'none', fontSize: '1.05rem', fontWeight: 'bold', padding: 0 }}
                    />
                    {cashTendered !== '' && (
                      <button type="button" onClick={() => setCashTendered('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                    )}
                  </div>

                  {/* Change Due box */}
                  {cashTendered !== '' && !isNaN(parseFloat(cashTendered)) && parseFloat(cashTendered) >= cartTotal && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--success-dim)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.65rem', fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--success)' }}>
                      <span>Change Due:</span>
                      <span>${(parseFloat(cashTendered) - cartTotal).toFixed(2)}</span>
                    </div>
                  )}

                  {/* Still Owed box */}
                  {cashTendered !== '' && !isNaN(parseFloat(cashTendered)) && parseFloat(cashTendered) < cartTotal && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--danger-dim)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.65rem', fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--danger)' }}>
                      <span>Still Owed:</span>
                      <span>${(cartTotal - parseFloat(cashTendered)).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Customer Name & Priority Stack */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
              <input
                className="input"
                type="text"
                placeholder="Name (Optional)"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                style={{ flex: 1, minHeight: '38px', padding: '0.45rem 0.75rem', fontSize: '0.92rem' }}
              />
              <button
                type="button"
                className={`btn ${priority ? 'btn-danger' : 'btn-outline'}`}
                style={{ 
                  flexShrink: 0, 
                  height: '38px', 
                  minHeight: '38px', 
                  padding: '0 0.65rem', 
                  fontSize: '0.85rem', 
                  fontWeight: '700',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
                onClick={() => setPriority(!priority)}
                title="Toggle Rush/Priority"
              >
                <span>🔥</span>
                <span>Rush</span>
              </button>
            </div>

            {/* Main Submit Order Button */}
            <button
              className="btn btn-success"
              style={{ width: '100%', padding: '0.85rem', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.02em', borderRadius: 'var(--radius-md)' }}
              onClick={submitOrder}
              disabled={cart.length === 0 || isLocked('submitOrder')}
            >
              {cart.length === 0 ? 'Add Items to Order' : `Send to Kitchen • $${cartTotal.toFixed(2)}`}
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
