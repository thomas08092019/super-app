import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, Check, Loader2 } from 'lucide-react';
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
  value: string | string[]; // Support single string or array (for multi-select)
  onChange: (value: any) => void;
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

  // Effect để cập nhật text hiển thị trong ô input
  useEffect(() => {
    // Chỉ cập nhật text khi dropdown đang đóng (để không làm phiền lúc user đang gõ tìm kiếm)
    if (isOpen) return;

    if (Array.isArray(value)) {
      // Logic cho Multi-select
      if (value.length > 0) {
        // Tìm tên các chat đã chọn
        const selectedNames = chats
          .filter(c => value.includes(c.id))
          .map(c => c.name);
        
        if (selectedNames.length > 0) {
          setSearchTerm(selectedNames.join(', '));
        } else {
           // Trường hợp có ID nhưng chưa load được thông tin chat (hoặc ID rác)
           setSearchTerm(`${value.length} chats selected`); 
        }
      } else {
        setSearchTerm('');
      }
    } else {
      // Logic cho Single-select
      const chat = chats.find(c => c.id.toString() === value || c.username === value);
      if (chat) {
        setSearchTerm(chat.name);
      } else if (value) {
        setSearchTerm(value);
      } else {
        setSearchTerm('');
      }
    }
  }, [value, chats, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

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
    if (Array.isArray(value)) {
        // Multi-select logic
        let newValue;
        if (value.includes(chat.id)) {
            newValue = value.filter(id => id !== chat.id);
        } else {
            newValue = [...value, chat.id];
        }
        onChange(newValue);
        // Giữ dropdown mở để chọn tiếp
    } else {
        // Single-select logic
        setSearchTerm(chat.name);
        onChange(chat.id);
        setIsOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setSearchTerm(text);
    setIsOpen(true);
    // Nếu là single select, cho phép nhập tay giá trị (ví dụ nhập ID trực tiếp)
    if (!Array.isArray(value)) onChange(text); 
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchTerm('');
    onChange(Array.isArray(value) ? [] : '');
    // Không đóng dropdown để user có thể chọn lại ngay
  };

  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    chat.id.toString().includes(searchTerm) ||
    (chat.username && chat.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isSelected = (chatId: string) => {
      if (Array.isArray(value)) return value.includes(chatId);
      return value === chatId;
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative flex items-center">
        <div className="absolute left-3 text-gray-400 pointer-events-none">
            {loading ? <Loader2 size={16} className="animate-spin text-blue-500" /> : <Search size={16} />}
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || "Search chat name, @username or ID..."}
          className="w-full pl-10 pr-16 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 truncate text-white placeholder-gray-500"
        />
        
        <div className="absolute right-2 flex items-center gap-1">
            {((Array.isArray(value) && value.length > 0) || (!Array.isArray(value) && value)) && (
                <button 
                    onClick={clearSelection}
                    className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
                    title="Clear selection"
                >
                    <X size={14} />
                </button>
            )}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
                <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
          {loading && filteredChats.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Loading chats...
              </div>
          ) : filteredChats.length > 0 ? (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => handleSelect(chat)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0 flex justify-between items-center group ${isSelected(chat.id) ? 'bg-blue-900/20' : ''}`}
              >
                <div className="overflow-hidden min-w-0 flex-1 mr-3">
                  <div className="flex items-baseline gap-2">
                      <span className={`font-medium truncate ${isSelected(chat.id) ? 'text-blue-400' : 'text-gray-200'}`}>
                        {chat.name}
                      </span>
                      {chat.username && (
                          <span className="text-xs text-blue-400/70 truncate">@{chat.username}</span>
                      )}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span className="bg-gray-700/50 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider text-gray-400 border border-gray-600/50">{chat.type}</span>
                    <span className="truncate opacity-70">{chat.id}</span>
                    {chat.members_count && <span className="opacity-70">• {chat.members_count.toLocaleString()} mems</span>}
                  </div>
                </div>
                {isSelected(chat.id) && <Check size={16} className="text-blue-400 flex-shrink-0" />}
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
                {searchTerm ? "No chats found matching your search" : "Start typing to search..."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}