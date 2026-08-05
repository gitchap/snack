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
            const label = opt.defaultOn !== false ? 'Remove to customize' : 'Add extras';
            return (
              <div key={opt.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0 }}>{opt.name}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</span>
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
          <button className="btn btn-success" style={{ flex: 2 }} onClick={() => onConfirm(selections)}>Add to Order</button>
        </div>
      </div>
    </div>
  );
}
