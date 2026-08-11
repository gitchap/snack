import React, { useState } from 'react';

export default function ItemCustomizerModal({ item, onClose, onConfirm }) {
  const [selections, setSelections] = useState(() => {
    const initial = {};
    if (item?.options) {
      item.options.forEach(opt => {
        const choiceArray = opt.choices.split(',').map(c => c.trim()).filter(Boolean);
        // defaultOn = true → start all selected; defaultOn = false → start none selected
        initial[opt.name] = opt.defaultOn !== false ? [...choiceArray] : [];
      });
    }
    return initial;
  });

  const toggleChoice = (optionName, choice) => {
    setSelections(prev => {
      const current = prev[optionName] || [];
      if (current.includes(choice)) {
        return { ...prev, [optionName]: current.filter(c => c !== choice) };
      } else {
        return { ...prev, [optionName]: [...current, choice] };
      }
    });
  };

  const unfulfilledRequired = item.options?.filter(opt => {
    if (!opt.required) return false;
    const current = selections[opt.name] || [];
    return current.length === 0;
  }) || [];

  const isValid = unfulfilledRequired.length === 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass glass-card modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Customize {item.name}</h2>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
          {item.options?.map(opt => {
            const choices = opt.choices.split(',').map(c => c.trim()).filter(Boolean);
            const currentSelected = selections[opt.name] || [];
            const isReq = opt.required === true;
            const isMissing = isReq && currentSelected.length === 0;
            const label = isReq 
              ? (isMissing ? '● Required (Select at least 1)' : '✓ Selection made')
              : (opt.defaultOn !== false ? 'Remove to customize' : 'Add extras');

            return (
              <div key={opt.id} style={{ 
                background: isMissing ? 'var(--warning-dim)' : 'transparent',
                padding: isMissing ? '0.75rem' : '0',
                borderRadius: 'var(--radius-sm)',
                border: isMissing ? '1px dashed var(--warning-border)' : 'none',
                transition: 'all 0.2s ease'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, color: isMissing ? 'var(--warning)' : 'var(--text-main)' }}>
                    {opt.name} {isReq && <span style={{ color: 'var(--danger)', fontSize: '1rem' }}>*</span>}
                  </h3>
                  <span style={{ fontSize: '0.85rem', fontWeight: isReq ? '700' : '500', color: isMissing ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {label}
                  </span>
                </div>
                <div className="chip-container">
                  {choices.map(choice => {
                    const isSelected = currentSelected.includes(choice);
                    return (
                      <div
                        key={choice}
                        className={`chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleChoice(opt.name, choice)}
                      >
                        {isSelected ? '✓ ' : '+ '}{choice}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button 
            className="btn btn-success" 
            style={{ flex: 2, opacity: isValid ? 1 : 0.6, cursor: isValid ? 'pointer' : 'not-allowed' }} 
            disabled={!isValid}
            onClick={() => {
              if (isValid) onConfirm(selections);
            }}
          >
            {isValid ? 'Add to Order' : `Select ${unfulfilledRequired[0]?.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}
