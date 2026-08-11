import React, { useState, useEffect, useContext } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';
import useFavicon from '../hooks/useFavicon';
import { formatTicketCode } from '../utils/formatTicket';

export default function ServiceScreen() {
  useFavicon('service.png', 'Service Display - Snack Shack');
  const socket = useContext(SocketContext);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyOrders, setHistoryOrders] = useState([]);

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

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/orders/history?limit=20');
      const data = await res.json();
      if (Array.isArray(data)) setHistoryOrders(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fulfillItem = (itemId) => {
    socket.emit('fulfill_item', { itemId });
  };

  const handleRecallOrder = (orderId) => {
    socket.emit('recall_order', { orderId });
    setHistoryOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const renderOptions = (optionsSnapshot) => {
    if (!optionsSnapshot) return null;
    try {
      const parsed = typeof optionsSnapshot === 'string' ? JSON.parse(optionsSnapshot) : optionsSnapshot;
      const entries = Object.entries(parsed).filter(([_, val]) => Array.isArray(val) && val.length > 0);
      if (entries.length === 0) return null;
      return (
        <div className="options-list" style={{ marginTop: '0.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {entries.map(([groupName, choices]) => (
            <div key={groupName} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {groupName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {choices.map((c, idx) => (
                  <div key={idx} style={{
                    padding: '0.3rem 0.65rem',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.9rem',
                    color: 'var(--text-muted)',
                    borderLeft: '2px solid rgba(139, 92, 246, 0.55)',
                    fontWeight: '500'
                  }}>
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
          <button className="btn btn-outline" onClick={() => { setShowHistoryModal(true); fetchHistory(); }}>History & Recall</button>
          <button className="btn btn-outline" onClick={() => navigate('/order')}>Back to Order</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>
      
      <div className="main-content service-grid">
        {orders.map((order, index) => {
          const isFirstInQueue = index === 0;
          return (
            <div 
              key={order.id} 
              className={`glass glass-card ticket ${order.kitchenStatus === 'ready' ? 'ticket-ready' : 'ticket-pending'}`}
              style={{
                borderColor: isFirstInQueue && order.kitchenStatus !== 'ready' ? 'var(--primary)' : undefined,
                boxShadow: isFirstInQueue && order.kitchenStatus !== 'ready' ? '0 0 16px rgba(139, 92, 246, 0.35)' : undefined
              }}
            >
              <div className="ticket-header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: 0 }}>
                  {/* Queue badge + Name on the same line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ 
                      fontSize: '0.85rem', 
                      padding: '0.25rem 0.55rem',
                      borderRadius: 'var(--radius-md)', 
                      background: isFirstInQueue ? 'var(--primary)' : 'rgba(255,255,255,0.12)', 
                      color: '#fff',
                      fontWeight: '800',
                      flexShrink: 0,
                    }}>
                      #{index + 1} {isFirstInQueue ? 'NEXT' : ''}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '1.35rem', lineHeight: '1.2', fontWeight: '800' }}>
                      {order.customerName || formatTicketCode(order.orderNumber)}
                    </h3>
                    {order.priority && (
                      <span className="badge" style={{ background: 'var(--warning)', color: '#000' }}>🔥 Priority</span>
                    )}
                  </div>
                  {/* Ticket code below the name */}
                  {order.customerName && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '0.1rem', fontWeight: '500' }}>
                      {formatTicketCode(order.orderNumber)}
                    </div>
                  )}
                </div>

                {/* Status badge — right */}
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
                  style={{ 
                    flexDirection: 'column', 
                    alignItems: 'stretch',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                      {/* Qty badge */}
                      <span style={{ 
                        background: 'var(--primary)', 
                        color: '#fff', 
                        fontWeight: '800', 
                        fontSize: '1.1rem', 
                        padding: '0.2rem 0.55rem',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 2px 6px rgba(139, 92, 246, 0.35)',
                        flexShrink: 0
                      }}>
                        {item.quantity}x
                      </span>
                      <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', letterSpacing: '0.01em' }}>
                        {item.menuItem?.name || 'Unknown'}
                      </span>
                    </div>
                    {item.itemStatus === 'pending' && (
                      <button 
                        className="btn btn-primary" 
                        style={{ 
                          minHeight: 'var(--touch-min)',
                          padding: '0 1rem',
                          fontSize: '0.95rem',
                          fontWeight: '700',
                          flexShrink: 0
                        }}
                        onClick={() => fulfillItem(item.id)}
                      >
                        Hand Off
                      </button>
                    )}
                  </div>
                  {renderOptions(item.optionsSnapshot)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
        {orders.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', marginTop: '2rem' }}>No active orders</p>}
      </div>

      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="glass glass-card modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Completed Orders History</h3>
              <button className="btn btn-icon btn-outline" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {historyOrders.map(order => (
                <div key={order.id} className="glass" style={{ padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{order.customerName || `Order #${order.orderNumber}`}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(order.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {(order.orderItems || []).map(i => `${i.quantity}x ${i.menuItem?.name || 'Item'}`).join(', ')}
                  </div>
                  <button 
                    className="btn btn-primary" 
                    style={{ marginTop: '0.5rem', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
                    onClick={() => handleRecallOrder(order.id)}
                  >
                    ↩ Recall Order to Active Queue
                  </button>
                </div>
              ))}
              {historyOrders.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No completed orders found</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
