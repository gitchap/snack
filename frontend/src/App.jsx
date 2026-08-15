import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';

import LoginScreen from './pages/LoginScreen';
import OrderScreen from './pages/OrderScreen';
import KitchenScreen from './pages/KitchenScreen';
import ServiceScreen from './pages/ServiceScreen';
import AdminScreen from './pages/AdminScreen';

const socket = io();

export const SocketContext = React.createContext();
export const AuthContext = React.createContext();

// Helper to check if a JWT token has expired
const isTokenExpired = (t) => {
  if (!t) return true;
  try {
    const payload = JSON.parse(atob(t.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return true;
    }
    return false;
  } catch (_) {
    return true;
  }
};

const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
};

const getStoredToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('snack_token');
};

const getStoredRole = () => {
  return localStorage.getItem('role') || sessionStorage.getItem('role') || getCookie('snack_role');
};

function App() {
  const [token, setToken] = useState(getStoredToken());
  const [role, setRole] = useState(getStoredRole());
  const [sessionExpired, setSessionExpired] = useState(false);

  const login = (newToken, newRole, staySignedIn = true) => {
    if (staySignedIn) {
      localStorage.setItem('token', newToken);
      localStorage.setItem('role', newRole);
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('role');
      // Set long-lived persistent cookie for browser/Chromium restarts
      document.cookie = `snack_token=${encodeURIComponent(newToken)}; max-age=315360000; path=/; SameSite=Lax`;
      document.cookie = `snack_role=${encodeURIComponent(newRole)}; max-age=315360000; path=/; SameSite=Lax`;
    } else {
      sessionStorage.setItem('token', newToken);
      sessionStorage.setItem('role', newRole);
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      document.cookie = `snack_token=; max-age=0; path=/; SameSite=Lax`;
      document.cookie = `snack_role=; max-age=0; path=/; SameSite=Lax`;
    }
    setToken(newToken);
    setRole(newRole);
    setSessionExpired(false);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    document.cookie = `snack_token=; max-age=0; path=/; SameSite=Lax`;
    document.cookie = `snack_role=; max-age=0; path=/; SameSite=Lax`;
    setToken(null);
    setRole(null);
  };

  useEffect(() => {
    // Validate stored token on mount
    const activeToken = getStoredToken();
    if (activeToken && isTokenExpired(activeToken)) {
      setSessionExpired(true);
    }

    // Global fetch interceptor to catch any 401 Unauthorized API responses
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (response.status === 401 && !window.location.pathname.includes('/login')) {
          setSessionExpired(true);
        }
        return response;
      } catch (err) {
        return Promise.reject(err);
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ token, role, login, logout, triggerSessionExpired: () => setSessionExpired(true) }}>
      <SocketContext.Provider value={socket}>
        <BrowserRouter>
          <div className="app-container">
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/order" element={<ProtectedRoute><OrderScreen /></ProtectedRoute>} />
              <Route path="/kitchen" element={<ProtectedRoute><KitchenScreen /></ProtectedRoute>} />
              <Route path="/service" element={<ProtectedRoute><ServiceScreen /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminScreen /></ProtectedRoute>} />
              <Route path="*" element={<RootRedirect />} />
            </Routes>

            {/* Session Expired Pop-up Modal */}
            {sessionExpired && (
              <div className="modal-overlay" style={{ zIndex: 9999 }}>
                <div className="glass glass-card modal-content" style={{ maxWidth: '440px', textAlign: 'center', padding: '2.25rem 2rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem', lineHeight: 1 }}>🔒</div>
                  <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1.6rem', color: 'var(--warning)' }}>Session Expired</h2>
                  <p style={{ color: 'var(--text-main)', fontSize: '1.05rem', lineHeight: '1.5', marginBottom: '1.75rem' }}>
                    You are not logged in or your session has expired. Please log in again to continue managing orders.
                  </p>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '0.85rem', fontSize: '1.1rem', fontWeight: '700' }}
                    onClick={() => {
                      setSessionExpired(false);
                      logout();
                      window.location.href = '/login';
                    }}
                  >
                    Go to Login Screen
                  </button>
                </div>
              </div>
            )}
          </div>
        </BrowserRouter>
      </SocketContext.Provider>
    </AuthContext.Provider>
  );
}

function RootRedirect() {
  const { token, role } = React.useContext(AuthContext);
  if (token && !isTokenExpired(token)) {
    return <Navigate to={role === 'admin' ? '/admin' : '/order'} replace />;
  }
  return <Navigate to="/login" replace />;
}

function LoginRoute() {
  const { token, role } = React.useContext(AuthContext);
  if (token && !isTokenExpired(token)) {
    return <Navigate to={role === 'admin' ? '/admin' : '/order'} replace />;
  }
  return <LoginScreen />;
}

function ProtectedRoute({ children, adminOnly }) {
  const { token, role, triggerSessionExpired } = React.useContext(AuthContext);
  
  if (!token || isTokenExpired(token)) {
    if (token && isTokenExpired(token)) {
      triggerSessionExpired();
    }
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && role !== 'admin') return <Navigate to="/order" replace />;
  return children;
}

export default App;
