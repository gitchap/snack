import React, { useState, useEffect, useContext } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';

export default function KitchenScreen() {
  const socket = useContext(SocketContext);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3005/api/orders/active')
      .then(res => res.json())
      .then(data => setOrders(data));

    socket.on('new_order', (order) => {
      setOrders(prev => [...prev, order]);
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
          <div key={order.id} className="glass glass-card ticket">
            <div className="ticket-header">
              <h3>Order #{order.orderNumber}</h3>
              {order.kitchenStatus === 'pending' ? (
                <span className="badge badge-pending">Cooking</span>
              ) : (
                <span className="badge badge-ready">Ready</span>
              )}
            </div>
            
            <div className="ticket-items">
              {order.orderItems.map(item => (
                <div key={item.id} className="ticket-item">
                  <span>{item.quantity}x {item.menuItem?.name || 'Unknown Item'}</span>
                </div>
              ))}
            </div>
            
            {order.kitchenStatus === 'pending' && (
              <button 
                className="btn btn-success" 
                style={{ marginTop: '1rem', width: '100%' }}
                onClick={() => markReady(order.id)}
              >
                Food Ready
              </button>
            )}
          </div>
        ))}
        {orders.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', marginTop: '2rem' }}>No active orders</p>}
      </div>
    </>
  );
}
