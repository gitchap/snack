import React, { useState, useRef, useEffect } from 'react';

export default function CustomSelect({ options = [], value, onChange, onAddNew, placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    if (onAddNew) {
      await onAddNew(newCatName.trim());
    }
    setNewCatName('');
    setShowModal(false);
    setIsOpen(false);
  };

  return (
    <>
      <div ref={containerRef} style={{ position: 'relative', width: '100%', flex: 1, minWidth: 0 }}>
        {/* Trigger Box */}
        <div
          className="input"
          style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            gap: '1rem',
            width: '100%',
            borderColor: isOpen ? 'var(--primary)' : 'var(--glass-border)'
          }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <span style={{ fontSize: '0.75rem', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', opacity: 0.8, flexShrink: 0, marginLeft: 'auto' }}>
            ▼
          </span>
        </div>

        {/* Popup Menu */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: '100%',
              width: 'max-content',
              maxWidth: '320px',
              zIndex: 9999,
              background: '#1e1b4b',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden',
              padding: '0.35rem 0'
            }}
          >
            {options.map(opt => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={opt.value}
                  style={{
                    padding: '0.75rem 1rem',
                    minHeight: 'var(--touch-min)',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: isSelected ? '600' : 'normal',
                    color: isSelected ? '#ffffff' : 'var(--text-main)',
                    background: isSelected ? 'var(--primary)' : 'transparent',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  {opt.label}
                </div>
              );
            })}

            {/* "+ Add New..." Option */}
            {onAddNew && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  minHeight: 'var(--touch-min)',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#a78bfa',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(139, 92, 246, 0.08)',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)'}
                onClick={() => {
                  setIsOpen(false);
                  setShowModal(true);
                }}
              >
                + Add New Category...
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Category Modal Popup */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="glass glass-card modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', width: '90%' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.25rem' }}>Create New Category</h3>
            <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <input
                className="input"
                placeholder="Category Name (e.g. Desserts)"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                autoFocus
                required
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn btn-success" style={{ flex: 2, padding: '0.85rem' }}>
                  Create Category
                </button>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
