/**
 * Reusable Chat Selector Component
 * Allows manual input or selection from dropdown
 */
import { useState, useEffect } from 'react';
import { telegramAPI } from '../services/api';

interface Chat {
  id: string;
  name: string;
  type: string;
}

interface ChatSelectorProps {
  sessionId: number | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function ChatSelector({ sessionId, value, onChange, placeholder }: ChatSelectorProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadChats();
    }
  }, [sessionId]);

  const loadChats = async () => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const data = await telegramAPI.getChats(sessionId);
      setChats(data.chats || []);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectChat = (chat: Chat) => {
    onChange(chat.id);
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder={placeholder || "Enter chat ID or username"}
          className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {sessionId && (
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            ▼
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && chats.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => selectChat(chat)}
              className="w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-0"
            >
              <div className="font-medium">{chat.name}</div>
              <div className="text-xs text-gray-400">
                {chat.type} • {chat.id}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Close dropdown on outside click */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}

