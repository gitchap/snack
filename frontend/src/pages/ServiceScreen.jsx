import React, { useState, useEffect, useContext } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';
import useFavicon from '../hooks/useFavicon';

export default function ServiceScreen() {
  useFavicon('service.png', 'Service Display - Snack Shack');
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

    socket.on('item_fulfilled', (updatedItem) => {
      setOrders(prev => prev.map(o => {
        if (o.id === updatedItem.orderId) {
          const updatedOrderItems = o.orderItems.map(i => i.id === updatedItem.id ? updatedItem : i);
          return { ...o, orderItems: updatedOrderItems };
        }
        return o;
      }));
    });
    
    socket.on('order_completed', (completedOrder) => {
      setOrders(prev => prev.filter(o => o.id !== completedOrder.id));
    });

    return () => {
      socket.off('new_order');
      socket.off('order_updated');
      socket.off('item_fulfilled');
      socket.off('order_completed');
    };
  }, [socket]);

  const fulfillItem = (itemId) => {
    socket.emit('fulfill_item', { itemId });
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
        <h2>Service Display</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => navigate('/order')}>Back to Order</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>
      
      <div className="main-content service-grid">
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
                <span className="badge badge-pending">Kitchen Prep</span>
              ) : (
                <span className="badge badge-ready">Hot Food Ready</span>
              )}
            </div>
            
            <div className="ticket-items">
              {order.orderItems.map(item => (
                <div 
                  key={item.id} 
                  className={`ticket-item ${item.itemStatus === 'fulfilled' ? 'fulfilled' : ''}`}
                  style={{ flexDirection: 'column', alignItems: 'stretch' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{item.quantity}x {item.menuItem?.name || 'Unknown'}</span>
                    {item.itemStatus === 'pending' && (
                      <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} onClick={() => fulfillItem(item.id)}>
                        Hand Off
                      </button>
                    )}
                  </div>
                  {renderOptions(item.optionsSnapshot)}
                </div>
              ))}
            </div>
          </div>
        ))}
        {orders.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', marginTop: '2rem' }}>No active orders</p>}
      </div>
    </>
  );
}
