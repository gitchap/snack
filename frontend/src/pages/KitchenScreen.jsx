import React, { useState, useEffect, useContext } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';

export default function KitchenScreen() {
  const socket = useContext(SocketContext);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetch('/api/orders/active')
      .then(res => res.json())
      .then(data => setOrders(data));

    socket.on('new_order', (order) => {
      setOrders(prev => {
        const newOrders = [...prev, order];
        return newOrders.sort((a, b) => {
          if (a.priority === b.priority) return new Date(a.createdAt) - new Date(b.createdAt);
          return a.priority ? -1 : 1;
        });
      });
    });

    socket.on('order_updated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });
    
    socket.on('order_completed', (completedOrder) => {
      setOrders(prev => prev.filter(o => o.id !== completedOrder.id));
    });

    return () => {
      socket.off('new_order');
      socket.off('order_updated');
      socket.off('order_completed');
    };
  }, [socket]);

  const markReady = (orderId) => {
    socket.emit('update_kitchen_status', { orderId, status: 'ready' });
  };

  const markPending = (orderId) => {
    socket.emit('update_kitchen_status', { orderId, status: 'pending' });
  };

  const toggleKitchenItem = (itemId) => {
    socket.emit('toggle_kitchen_item', { itemId });
  };

  const renderOptions = (optionsSnapshot) => {
    if (!optionsSnapshot) return null;
    try {
      const parsed = typeof optionsSnapshot === 'string' ? JSON.parse(optionsSnapshot) : optionsSnapshot;
      const entries = Object.entries(parsed).filter(([_, val]) => Array.isArray(val) && val.length > 0);
      if (entries.length === 0) return null;
      return (
        <div className="options-list" style={{ marginTop: '0.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {entries.map(([groupName, choices]) => (
            <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {groupName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {choices.map((c, idx) => (
                  <div key={idx} className="option-chip" style={{ padding: '0.35rem 0.65rem', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', fontSize: '1rem', color: '#a7f3d0', borderLeft: '3px solid var(--primary)', fontWeight: '600' }}>
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
        <h2>Kitchen Display</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => navigate('/order')}>Back to Order</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>
      
      <div className="main-content kitchen-grid">
        {orders.map(order => (
          <div key={order.id} className={`glass glass-card ticket ${order.kitchenStatus === 'ready' ? 'ticket-ready' : 'ticket-pending'}`}>
            <div className="ticket-header">
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.35rem' }}>
                  {order.customerName || `Order #${order.orderNumber}`}
                  {order.priority && <span className="badge" style={{ background: 'var(--warning)', color: '#000', fontSize: '0.85rem', padding: '0.15rem 0.5rem' }}>🔥 Priority</span>}
                </h3>
                {order.customerName && <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>Order #{order.orderNumber}</div>}
              </div>
              {order.kitchenStatus === 'pending' ? (
                <span className="badge badge-pending">Cooking</span>
              ) : (
                <span className="badge badge-ready">Food Ready</span>
              )}
            </div>
            
            <div className="ticket-items">
              {order.orderItems.map(item => {
                const isReady = item.kitchenItemStatus === 'ready';
                return (
                  <div 
                    key={item.id} 
                    className="ticket-item" 
                    style={{ 
                      flexDirection: 'column', 
                      alignItems: 'flex-start',
                      background: isReady ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                      border: isReady ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontWeight: 'bold', fontSize: '1.1rem', alignItems: 'center' }}>
                      <span style={{ textDecoration: isReady ? 'line-through' : 'none', opacity: isReady ? 0.75 : 1 }}>
                        {item.quantity}x {item.menuItem?.name || 'Unknown Item'}
                      </span>
                      <button 
                        className={`btn ${isReady ? 'btn-success' : 'btn-outline'}`} 
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.85rem', cursor: 'pointer' }}
                        onClick={() => toggleKitchenItem(item.id)}
                      >
                        {isReady ? '✓ Ready' : 'Prep'}
                      </button>
                    </div>
                    {renderOptions(item.optionsSnapshot)}
                  </div>
                );
              })}
            </div>
            
            {order.kitchenStatus === 'pending' ? (
              <button 
                className="btn btn-success" 
                style={{ marginTop: '1rem', width: '100%' }}
                onClick={() => markReady(order.id)}
              >
                Food Ready
              </button>
            ) : (
              <button 
                className="btn btn-outline" 
                style={{ marginTop: '1rem', width: '100%', borderColor: 'var(--warning)', color: 'var(--warning)' }}
                onClick={() => markPending(order.id)}
              >
                ↩ Undo "Food Ready"
              </button>
            )}
          </div>
        ))}
        {orders.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', marginTop: '2rem' }}>No active orders</p>}
      </div>
    </>
  );
}
