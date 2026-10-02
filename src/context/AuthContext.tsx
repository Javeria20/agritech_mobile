import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { API_URL } from '../constants/api';

type User = {
  id: number;
  name: string;
  email: string;
  district?: string;
  preferred_language?: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.log('Error loading auth:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.detail || 'Login failed' };
      }

      await AsyncStorage.setItem('token', data.access_token);
      setToken(data.access_token);

      const meResponse = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const meData = await meResponse.json();
      await AsyncStorage.setItem('user', JSON.stringify(meData));
      setUser(meData);

      return { success: true };
    } catch (e) {
      return { success: false, error: 'Network error. Check your connection.' };
    }
  }

  async function signup(name: string, email: string, password: string) {
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.detail || 'Signup failed' };
      }

      return await login(email, password);
    } catch (e) {
      return { success: false, error: 'Network error. Check your connection.' };
    }
  }

  async function logout() {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}