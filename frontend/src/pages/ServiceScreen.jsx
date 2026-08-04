import React, { useState, useEffect, useContext } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';

export default function ServiceScreen() {
  const socket = useContext(SocketContext);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3005/api/orders/active')
      .then(res => res.json())
      .then(data => setOrders(data));

    socket.on('new_order', (order) => setOrders(prev => [...prev, order]));
    
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
          <div key={order.id} className="glass glass-card ticket">
            <div className="ticket-header">
              <h3>Order #{order.orderNumber}</h3>
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
                >
                  <span>{item.quantity}x {item.menuItem?.name || 'Unknown'}</span>
                  {item.itemStatus === 'pending' && (
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }} onClick={() => fulfillItem(item.id)}>
                      Hand Off
                    </button>
                  )}
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
