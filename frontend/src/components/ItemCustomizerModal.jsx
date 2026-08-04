import React, { useState } from 'react';

export default function ItemCustomizerModal({ item, onClose, onConfirm }) {
  const [selections, setSelections] = useState(() => {
    const initial = {};
    if (item?.options) {
      item.options.forEach(opt => {
        const choiceArray = opt.choices.split(',').map(c => c.trim()).filter(Boolean);
        initial[opt.name] = choiceArray;
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

  const handleAdd = () => {
    onConfirm(selections);
  };

  return (
    <div className="modal-overlay">
      <div className="glass glass-card modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Customize {item.name}</h2>
          <button className="btn btn-icon btn-outline" onClick={onClose}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem', paddingRight: '0.5rem' }}>
          {item.options?.map(opt => {
            const choices = opt.choices.split(',').map(c => c.trim()).filter(Boolean);
            const currentSelected = selections[opt.name] || [];
            return (
              <div key={opt.id}>
                <h3>{opt.name}</h3>
                <div className="chip-container">
                  {choices.map(choice => {
                    const isSelected = currentSelected.includes(choice);
                    return (
                      <div 
                        key={choice}
                        className={`chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleChoice(opt.name, choice)}
                      >
                        {isSelected ? '✓ ' : '+ '} {choice}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd}>Add to Order</button>
        </div>
      </div>
    </div>
  );
}
