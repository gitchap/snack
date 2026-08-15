import React, { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext, AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';
import useFavicon from '../hooks/useFavicon';
import { formatTicketCode } from '../utils/formatTicket';
import { useActionLock } from '../hooks/useActionLock';
import { useMeasuredTicketPartition } from '../utils/partitionTickets';

export default function ServiceScreen() {
  useFavicon('service.png', 'Service Display - Snack Shack');
  const socket = useContext(SocketContext);
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyOrders, setHistoryOrders] = useState([]);
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
      setOrders(prev => {
        const exists = prev.some(o => o.id === updatedOrder.id);
        if (exists) {
          return prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
        } else if (updatedOrder.status === 'active') {
          const newOrders = [...prev, updatedOrder];
          return newOrders.sort((a, b) => {
            if (a.priority === b.priority) return new Date(a.createdAt) - new Date(b.createdAt);
            return a.priority ? -1 : 1;
          });
        }
        return prev;
      });
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

    socket.on('item_unfulfilled', (updatedItem) => {
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
      socket.off('connect', fetchActiveOrders);
      socket.off('new_order');
      socket.off('order_updated');
      socket.off('item_fulfilled');
      socket.off('item_unfulfilled');
      socket.off('order_completed');
    };
  }, [socket, logout]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/orders/history?limit=20');
      const data = await res.json();
      if (Array.isArray(data)) setHistoryOrders(data);
    } catch (e) {
      console.error(e);
    }
  };

  const { withLock, isLocked } = useActionLock(1000);

  const fulfillItem = withLock('fulfillItem', (itemId) => {
    socket.emit('fulfill_item', { itemId });
  });

  const unfulfillItem = withLock('unfulfillItem', (itemId) => {
    socket.emit('unfulfill_item', { itemId });
  });

  const toggleKitchenItem = withLock('toggleKitchenItem', (itemId) => {
    socket.emit('toggle_kitchen_item', { itemId });
  });

  const handleRecallOrder = withLock('recallOrder', (orderId) => {
    socket.emit('recall_order', { orderId });
    setHistoryOrders(prev => prev.filter(o => o.id !== orderId));
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

  const ticketParts = useMeasuredTicketPartition(orders, gridRef);

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
      
      <div ref={gridRef} className="main-content service-grid">
        {ticketParts.map((part) => {
          const isFirstInQueue = part.queueIndex === 0;
          const isFoodReady = part.kitchenStatus === 'ready';
          const orderTotal = (part.orderItems || []).reduce((acc, curr) => acc + (parseFloat(curr.menuItem?.price) || 0) * (curr.quantity || 1), 0);

          return (
            <div 
              key={part.cardPartKey} 
              data-order-id={part.id}
              className={`glass glass-card ticket ${isFoodReady ? 'ticket-ready' : 'ticket-pending'}`}
              style={{
                borderColor: isFirstInQueue && !isFoodReady ? 'var(--primary)' : undefined,
                boxShadow: isFirstInQueue && !isFoodReady ? '0 0 10px rgba(139, 92, 246, 0.3)' : undefined
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

                        {/* Status badge & Order Total — right */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
                          {part.kitchenStatus === 'pending' ? (
                            <span className="badge badge-pending">Cooking...</span>
                          ) : (
                            <span className="badge badge-ready">Food Ready</span>
                          )}
                          {orderTotal > 0 && (
                            <span style={{ color: 'var(--success)', fontWeight: '800', fontSize: '1.05rem' }}>
                              ${orderTotal.toFixed(2)}
                            </span>
                          )}
                        </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                          {part.kitchenStatus === 'pending' ? (
                            <span className="badge badge-pending" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>Cooking...</span>
                          ) : (
                            <span className="badge badge-ready" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>Food Ready</span>
                          )}
                          {orderTotal > 0 && (
                            <span style={{ color: 'var(--success)', fontWeight: '800', fontSize: '0.95rem' }}>
                              ${orderTotal.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  
                    {/* Items for this part */}
                    <div className="ticket-items">
                      {part.partitionedItems.map(item => {
                        const isGrabAndGo = item.menuItem && item.menuItem.requiresCooking === false;

                        return (
                          <div 
                            key={item.id} 
                            data-item-id={item.id}
                            className={`ticket-item ${item.itemStatus === 'fulfilled' ? 'fulfilled' : ''}`}
                            style={{ 
                              flexDirection: 'column', 
                              alignItems: 'stretch',
                              background: 'var(--glass-bg)',
                              border: '1px solid var(--glass-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.85rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                                <span className="item-bullet" />
                                <span style={{ fontSize: '1.15rem', fontWeight: '600', color: 'var(--text-main)', letterSpacing: '0.01em', lineHeight: '1.2' }}>
                                  {item.menuItem?.name || 'Unknown'}
                                </span>

                                {isGrabAndGo ? (
                                  <span className="badge badge-shelf" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    🛍️ Grab & Go
                                  </span>
                                ) : item.kitchenItemStatus === 'ready' ? (
                                  <span className="badge badge-done" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    ✓ Food Ready
                                  </span>
                                ) : (
                                  <span className="badge badge-kitchen" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    🍳 Cooking...
                                  </span>
                                )}
                              </div>

                              {item.itemStatus === 'pending' ? (
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
                              ) : (
                                <button 
                                  className="btn btn-outline undo-item-btn" 
                                  title="Undo Hand Off"
                                  aria-label="Undo Hand Off"
                                  style={{ 
                                    width: 'var(--touch-min)',
                                    height: 'var(--touch-min)',
                                    minWidth: 'var(--touch-min)',
                                    minHeight: 'var(--touch-min)',
                                    padding: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 'var(--radius-sm)',
                                    flexShrink: 0,
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    borderColor: 'rgba(255, 255, 255, 0.2)',
                                    color: '#ffffff',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => unfulfillItem(item.id)}
                                >
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 7v6h6" />
                                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                                  </svg>
                                </button>
                              )}
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
              {historyOrders.map(order => {
                const orderTotal = (order.orderItems || []).reduce((acc, curr) => acc + (parseFloat(curr.menuItem?.price) || 0) * (curr.quantity || 1), 0);
                return (
                  <div key={order.id} className="glass" style={{ padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '1.05rem' }}>{order.customerName || `Order #${order.orderNumber}`}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                      {orderTotal > 0 && (
                        <span style={{ color: 'var(--success)', fontWeight: '800', fontSize: '1.1rem' }}>
                          ${orderTotal.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {(order.orderItems || []).map(i => i.menuItem?.name || 'Item').join(' • ')}
                    </div>
                    <button 
                      className="btn btn-primary" 
                      style={{ marginTop: '0.5rem', padding: '0.45rem 0.8rem', fontSize: '0.85rem' }}
                      onClick={() => handleRecallOrder(order.id)}
                    >
                      ↩ Recall Order to Active Queue
                    </button>
                  </div>
                );
              })}
              {historyOrders.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No completed orders found</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
