import React, { useState, useEffect, useContext } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';
import useFavicon from '../hooks/useFavicon';
import { formatTicketCode } from '../utils/formatTicket';

export default function KitchenScreen() {
  useFavicon('kitchen.png', 'Kitchen Display - Snack Shack');
  const socket = useContext(SocketContext);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [confirmUndoOrder, setConfirmUndoOrder] = useState(null);

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
        <h2>Kitchen Display</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => navigate('/order')}>Back to Order</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>
      
      <div className="main-content kitchen-grid">
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
              <div className="ticket-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                  {/* Column 1: Queue Badge */}
                  <span style={{ 
                    fontSize: '0.85rem', 
                    padding: '0.25rem 0.55rem',
                    borderRadius: 'var(--radius-md)', 
                    background: isFirstInQueue ? 'var(--primary)' : 'rgba(255,255,255,0.12)', 
                    color: '#fff',
                    fontWeight: '800',
                    flexShrink: 0,
                    marginTop: '0.05rem'
                  }}>
                    #{index + 1} {isFirstInQueue ? 'NEXT' : ''}
                  </span>

                  {/* Column 2: Name & Fire (Row 1), Ticket Code (Row 2, aligned under Name) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.35rem', lineHeight: '1.2', fontWeight: '800' }}>
                        {order.customerName || formatTicketCode(order.orderNumber)}
                      </h3>
                      {order.priority && (
                        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🔥</span>
                      )}
                    </div>
                    {order.customerName && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>
                        {formatTicketCode(order.orderNumber)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status badge — right */}
                {order.kitchenStatus === 'pending' ? (
                  <span className="badge badge-pending">Cooking</span>
                ) : (
                  <span 
                    className="badge badge-ready" 
                    title="Tap to Undo Food Ready"
                    onClick={() => setConfirmUndoOrder(order)}
                  >
                    Food Ready ↩
                  </span>
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
                      alignItems: 'stretch',
                      background: isReady ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.04)',
                      border: isReady ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
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
                        <span style={{ 
                          fontSize: '1.4rem', 
                          fontWeight: '800', 
                          color: '#ffffff', 
                          letterSpacing: '0.01em',
                          textDecoration: isReady ? 'line-through' : 'none', 
                          opacity: isReady ? 0.65 : 1 
                        }}>
                          {item.menuItem?.name || 'Unknown Item'}
                        </span>
                      </div>
                      <button 
                        className={`btn ${isReady ? 'btn-success' : 'btn-outline'}`} 
                        style={{ 
                          minHeight: 'var(--touch-min)',
                          padding: '0 1rem',
                          fontSize: '0.95rem',
                          fontWeight: '700',
                          flexShrink: 0
                        }}
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
        );
      })}
        {orders.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', marginTop: '2rem' }}>No active orders</p>}
      </div>

      {confirmUndoOrder && (
        <div className="modal-overlay" onClick={() => setConfirmUndoOrder(null)}>
          <div className="glass glass-card modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--warning)', fontSize: '1.5rem' }}>Undo "Food Ready"?</h3>
            <p style={{ color: 'var(--text-main)', marginBottom: '1.5rem', lineHeight: '1.5', fontSize: '1.1rem' }}>
              Revert <strong>{confirmUndoOrder.customerName || `Order #${confirmUndoOrder.orderNumber}`}</strong> back to <strong>Cooking</strong> status?
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setConfirmUndoOrder(null)}>
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                style={{ flex: 1 }} 
                onClick={() => {
                  markPending(confirmUndoOrder.id);
                  setConfirmUndoOrder(null);
                }}
              >
                Yes, Undo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
