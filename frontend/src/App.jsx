import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';

import LoginScreen from './pages/LoginScreen';
import OrderScreen from './pages/OrderScreen';
import KitchenScreen from './pages/KitchenScreen';
import ServiceScreen from './pages/ServiceScreen';
import AdminScreen from './pages/AdminScreen';

const socket = io('http://localhost:3005');

export const SocketContext = React.createContext();
export const AuthContext = React.createContext();

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [role, setRole] = useState(localStorage.getItem('role'));

  const login = (newToken, newRole) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('role', newRole);
    setToken(newToken);
    setRole(newRole);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, login, logout }}>
      <SocketContext.Provider value={socket}>
        <BrowserRouter>
          <div className="app-container">
            <Routes>
              <Route path="/login" element={<LoginScreen />} />
              <Route path="/order" element={<ProtectedRoute><OrderScreen /></ProtectedRoute>} />
              <Route path="/kitchen" element={<ProtectedRoute><KitchenScreen /></ProtectedRoute>} />
              <Route path="/service" element={<ProtectedRoute><ServiceScreen /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminScreen /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          </div>
        </BrowserRouter>
      </SocketContext.Provider>
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children, adminOnly }) {
  const { token, role } = React.useContext(AuthContext);
  if (!token) return <Navigate to="/login" />;
  if (adminOnly && role !== 'admin') return <Navigate to="/order" />;
  return children;
}

export default App;
