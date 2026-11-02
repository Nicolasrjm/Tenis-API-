import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAuthToken, getAuthToken, setGuestToken, getGuestToken } from '../services/api';
import { syncService } from '../services/syncService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [guest, setGuest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    syncService.setCurrentUser(user);
  }, [user]);

  useEffect(() => {
    checkCurrentAuth();
  }, []);

  const checkCurrentAuth = async () => {
    const token = getAuthToken();
    const guestToken = getGuestToken();

    if (token) {
      try {
        const data = await api.getMe();
        if (data?.user) {
          setGuestToken(null);
          setGuest(null);
          setUser(data.user);
          setLoading(false);
          return;
        }
      } catch (e) {
        setAuthToken(null);
        setUser(null);
      }
    }

    if (guestToken) {
      try {
        const data = await api.getGuestMe();
        if (data?.guest) {
          setUser(null);
          setGuest(data.guest);
          setLoading(false);
          return;
        }
      } catch (e) {
        setGuestToken(null);
        setGuest(null);
      }
    }

    setUser(null);
    setGuest(null);
    setLoading(false);
  };

  const login = async (username, password) => {
    const prevGuestToken = getGuestToken();
    if (prevGuestToken) {
      try {
        await api.logoutGuest();
      } catch (e) {}
      setGuestToken(null);
      setGuest(null);
    }

    const res = await api.login({ username, password, guest_token: prevGuestToken || undefined });
    if (res.success && res.token) {
      setGuestToken(null);
      setGuest(null);
      setAuthToken(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error('Falha no login');
  };

  const startGuest = async () => {
    // Limpa qualquer sessão anterior antes de iniciar como visitante
    if (getAuthToken()) {
      setAuthToken(null);
      setUser(null);
    }
    if (getGuestToken()) {
      try {
        await api.logoutGuest();
      } catch (e) {}
      setGuestToken(null);
    }

    const res = await api.startGuestSession();
    if (res.success && res.token && res.guest) {
      setGuestToken(res.token);
      setUser(null);
      setGuest(res.guest);
      return res.guest;
    }
    throw new Error('Falha ao iniciar sessão de visitante');
  };

  const exitGuest = async () => {
    try {
      await api.logoutGuest();
    } catch (e) {}
    setGuestToken(null);
    setGuest(null);
  };

  const logout = async () => {
    if (getGuestToken()) {
      try {
        await api.logoutGuest();
      } catch (e) {}
      setGuestToken(null);
      setGuest(null);
    }
    if (getAuthToken()) {
      try {
        await api.logout();
      } catch (e) {}
      setAuthToken(null);
      setUser(null);
    }
  };

  const value = {
    user,
    setUser,
    guest,
    setGuest,
    loading,
    login,
    startGuest,
    exitGuest,
    logout,
    checkCurrentAuth,
    isAuthenticated: !!user,
    isGuest: !!guest && !user,
    canPlay: !!user || !!guest,
    isAdmin: user?.role === 'admin',
    isPlayer: user?.role === 'player'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
