import React, { useState, useRef, useEffect } from 'react';

export default function CustomSelect({ options = [], value, onChange, onAddNew, placeholder = 'Select...' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsAdding(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateNew = async (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    if (onAddNew) {
      await onAddNew(newLabel.trim());
    }
    setNewLabel('');
    setIsAdding(false);
    setIsOpen(false);
  };

  return (
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
        onClick={() => {
          setIsOpen(!isOpen);
          setIsAdding(false);
        }}
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
            right: 0,
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
          {onAddNew && !isAdding && (
            <div
              style={{
                padding: '0.75rem 1rem',
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
              onClick={() => setIsAdding(true)}
            >
              + Add New Category...
            </div>
          )}

          {/* Inline creation form */}
          {onAddNew && isAdding && (
            <form
              onSubmit={handleCreateNew}
              style={{
                padding: '0.75rem 1rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(139, 92, 246, 0.12)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              <input
                className="input"
                placeholder="New category name"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                autoFocus
                style={{ fontSize: '0.95rem', padding: '0.5rem 0.75rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.4rem', fontSize: '0.9rem' }}>
                  Create
                </button>
                <button type="button" className="btn btn-outline" style={{ padding: '0.4rem', fontSize: '0.9rem' }} onClick={() => setIsAdding(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
