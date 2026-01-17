import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/config/api';

interface User {
  _id: string;
  username: string;
  email: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token and user from storage on mount
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedUser = await AsyncStorage.getItem('userData');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Try to fetch runtime API base from backend /config endpoint.
  const getRuntimeApiBase = async () => {
    try {
      // derive server root from API_URL (which is like http://host:port/api)
      const root = API_URL.replace(/\/api\/?$/, '');
      const res = await fetch(`${root}/config`);
      if (!res.ok) return API_URL;
      const data = await res.json();
      return data.apiBase || API_URL;
    } catch (err) {
      return API_URL;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const runtimeBase = await getRuntimeApiBase();
      console.log('Attempting login to:', `${runtimeBase}/users/login`);
      const response = await fetch(`${runtimeBase}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.success) {
        const { user, token } = data.data;
        setUser(user);
        setToken(token);

        // Store in AsyncStorage
        await AsyncStorage.setItem('authToken', token);
        await AsyncStorage.setItem('userData', JSON.stringify(user));
      }
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('API_URL:', API_URL);
      throw new Error(error.message || 'Network connection failed. Make sure backend is running.');
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      console.log('Attempting registration to:', `${API_URL}/users/register`);
      const response = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      if (data.success) {
        const { user, token } = data.data;
        setUser(user);
        setToken(token);

        // Store in AsyncStorage
        await AsyncStorage.setItem('authToken', token);
        await AsyncStorage.setItem('userData', JSON.stringify(user));
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      console.error('API_URL:', API_URL);
      throw new Error(error.message || 'Network connection failed. Make sure backend is running.');
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setToken(null);
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
