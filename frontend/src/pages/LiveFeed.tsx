import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Radio, Search, Filter, ChevronDown, MessageSquare, X, User, Copy, ExternalLink, Users
} from 'lucide-react';
import { telegramAPI } from '../services/api';
import type { Message, TelegramSession } from '../types';

interface GroupOption {
  id: string;
  name: string;
}

export default function LiveFeed() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [sessionId, setSessionId] = useState<number>(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const [selectedUser, setSelectedUser] = useState<Message | null>(null);
  
  const ws = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [prevScrollHeight, setPrevScrollHeight] = useState(0);
  
  const selectedGroupRef = useRef(selectedGroup);
  const sessionIdRef = useRef(sessionId);

  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
    sessionIdRef.current = sessionId;
  }, [selectedGroup, sessionId]);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    setMessages([]);
    setPage(1);
    setHasMore(true);
    loadGroups();
    fetchMessages(1, true);
    connectAllWebSockets();
    return () => { if (ws.current) ws.current.close(); };
  }, [sessionId]);

  useLayoutEffect(() => {
    if (scrollRef.current && prevScrollHeight > 0) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop += (newScrollHeight - prevScrollHeight);
      setPrevScrollHeight(0);
    } else if (scrollRef.current && page === 1 && !loading) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, prevScrollHeight, loading, page]);

  const loadSessions = async () => {
    try {
      const data = await telegramAPI.getSessions();
      setSessions(data);
    } catch (error) { console.error(error); }
  };

  const loadGroups = async () => {
    try {
      const idToLoad = sessionId === 0 ? undefined : sessionId;
      const data = await telegramAPI.getGroupsHistory(idToLoad as number);
      setGroups(data);
    } catch (error) { console.error(error); }
  };

  const fetchMessages = async (pageNum: number, reset: boolean = false, overrideParams: { chat_id?: string } = {}) => {
    setLoading(true);
    try {
      const chatFilter = overrideParams.chat_id !== undefined ? overrideParams.chat_id : selectedGroup;
      const targetSession = sessionId === 0 ? undefined : sessionId;

      const data = await telegramAPI.getMessages({
        session_id: targetSession as number,
        page: pageNum,
        limit: 20,
        chat_id: chatFilter || undefined,
        search: searchQuery || undefined,
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined
      });

      if (data.length < 20) setHasMore(false);
      const sorted = [...data].reverse();
      
      if (reset) {
        setMessages(sorted);
      } else {
        if (scrollRef.current) setPrevScrollHeight(scrollRef.current.scrollHeight);
        setMessages(prev => [...sorted, ...prev]);
      }
    } catch (error) { console.error(error); } 
    finally { setLoading(false); }
  };

  const connectAllWebSockets = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    if (ws.current) ws.current.close();
    const WS_URL = API_URL.replace('http', 'ws') + `/telegram/ws/feed/${sessionId}`;
    
    ws.current = new WebSocket(WS_URL);
    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        const msg = data.message;
        const msgSessionId = data.session_id;
        const isSessionMatch = sessionIdRef.current === 0 || sessionIdRef.current === msgSessionId;
        const isGroupMatch = !selectedGroupRef.current || msg.chat_id === selectedGroupRef.current;

        if (isSessionMatch && isGroupMatch) {
          setMessages(prev => [...prev, msg]);
          if (scrollRef.current) {
             const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
             if (scrollHeight - scrollTop - clientHeight < 100) {
                 setTimeout(() => { if(scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);
             }
          }
        }
      }
    };
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && hasMore && !loading) {
        loadMore();
    }
  };

  const handleSearch = () => { setPage(1); setHasMore(true); fetchMessages(1, true); };
  const loadMore = () => { const nextPage = page + 1; setPage(nextPage); fetchMessages(nextPage, false); };
  const handleFilterByGroup = (chatId: string) => { setSelectedGroup(chatId); setPage(1); setHasMore(true); fetchMessages(1, true, { chat_id: chatId }); };
  const clearGroupFilter = () => { setSelectedGroup(''); setPage(1); setHasMore(true); fetchMessages(1, true, { chat_id: '' }); };

  const handleViewProfile = (user: Message) => {
    const query = user.sender_username ? user.sender_username : user.sender_id;
    if (query) {
      navigate('/telegram/osint', { state: { query, type: 'profile' } });
    }
  };

  const handleViewGroup = (user: Message) => {
    const query = user.chat_username ? user.chat_username : user.chat_id;
    if (query) {
        navigate('/telegram/osint', { state: { query, type: 'group' } });
    }
  };

  const handleOpenInTG = (user: Message) => {
    if (user.sender_username) {
        window.open(`https://t.me/${user.sender_username}`, '_blank');
    } else if (user.sender_id) {
        window.open(`tg://user?id=${user.sender_id}`, '_blank');
    }
  };

  const handleOpenGroupInTG = (user: Message) => {
    if (user.chat_username) {
        window.open(`https://t.me/${user.chat_username}`, '_blank');
    } else {
        alert('Cannot open private group directly without a username link.');
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : '??';

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    } catch (e) { return isoString; }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* Sidebar Filters */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 p-4 flex flex-col gap-4 overflow-y-auto">
        <h2 className="text-xl font-bold flex items-center gap-2"><Filter size={20} /> Filters</h2>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Account</label>
          <div className="relative">
            <select className="w-full bg-gray-700 rounded-lg p-2 appearance-none outline-none" value={sessionId} onChange={(e) => setSessionId(Number(e.target.value))}>
              <option value={0}>All Accounts</option>
              {sessions.map(s => (<option key={s.id} value={s.id}>{s.session_name}</option>))}
            </select>
            <ChevronDown className="absolute right-2 top-3 pointer-events-none" size={16} />
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Filter by Group</label>
          <div className="relative">
            <select className="w-full bg-gray-700 rounded-lg p-2 appearance-none outline-none" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
              <option value="">All Groups</option>
              {groups.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
            </select>
            <ChevronDown className="absolute right-2 top-3 pointer-events-none" size={16} />
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-1 block">Search Content</label>
          <div className="relative">
            <input type="text" className="w-full bg-gray-700 rounded-lg p-2 pl-8 outline-none" placeholder="Keywords..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
          </div>
        </div>
        <button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg font-bold mt-2">Apply Filters</button>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        <div className="h-16 border-b border-gray-700 flex items-center justify-between px-6 bg-gray-800/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <Radio className={connected ? "text-green-500 animate-pulse" : "text-gray-500"} />
            <div>
              <h1 className="font-bold text-lg">Live Feed</h1>
              <p className="text-xs text-gray-400">{connected ? "Real-time updates active" : "Connecting..."}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {selectedGroup && (
              <div className="flex items-center gap-2 bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-sm">
                <span>Filtering by Group</span>
                <button onClick={clearGroupFilter} className="hover:text-white"><X size={14} /></button>
              </div>
            )}
            <div className="text-xs text-gray-500">{messages.length} loaded</div>
          </div>
        </div>

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-900/95">
          {loading && page > 1 && (<div className="text-center py-2"><span className="text-xs text-blue-400">Loading older messages...</span></div>)}
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500"><MessageSquare size={48} className="mb-2 opacity-50" /><p>No messages found</p></div>
          )}

          {messages.map((msg, idx) => (
            <motion.div key={`${msg.id}-${idx}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 group hover:bg-gray-800/30 p-2 rounded-lg transition-colors">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 cursor-pointer hover:ring-2 ring-blue-500 transition-all ${getAvatarColor(msg.sender_name || 'U')}`}
                onClick={() => setSelectedUser(msg)}
              >
                {getInitials(msg.sender_name || 'U')}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-bold text-blue-300 truncate cursor-pointer hover:underline" onClick={() => setSelectedUser(msg)}>
                    {msg.sender_name || 'Unknown'}
                  </span>
                  
                  <button 
                    onClick={() => handleFilterByGroup(msg.chat_id)}
                    className="text-xs text-gray-400 hover:text-white hover:underline flex items-center gap-1 transition-colors bg-gray-800 px-2 py-0.5 rounded"
                    title="Click to filter by this group"
                  >
                    in {msg.chat_name} <Filter size={10} className="opacity-50" />
                  </button>

                  <span className="text-xs text-gray-500 ml-auto">{formatTime(msg.timestamp)}</span>
                </div>

                <div className="bg-gray-800 rounded-lg rounded-tl-none p-3 inline-block max-w-3xl border border-gray-700/50">
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  {msg.media_type && (
                    <div className="mt-2 text-xs uppercase bg-black/30 px-2 py-1 rounded w-fit text-blue-300 border border-blue-500/20">
                      [{msg.media_type}]
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-xl max-w-md w-full border border-gray-700 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative h-24 bg-gradient-to-r from-blue-600 to-purple-600">
                <button onClick={() => setSelectedUser(null)} className="absolute top-2 right-2 p-1 bg-black/20 rounded-full hover:bg-black/40 transition-colors text-white">
                  <X size={20} />
                </button>
              </div>
              
              <div className="px-6 pb-6 relative">
                <div className={`w-20 h-20 rounded-full border-4 border-gray-800 flex items-center justify-center text-2xl font-bold -mt-10 mb-4 bg-gray-700 text-white ${getAvatarColor(selectedUser.sender_name || 'U')}`}>
                  {getInitials(selectedUser.sender_name || 'U')}
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-1">{selectedUser.sender_name || 'Unknown User'}</h2>
                <div className="flex items-center gap-2 text-gray-400 mb-6">
                  <span>ID: {selectedUser.sender_id}</span>
                  <button onClick={() => navigator.clipboard.writeText(selectedUser.sender_id || '')} className="hover:text-blue-400" title="Copy ID">
                    <Copy size={14} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Group Context Section */}
                  <div className="p-3 bg-gray-700/30 rounded-lg">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Group Context</p>
                    <div className="flex justify-between items-start">
                        <div className="overflow-hidden mr-2">
                            <span className="font-medium text-blue-300 truncate block">{selectedUser.chat_name}</span>
                            <p className="text-xs text-gray-500 mt-0.5">ID: {selectedUser.chat_id}</p>
                        </div>
                        <button onClick={() => {handleFilterByGroup(selectedUser.chat_id); setSelectedUser(null);}} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors whitespace-nowrap">
                            Filter
                        </button>
                    </div>
                    
                    <div className="flex gap-2 mt-3 pt-2 border-t border-gray-700/50">
                        <button 
                            onClick={() => handleViewGroup(selectedUser)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded text-xs font-medium transition-colors"
                        >
                            <Users size={14} /> View Group
                        </button>
                        <button 
                            onClick={() => handleOpenGroupInTG(selectedUser)}
                            disabled={!selectedUser.chat_username}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors ${selectedUser.chat_username ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                            title={selectedUser.chat_username ? "Open in Telegram" : "No username available"}
                        >
                            <ExternalLink size={14} /> Open Group
                        </button>
                    </div>
                  </div>

                  {/* User Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => handleViewProfile(selectedUser)}
                        className="flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
                    >
                        <User size={16} /> View Profile
                    </button>
                    <button 
                        onClick={() => handleOpenInTG(selectedUser)}
                        className="flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-medium text-gray-300"
                    >
                        <ExternalLink size={16} /> Open User
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}