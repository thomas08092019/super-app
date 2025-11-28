/**
 * API service for backend communication
 */
import axios from 'axios';
import type { LoginRequest, TokenResponse, User, TelegramSession } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<TokenResponse> => {
    const response = await api.post<TokenResponse>('/auth/login', credentials);
    return response.data;
  },
  
  forgotPassword: async () => {
    const response = await api.post('/auth/forgot-password');
    return response.data;
  },
};

// Admin
export const adminAPI = {
  getUsers: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/admin/users');
    return response.data;
  },
  
  updateUserStatus: async (userId: number, status: 'active' | 'banned'): Promise<User> => {
    const response = await api.patch<User>(`/admin/users/${userId}/status`, { status });
    return response.data;
  },
  
  resetPassword: async (userId: number, newPassword: string) => {
    const response = await api.post(`/admin/users/${userId}/reset-password`, {
      new_password: newPassword,
    });
    return response.data;
  },
  
  deleteUser: async (userId: number) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
  },
};

// Telegram
export const telegramAPI = {
  sendCode: async (data: any) => {
    const response = await api.post('/telegram/login/send-code', data);
    return response.data;
  },
  
  verifyCode: async (data: any) => {
    const response = await api.post('/telegram/login/verify-code', data);
    return response.data;
  },
  
  verify2FA: async (data: any) => {
    const response = await api.post('/telegram/login/verify-2fa', data);
    return response.data;
  },
  
  getSessions: async (): Promise<TelegramSession[]> => {
    const response = await api.get<TelegramSession[]>('/telegram/sessions');
    return response.data;
  },
  
  getChats: async (sessionId: number) => {
    const response = await api.get(`/telegram/sessions/${sessionId}/chats`);
    return response.data;
  },
  
  createSession: async (data: any): Promise<TelegramSession> => {
    const response = await api.post<TelegramSession>('/telegram/sessions', data);
    return response.data;
  },
  
  deleteSession: async (sessionId: number) => {
    const response = await api.delete(`/telegram/sessions/${sessionId}`);
    return response.data;
  },
  
  lookupProfile: async (sessionId: number, usernameOrPhone: string) => {
    const response = await api.get(`/telegram/profile/${usernameOrPhone}`, {
      params: { session_id: sessionId },
    });
    return response.data;
  },
  
  lookupGroup: async (sessionId: number, groupLink: string) => {
    const response = await api.get(`/telegram/group/${groupLink}`, {
      params: { session_id: sessionId },
    });
    return response.data;
  },
};

// AI Summary
export const aiAPI = {
  summarize: async (data: any) => {
    const response = await api.post('/ai/summarize', data);
    return response.data;
  },
};

// Downloader
export const downloaderAPI = {
  startDownload: async (data: any) => {
    const response = await api.post('/downloader/start', data);
    return response.data;
  },
  
  getTasks: async () => {
    const response = await api.get('/downloader/tasks');
    return response.data;
  },
  
  getTaskStatus: async (taskId: string) => {
    const response = await api.get(`/downloader/tasks/${taskId}/status`);
    return response.data;
  },
  
  cancelTask: async (taskId: string) => {
    const response = await api.delete(`/downloader/tasks/${taskId}`);
    return response.data;
  },
};

// Broadcaster
export const broadcasterAPI = {
  send: async (data: any) => {
    const response = await api.post('/broadcast/send', data);
    return response.data;
  },
  
  getStatus: async (taskId: string) => {
    const response = await api.get(`/broadcast/status/${taskId}`);
    return response.data;
  },
};

export default api;

