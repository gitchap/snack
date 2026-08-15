import React, { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';
import useFavicon from '../hooks/useFavicon';
import { formatTicketCode } from '../utils/formatTicket';
import { useActionLock } from '../hooks/useActionLock';
import { useMeasuredTicketPartition } from '../utils/partitionTickets';

export default function KitchenScreen() {
  useFavicon('kitchen.png', 'Kitchen Display - Snack Shack');
  const socket = useContext(SocketContext);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [confirmUndoOrder, setConfirmUndoOrder] = useState(null);
  const gridRef = useRef(null);

  useEffect(() => {
    const fetchActiveOrders = () => {
      fetch('/api/orders/active')
        .then(res => {
          if (res.status === 401) {
            logout();
            return [];
          }
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) setOrders(data);
        })
        .catch(err => console.error('Failed to fetch active orders:', err));
    };

    fetchActiveOrders();

    socket.on('connect', fetchActiveOrders);

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
      socket.off('connect', fetchActiveOrders);
      socket.off('new_order');
      socket.off('order_updated');
      socket.off('order_completed');
    };
  }, [socket, logout]);

  const { withLock, isLocked } = useActionLock(1000);

  const markReady = withLock('markReady', (orderId) => {
    socket.emit('update_kitchen_status', { orderId, status: 'ready' });
  });

  const markPending = withLock('markPending', (orderId) => {
    socket.emit('update_kitchen_status', { orderId, status: 'pending' });
  });

  const toggleKitchenItem = withLock('toggleKitchenItem', (itemId) => {
    socket.emit('toggle_kitchen_item', { itemId });
  });

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
              <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {groupName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {choices.map((c, idx) => (
                  <div key={idx} style={{
                    padding: '0.3rem 0.65rem',
                    background: 'var(--glass-hover)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.9rem',
                    color: 'var(--text-main)',
                    borderLeft: '2px solid var(--primary)',
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

  const kitchenOrders = orders.filter(order => 
    order.orderItems && order.orderItems.some(item => item.menuItem?.requiresCooking !== false)
  );

  const ticketParts = useMeasuredTicketPartition(
    kitchenOrders, 
    gridRef, 
    items => items.filter(item => item.menuItem?.requiresCooking !== false)
  );

  return (
    <>
      <div className="topbar glass">
        <h2>Kitchen Display</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => navigate('/order')}>Back to Order</button>
          <button className="btn btn-outline" onClick={logout}>Logout</button>
        </div>
      </div>
      
      <div ref={gridRef} className="main-content kitchen-grid">
        {ticketParts.map((part) => {
          const isFirstInQueue = part.queueIndex === 0;
          const isReady = part.kitchenStatus === 'ready';

          return (
            <div 
              key={part.cardPartKey} 
              data-order-id={part.id}
              className={`glass glass-card ticket ${isReady ? 'ticket-ready' : 'ticket-pending'}`}
              style={{
                borderColor: isFirstInQueue && !isReady ? 'var(--primary)' : undefined,
                boxShadow: isFirstInQueue && !isReady ? '0 0 10px rgba(139, 92, 246, 0.3)' : undefined
              }}
            >
                    {/* Header: First Part vs Continuation Part */}
                    {!part.isContinuation ? (
                      <div className="ticket-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                          {/* Column 1: Queue Badge */}
                          <span style={{ 
                            fontSize: '0.85rem', 
                            padding: '0.25rem 0.55rem',
                            borderRadius: 'var(--radius-md)', 
                            background: isFirstInQueue ? 'var(--primary)' : 'var(--glass-border)', 
                            color: 'var(--text-main)',
                            fontWeight: '800',
                            flexShrink: 0,
                            marginTop: '0.05rem'
                          }}>
                            #{part.queueIndex + 1} {isFirstInQueue ? 'NEXT' : ''}
                          </span>

                          {/* Column 2: Name & Fire (Row 1), Ticket Code & Part Badge (Row 2) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <h3 style={{ margin: 0, fontSize: '1.35rem', lineHeight: '1.2', fontWeight: '800' }}>
                                {part.customerName || formatTicketCode(part.orderNumber)}
                              </h3>
                              {part.priority && (
                                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🔥</span>
                              )}
                              {part.totalParts > 1 && (
                                <span className="badge-cont" style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem' }}>
                                  Part 1/{part.totalParts}
                                </span>
                              )}
                            </div>
                            {part.customerName && (
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>
                                {formatTicketCode(part.orderNumber)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status badge — right */}
                        {part.kitchenStatus === 'pending' ? (
                          <span className="badge badge-pending">Cooking...</span>
                        ) : (
                          <span 
                            className="badge badge-ready" 
                            title="Tap to Undo Food Ready"
                            onClick={() => setConfirmUndoOrder(part)}
                          >
                            Food Ready ↩
                          </span>
                        )}
                      </div>
                    ) : (
                      /* Continuation Top Header */
                      <div className="ticket-continuation-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', minWidth: 0 }}>
                          <span className="badge-cont">#{part.queueIndex + 1} (Cont.)</span>
                          <strong style={{ fontSize: '1.15rem', color: 'var(--text-main)' }}>
                            {part.customerName || formatTicketCode(part.orderNumber)}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                            Part {part.partIndex} of {part.totalParts}
                          </span>
                        </div>
                        {part.kitchenStatus === 'pending' ? (
                          <span className="badge badge-pending" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>Cooking...</span>
                        ) : (
                          <span className="badge badge-ready" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>Food Ready</span>
                        )}
                      </div>
                    )}
                  
                    {/* Items for this part */}
                    <div className="ticket-items">
                      {part.partitionedItems.map(item => {
                        const isItemReady = item.kitchenItemStatus === 'ready';
                        return (
                          <div 
                            key={item.id} 
                            data-item-id={item.id}
                            className="ticket-item" 
                            style={{ 
                              flexDirection: 'column',
                              alignItems: 'stretch',
                              background: isItemReady ? 'var(--success-dim)' : 'var(--glass-bg)',
                              border: isItemReady ? '1px solid var(--success-border)' : '1px solid var(--glass-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.85rem',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                                <span className="item-bullet" />
                                <span style={{ 
                                  fontSize: '1.15rem', 
                                  fontWeight: '600', 
                                  color: 'var(--text-main)', 
                                  letterSpacing: '0.01em',
                                  textDecoration: isItemReady ? 'line-through' : 'none', 
                                  opacity: isItemReady ? 0.65 : 1,
                                  lineHeight: '1.2'
                                }}>
                                  {item.menuItem?.name || 'Unknown Item'}
                                </span>
                              </div>
                              <button 
                                className={isItemReady ? 'btn-item-ready' : 'btn-item-prep'} 
                                style={{ flexShrink: 0 }}
                                onClick={() => toggleKitchenItem(item.id)}
                                title={isItemReady ? 'Tap to mark as Not Ready' : 'Tap to mark Ready'}
                              >
                                {isItemReady ? (
                                  <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>Ready</span>
                                  </>
                                ) : (
                                  <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <circle cx="12" cy="12" r="9" />
                                    </svg>
                                    <span>Mark Ready</span>
                                  </>
                                )}
                              </button>
                            </div>
                            {renderOptions(item.optionsSnapshot)}
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Continuation Banner */}
                    {part.hasContinuationAfter && (
                      <div className="ticket-continuation-footer">
                        <span>⬇ Continues in next column ➔</span>
                      </div>
                    )}
                  
                    {/* Food Ready button on final part */}
                    {!part.hasContinuationAfter && part.kitchenStatus === 'pending' && (
                      <button 
                        className="btn btn-success" 
                        style={{ marginTop: '0.75rem', width: '100%' }}
                        onClick={() => markReady(part.id)}
                      >
                        Food Ready
                      </button>
                    )}
                  </div>
                );
              })}
              {kitchenOrders.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', marginTop: '2rem' }}>No orders currently in cooking queue</p>}
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
