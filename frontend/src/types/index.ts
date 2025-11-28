/**
 * TypeScript type definitions for the application
 */

export interface User {
  id: number;
  username?: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'banned';
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface TelegramSession {
  id: number;
  session_name: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
}

export interface Message {
  id: number;
  telegram_message_id: number;
  chat_id: string;
  chat_name?: string;
  sender_id?: string;
  sender_name?: string;
  content?: string;
  media_type?: string;
  media_path?: string;
  timestamp: string;
}

export interface DownloadTask {
  id: number;
  task_id: string;
  status: string;
  chat_name?: string;
  total_files: number;
  downloaded_files: number;
  progress: number;
  created_at: string;
}

export interface BroadcastRequest {
  session_id: number;
  message: string;
  target_chat_ids: string[];
  delay_min?: number;
  delay_max?: number;
}

