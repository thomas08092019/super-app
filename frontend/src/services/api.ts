import axios from 'axios';
import type { LoginRequest, TokenResponse, User, TelegramSession, Message } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use(config => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
}, error => Promise.reject(error));

api.interceptors.response.use(response => response, error => {
    if (error.response?.status === 401) { localStorage.removeItem('access_token'); localStorage.removeItem('user'); window.location.href = '/login'; }
    return Promise.reject(error);
});

export const authAPI = {
  login: async (creds: LoginRequest): Promise<TokenResponse> => (await api.post('/auth/login', creds)).data,
  forgotPassword: async () => (await api.post('/auth/forgot-password')).data,
};

export const adminAPI = {
  getUsers: async (): Promise<User[]> => (await api.get('/admin/users')).data,
  getDashboardStats: async () => (await api.get('/admin/stats')).data,
  updateUserStatus: async (id: number, status: string): Promise<User> => (await api.patch(`/admin/users/${id}/status`, { status })).data,
  resetPassword: async (id: number, pass: string) => (await api.post(`/admin/users/${id}/reset-password`, { new_password: pass })).data,
  deleteUser: async (id: number) => (await api.delete(`/admin/users/${id}`)).data,
};

export const telegramAPI = {
  sendCode: async (data: any) => (await api.post('/telegram/login/send-code', data)).data,
  verifyCode: async (data: any) => (await api.post('/telegram/login/verify-code', data)).data,
  verify2FA: async (data: any) => (await api.post('/telegram/login/verify-2fa', data)).data,
  getSessions: async (): Promise<TelegramSession[]> => (await api.get('/telegram/sessions')).data,
  getChats: async (id: number) => (await api.get(`/telegram/sessions/${id}/chats`)).data,
  createSession: async (data: any): Promise<TelegramSession> => (await api.post('/telegram/sessions', data)).data,
  deleteSession: async (id: number) => (await api.delete(`/telegram/sessions/${id}`)).data,
  lookupProfile: async (sid: number, q: string) => (await api.get(`/telegram/profile/${q}`, { params: { session_id: sid } })).data,
  lookupGroup: async (sid: number, q: string) => (await api.get(`/telegram/group/${q}`, { params: { session_id: sid } })).data,
  getMessages: async (params: any): Promise<Message[]> => (await api.get('/telegram/messages', { params })).data,
  getGroupsHistory: async (sid: number) => (await api.get('/telegram/groups', { params: { session_id: sid } })).data
};

export const aiAPI = { summarize: async (data: any) => (await api.post('/ai/summarize', data)).data };

export const downloaderAPI = {
  startDownload: async (data: any) => (await api.post('/downloader/start', data)).data,
  getTasks: async () => (await api.get('/downloader/tasks')).data,
  getTaskStatus: async (id: string) => (await api.get(`/downloader/tasks/${id}/status`)).data,
  cancelTask: async (id: string) => (await api.delete(`/downloader/tasks/${id}`)).data,
};

export const broadcasterAPI = {
  send: async (data: any) => (await api.post('/broadcast/send', data)).data,
  getStatus: async (id: string) => (await api.get(`/broadcast/status/${id}`)).data,
};

export const storageAPI = {
  listFiles: async (params: any) => (await api.get('/storage/files', { params })).data,
  deleteFile: async (id: number) => (await api.delete(`/storage/files/${id}`)).data,
  deleteFilesBatch: async (ids: number[]) => (await api.delete('/storage/files/batch', { data: ids })).data,
  deleteAllFiles: async () => (await api.delete('/storage/files/all')).data,
};

export const dumperAPI = {
  startDump: async (data: any) => (await api.post('/dumper/start', data)).data,
  getStatus: async (id: string) => (await api.get(`/dumper/status/${id}`)).data,
  stopDump: async (id: string) => (await api.delete(`/dumper/stop/${id}`)).data,
  getMessages: async (params: any) => (await api.get('/dumper/messages', { params })).data,
  getGroups: async () => (await api.get('/dumper/groups')).data
};

export default api;