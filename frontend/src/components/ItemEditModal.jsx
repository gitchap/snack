import React, { useState } from 'react';
import CustomSelect from './CustomSelect';

export default function ItemEditModal({ item, categories, token, onClose, onSaved }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price);
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [options, setOptions] = useState(item.options || []);

  // New option state inside modal
  const [newOptName, setNewOptName] = useState('Ingredients');
  const [newOptChoices, setNewOptChoices] = useState('');
  const [newOptDefaultOn, setNewOptDefaultOn] = useState(true);

  // Option edit state
  const [editingOptId, setEditingOptId] = useState(null);
  const [editOptName, setEditOptName] = useState('');
  const [editOptChoices, setEditOptChoices] = useState('');
  const [editOptDefaultOn, setEditOptDefaultOn] = useState(true);

  const handleSaveItem = async () => {
    try {
      const res = await fetch(`/api/admin/menu/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, price: parseFloat(price), categoryId: parseInt(categoryId) })
      });
      if (res.ok) {
        await onSaved();
        onClose();
      } else {
        alert('Failed to save item changes.');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving item: ' + e.message);
    }
  };

  const handleDeleteItem = async () => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/menu/${item.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await onSaved();
        onClose();
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting item.');
    }
  };

  const handleAddOption = async (e) => {
    e.preventDefault();
    if (!newOptChoices.trim()) return;
    try {
      const res = await fetch(`/api/admin/menu/${item.id}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newOptName, choices: newOptChoices.trim(), defaultOn: newOptDefaultOn })
      });
      if (res.ok) {
        const createdOpt = await res.json();
        setOptions(prev => [...prev, createdOpt]);
        setNewOptChoices('');
        onSaved();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartEditOpt = (opt) => {
    setEditingOptId(opt.id);
    setEditOptName(opt.name);
    setEditOptChoices(opt.choices);
    setEditOptDefaultOn(opt.defaultOn !== false);
  };

  const handleSaveOpt = async (optId) => {
    try {
      const res = await fetch(`/api/admin/options/${optId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: editOptName, choices: editOptChoices.trim(), defaultOn: editOptDefaultOn })
      });
      if (res.ok) {
        const updatedOpt = await res.json();
        setOptions(prev => prev.map(o => o.id === optId ? updatedOpt : o));
        setEditingOptId(null);
        onSaved();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteOpt = async (optId) => {
    try {
      const res = await fetch(`/api/admin/options/${optId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setOptions(prev => prev.filter(o => o.id !== optId));
        onSaved();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass glass-card modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0 }}>Edit {item.name}</h2>
          <button className="btn btn-outline" style={{ minWidth: '6rem' }} onClick={onClose}>✕ Cancel</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Item Basic Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <label style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Item Details</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Item Name" />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input type="number" step="0.01" className="input" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price" style={{ flex: 1 }} />
              <div style={{ flex: 1 }}>
                <CustomSelect
                  options={categories.map(c => ({ value: c.id, label: c.name }))}
                  value={categoryId}
                  onChange={val => setCategoryId(val)}
                />
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '0.5rem 0' }} />

          {/* Option Groups List */}
          <div>
            <h4 style={{ margin: '0 0 0.75rem 0' }}>Option Groups</h4>
            {options && options.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {options.map(opt => {
                  if (editingOptId === opt.id) {
                    return (
                      <div key={opt.id} style={{ background: 'rgba(0,0,0,0.25)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <input className="input" value={editOptName} onChange={e => setEditOptName(e.target.value)} placeholder="Group Name" />
                        <input className="input" value={editOptChoices} onChange={e => setEditOptChoices(e.target.value)} placeholder="Comma-separated choices" />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                          <input type="checkbox" checked={editOptDefaultOn} onChange={e => setEditOptDefaultOn(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                          Default ON (pre-selected when ordering)
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-success" style={{ flex: 1 }} onClick={() => handleSaveOpt(opt.id)}>Save Group</button>
                          <button className="btn btn-outline" onClick={() => setEditingOptId(null)}>Cancel</button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={opt.id} style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{opt.name}:</strong> <span style={{ color: 'var(--text-muted)' }}>{opt.choices}</span>
                        <div style={{ fontSize: '0.85rem', color: opt.defaultOn !== false ? 'var(--success)' : 'var(--warning)', marginTop: '0.2rem' }}>
                          {opt.defaultOn !== false ? '● Default ON' : '○ Default OFF'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline" onClick={() => handleStartEditOpt(opt)}>Edit</button>
                        <button className="btn btn-danger" onClick={() => handleDeleteOpt(opt.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 0.5rem 0' }}>No option groups yet.</p>
            )}
          </div>

          {/* Add New Option Group Form inside Modal */}
          <form onSubmit={handleAddOption} style={{ background: 'rgba(139,92,246,0.08)', border: '1px dashed rgba(139,92,246,0.3)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ margin: 0, color: 'var(--primary)' }}>+ Add New Option Group</h4>
            <input className="input" placeholder="Group Name (e.g. Ingredients)" value={newOptName} onChange={e => setNewOptName(e.target.value)} />
            <input className="input" placeholder="Choices (comma-separated: Lettuce, Tomato, Mayo)" value={newOptChoices} onChange={e => setNewOptChoices(e.target.value)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={newOptDefaultOn} onChange={e => setNewOptDefaultOn(e.target.checked)} style={{ width: '16px', height: '16px' }} />
              Default ON (pre-selected when ordering)
            </label>
            <button type="submit" className="btn btn-outline">Add Option Group</button>
          </form>

          {/* Bottom Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button className="btn btn-success" style={{ flex: 2, padding: '0.85rem', fontSize: '1.05rem' }} onClick={handleSaveItem}>Save Changes</button>
            <button className="btn btn-danger" style={{ flex: 1, padding: '0.85rem' }} onClick={handleDeleteItem}>Delete Item</button>
          </div>
        </div>
      </div>
    </div>
  );
}
