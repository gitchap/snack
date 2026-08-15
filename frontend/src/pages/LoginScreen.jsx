import React, { useState, useContext } from 'react';
import { AuthContext } from '../App';
import { useNavigate } from 'react-router-dom';
import useFavicon from '../hooks/useFavicon';

export default function LoginScreen() {
  useFavicon('order.png', 'Login - Snack Shack');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      });
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.role, staySignedIn);
        navigate(data.role === 'admin' ? '/admin' : '/order');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection failed. Please check network.');
    }
  };

  return (
    <div className="login-container">
      <div className="glass glass-card login-box">
        <h1 style={{ marginBottom: '0.5rem' }}>Snack Shack</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Please login to continue</p>
        
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>}
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            type="text" 
            className="input" 
            placeholder="Username" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input 
            type="password" 
            className="input" 
            placeholder="PIN" 
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', color: 'var(--text-subtle)', fontSize: '0.95rem', userSelect: 'none', marginTop: '0.25rem' }}>
            <input 
              type="checkbox" 
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              checked={staySignedIn} 
              onChange={(e) => setStaySignedIn(e.target.checked)} 
            />
            Stay signed in on this device
          </label>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.75rem', padding: '0.9rem', fontSize: '1.05rem', fontWeight: '700' }}>
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
