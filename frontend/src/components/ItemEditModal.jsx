import React, { useState, useEffect } from 'react';
import CustomSelect from './CustomSelect';

export default function ItemEditModal({ item, categories, token, onClose, onSaved }) {
  const [name, setName] = useState(item.name || '');
  const [price, setPrice] = useState(typeof item.price === 'number' ? item.price.toFixed(2) : (parseFloat(item.price) || 0).toFixed(2));
  const [requiresCooking, setRequiresCooking] = useState(item.requiresCooking !== false);
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [options, setOptions] = useState(item.options || []);

  // Sync state if item prop changes
  useEffect(() => {
    setName(item.name || '');
    setPrice(typeof item.price === 'number' ? item.price.toFixed(2) : (parseFloat(item.price) || 0).toFixed(2));
    setRequiresCooking(item.requiresCooking !== false);
    setCategoryId(item.categoryId);
    setOptions(item.options || []);
  }, [item]);

  const [newOptName, setNewOptName] = useState('Ingredients');
  const [newOptChoices, setNewOptChoices] = useState('');
  const [newOptDefaultOn, setNewOptDefaultOn] = useState(true);
  const [newOptRequired, setNewOptRequired] = useState(false);

  // Option edit state
  const [editingOptId, setEditingOptId] = useState(null);
  const [editOptName, setEditOptName] = useState('');
  const [editOptChoices, setEditOptChoices] = useState('');
  const [editOptDefaultOn, setEditOptDefaultOn] = useState(true);
  const [editOptRequired, setEditOptRequired] = useState(false);

  const getAuthToken = () => token || localStorage.getItem('token');

  const parseErrorMessage = async (res) => {
    if (res.status === 401 || res.status === 403) {
      return 'Session expired or unauthorized. Please log out and log back in.';
    }
    try {
      const text = await res.text();
      try {
        const err = JSON.parse(text);
        if (err.error) return err.error;
        if (err.message) return err.message;
      } catch (_) {}
      return text || res.statusText || `Status ${res.status}`;
    } catch (_) {
      return res.statusText || `Status ${res.status}`;
    }
  };

  const handleSaveItem = async () => {
    if (!name.trim()) {
      alert('Item name cannot be empty.');
      return;
    }
    const authToken = getAuthToken();
    try {
      // 1. If user is currently editing an option group inline, save that group first
      if (editingOptId) {
        const ok = await handleSaveOpt(editingOptId);
        if (!ok) return;
      }

      // 2. If user filled out new option choices, save that new option group first
      if (newOptChoices.trim()) {
        const ok = await handleAddOptionSubmit();
        if (!ok) return;
      }

      // 3. Save Item Name, Price, RequiresCooking & Category
      const targetCatId = parseInt(categoryId) || parseInt(item.categoryId);
      const res = await fetch(`/api/admin/menu/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ 
          name: name.trim(), 
          price: parseFloat(price) || 0.0,
          requiresCooking,
          categoryId: targetCatId 
        })
      });

      if (res.ok) {
        await onSaved();
        onClose();
      } else {
        const errMsg = await parseErrorMessage(res);
        alert(`Failed to save item: ${errMsg}`);
      }
    } catch (e) {
      console.error(e);
      alert('Error saving item: ' + e.message);
    }
  };

  const handleDeleteItem = async () => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    const authToken = getAuthToken();
    try {
      const res = await fetch(`/api/admin/menu/${item.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        await onSaved();
        onClose();
      } else {
        const errMsg = await parseErrorMessage(res);
        alert(`Failed to delete item: ${errMsg}`);
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting item: ' + e.message);
    }
  };

  const handleAddOptionSubmit = async () => {
    if (!newOptChoices.trim()) return false;
    const authToken = getAuthToken();
    try {
      const res = await fetch(`/api/admin/menu/${item.id}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ name: newOptName.trim(), choices: newOptChoices.trim(), defaultOn: newOptDefaultOn, required: newOptRequired })
      });
      if (res.ok) {
        const createdOpt = await res.json();
        setOptions(prev => [...prev, createdOpt]);
        setNewOptChoices('');
        setNewOptRequired(false);
        await onSaved();
        return true;
      } else {
        const errMsg = await parseErrorMessage(res);
        alert(`Failed to add option group: ${errMsg}`);
        return false;
      }
    } catch (e) {
      console.error(e);
      alert('Error adding option group: ' + e.message);
      return false;
    }
  };

  const handleAddOption = async (e) => {
    if (e) e.preventDefault();
    await handleAddOptionSubmit();
  };

  const handleStartEditOpt = (opt) => {
    setEditingOptId(opt.id);
    setEditOptName(opt.name);
    setEditOptChoices(opt.choices);
    setEditOptDefaultOn(opt.defaultOn !== false);
    setEditOptRequired(opt.required === true);
  };

  const handleSaveOpt = async (optId) => {
    if (!editOptName.trim() || !editOptChoices.trim()) {
      alert('Option group name and choices cannot be empty.');
      return false;
    }
    const authToken = getAuthToken();
    try {
      const res = await fetch(`/api/admin/options/${optId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ name: editOptName.trim(), choices: editOptChoices.trim(), defaultOn: editOptDefaultOn, required: editOptRequired })
      });
      if (res.ok) {
        const updatedOpt = await res.json();
        setOptions(prev => prev.map(o => o.id === optId ? updatedOpt : o));
        setEditingOptId(null);
        await onSaved();
        return true;
      } else {
        const errMsg = await parseErrorMessage(res);
        alert(`Failed to update option group: ${errMsg}`);
        return false;
      }
    } catch (e) {
      console.error(e);
      alert('Error updating option group: ' + e.message);
      return false;
    }
  };

  const handleDeleteOpt = async (optId) => {
    if (!window.confirm('Delete this option group?')) return;
    const authToken = getAuthToken();
    try {
      const res = await fetch(`/api/admin/options/${optId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        setOptions(prev => prev.filter(o => o.id !== optId));
        await onSaved();
      } else {
        const errMsg = await parseErrorMessage(res);
        alert(`Failed to delete option group: ${errMsg}`);
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting option group: ' + e.message);
    }
  };

  const handleCreateCategory = async (catName) => {
    const authToken = getAuthToken();
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ name: catName })
    });
    if (res.ok) {
      const created = await res.json();
      await onSaved();
      setCategoryId(created.id);
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
              <div className="input" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: '0 0 130px', padding: '0 0.85rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', width: '100%', outline: 'none', fontSize: '1rem', fontFamily: 'inherit', padding: '0.75rem 0' }}
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  onBlur={() => {
                    const num = parseFloat(price);
                    if (!isNaN(num)) setPrice(num.toFixed(2));
                  }}
                  placeholder="0.00"
                />
              </div>
              <div style={{ flex: 1 }}>
                <CustomSelect
                  options={categories.map(c => ({ value: c.id, label: c.name }))}
                  value={categoryId}
                  onChange={val => setCategoryId(val)}
                  onAddNew={handleCreateCategory}
                />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '0.95rem' }}>
              <input 
                type="checkbox" 
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                checked={requiresCooking} 
                onChange={e => setRequiresCooking(e.target.checked)} 
              />
              Requires Cooking
            </label>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '0.5rem 0' }} />

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
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                          <input type="checkbox" checked={editOptRequired} onChange={e => setEditOptRequired(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                          Required (At least 1 choice must be selected)
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-success" style={{ flex: 1 }} onClick={() => handleSaveOpt(opt.id)}>Save Group</button>
                          <button className="btn btn-outline" onClick={() => setEditingOptId(null)}>Cancel</button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={opt.id} style={{ background: 'var(--glass-bg)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{opt.name}:</strong> <span style={{ color: 'var(--text-muted)' }}>{opt.choices}</span>
                        <div style={{ fontSize: '0.85rem', display: 'flex', gap: '0.75rem', marginTop: '0.2rem' }}>
                          <span style={{ color: opt.defaultOn !== false ? 'var(--success)' : 'var(--warning)' }}>
                            {opt.defaultOn !== false ? '● Default ON' : '○ Default OFF'}
                          </span>
                          {opt.required && (
                            <span style={{ color: 'var(--danger)', fontWeight: '600' }}>
                              ● Required (Min 1)
                            </span>
                          )}
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--text-main)' }}>
              <input type="checkbox" checked={newOptRequired} onChange={e => setNewOptRequired(e.target.checked)} style={{ width: '16px', height: '16px' }} />
              Required (At least 1 choice must be selected)
            </label>
            <button type="submit" className="btn btn-outline">Save Group</button>
          </form>

          {/* Bottom Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button className="btn btn-danger" style={{ flex: 1, padding: '0.85rem' }} onClick={handleDeleteItem}>Delete Item</button>
            <button className="btn btn-success" style={{ flex: 2, padding: '0.85rem', fontSize: '1.05rem' }} onClick={handleSaveItem}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
