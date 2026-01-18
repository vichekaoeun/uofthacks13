import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/config/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/users/login', { email, password });
    return response.data;
  },

  register: async (username: string, email: string, password: string) => {
    const response = await api.post('/users/register', { username, email, password });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/users/me');
    return response.data;
  },
};

// Friends API
export const friendsAPI = {
  searchUsers: async (query: string) => {
    const response = await api.get('/friends/search', { params: { query } });
    return response.data;
  },

  sendFriendRequest: async (recipientId: string) => {
    const response = await api.post('/friends/request', { recipientId });
    return response.data;
  },

  acceptFriendRequest: async (senderId: string) => {
    const response = await api.post('/friends/accept', { senderId });
    return response.data;
  },

  rejectFriendRequest: async (senderId: string) => {
    const response = await api.post('/friends/reject', { senderId });
    return response.data;
  },

  getFriendRequests: async () => {
    const response = await api.get('/friends/requests');
    return response.data;
  },

  getFriends: async (userId: string) => {
    const response = await api.get(`/friends/user/${userId}`);
    return response.data;
  },

  removeFriend: async (friendId: string) => {
    const response = await api.post('/friends/remove', { friendId });
    return response.data;
  },
};

// Comments API
export const commentsAPI = {
  getNearby: async (lat: number, lon: number, radius = 500, requestingUserId?: string) => {
    const params: any = { lat, lon, radius };
    if (requestingUserId) {
      params.requestingUserId = requestingUserId;
    }
    const response = await api.get('/comments', { params });
    return response.data;
  },

  uploadMedia: async (file: { uri: string; type: 'photo' | 'video' }) => {
    const formData = new FormData();
    const nameFromUri = file.uri.split('/').pop();
    const name = nameFromUri || `media-${Date.now()}`;
    const mimeType = file.type === 'photo' ? 'image/jpeg' : 'video/mp4';

    formData.append('file', {
      uri: file.uri,
      name,
      type: mimeType,
    } as any);

    const response = await api.post('/comments/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  create: async (payload: {
    userId: string;
    username: string;
    lat: number;
    lon: number;
    text?: string;
    contentType?: 'text' | 'photo' | 'video';
    mediaUrl?: string | null;
  }) => {
    const response = await api.post('/comments', payload);
    return response.data;
  },
};

export default api;
