import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { telegramAPI } from '../services/api';

interface Chat {
  id: string;
  name: string;
  type: string;
  username?: string;
  members_count?: number;
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
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) {
      loadChats();
    } else {
      setChats([]);
    }
  }, [sessionId]);

  useEffect(() => {
    const chat = chats.find(c => c.id.toString() === value || c.username === value);
    if (chat) {
      setSearchTerm(chat.name);
    } else if (!isOpen) {
      setSearchTerm(value);
    }
  }, [value, chats, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        const chat = chats.find(c => c.id.toString() === value);
        if (chat) setSearchTerm(chat.name);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef, value, chats]);

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

  const handleSelect = (chat: Chat) => {
    setSearchTerm(chat.name);
    onChange(chat.id);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setSearchTerm(text);
    setIsOpen(true);
    onChange(text);
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchTerm('');
    onChange('');
    setIsOpen(false);
  };

  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    chat.id.toString().includes(searchTerm) ||
    (chat.username && chat.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative flex items-center">
        <div className="absolute left-3 text-gray-400 pointer-events-none">
            {loading ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : <Search size={16} />}
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || "Search chat name, username or ID..."}
          className="w-full pl-10 pr-16 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
        />
        
        <div className="absolute right-2 flex items-center gap-1">
            {value && (
                <button 
                    onClick={clearSelection}
                    className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                    <X size={14} />
                </button>
            )}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
                <ChevronDown size={16} />
            </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-y-auto custom-scrollbar">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => handleSelect(chat)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0 flex justify-between items-center group ${value === chat.id.toString() ? 'bg-blue-600/10' : ''}`}
              >
                <div className="overflow-hidden min-w-0 flex-1 mr-3">
                  <div className={`font-medium truncate ${value === chat.id.toString() ? 'text-blue-400' : 'text-gray-200'}`}>
                    {chat.name}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span className="bg-gray-700/50 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider text-gray-400 border border-gray-600/50">{chat.type}</span>
                    <span className="truncate opacity-70">{chat.id}</span>
                    {chat.username && <span className="truncate text-blue-400/70">@{chat.username}</span>}
                  </div>
                </div>
                {value === chat.id.toString() && <Check size={16} className="text-blue-400 flex-shrink-0" />}
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
                {searchTerm ? "No chats found matching your search" : "Type to search or load chats"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}