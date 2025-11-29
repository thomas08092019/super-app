import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Search, Archive, Filter, ChevronLeft, ChevronRight, Copy, X, User, ExternalLink, Calendar, Trash2 } from 'lucide-react';
import { dumperAPI, telegramAPI } from '../services/api';
import CustomSelect from '../components/CustomSelect';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function MessageDumpManager() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<number>(0);
  const [chatId, setChatId] = useState('');
  const [search, setSearch] = useState('');
  
  // REMOVED DEFAULT DATES
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [prevScrollHeight, setPrevScrollHeight] = useState(0);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  useEffect(() => {
    telegramAPI.getSessions().then(setSessions);
    dumperAPI.getGroups().then(setGroups);
  }, []);

  const loadMessages = async (reset = false) => {
    setLoading(true);
    try {
        const toUTC = (d: string) => d ? new Date(d).toISOString() : undefined;
        const data = await dumperAPI.getMessages({ 
            session_id: sessionId || undefined, 
            chat_id: chatId, 
            search, 
            page, 
            limit: 20,
            start_date: toUTC(startDate),
            end_date: toUTC(endDate)
        });

        if (data.length === 0) setHasMore(false);
        
        const sorted = [...data].reverse();
        
        if (reset || page === 1) {
            setMessages(sorted);
            setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }, 50);
        } else {
             if (scrollRef.current) setPrevScrollHeight(scrollRef.current.scrollHeight);
             setMessages(prev => [...sorted, ...prev]);
        }
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadMessages(page === 1);
  }, [sessionId, chatId, search, page, startDate, endDate]);

  useLayoutEffect(() => {
    if (scrollRef.current && prevScrollHeight > 0) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop = newScrollHeight - prevScrollHeight;
      setPrevScrollHeight(0);
    }
  }, [messages, prevScrollHeight]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0 && hasMore && !loading) {
        setPage(p => p + 1);
    }
  };

  const handleFilterByGroup = (newChatId: string, newSessionId: number) => {
      setSessionId(newSessionId);
      setChatId(newChatId);
      setPage(1);
      setHasMore(true);
      setSelectedUser(null);
  };

  const handleClearFilter = () => {
      setSessionId(0);
      setChatId('');
      setSearch('');
      setStartDate('');
      setEndDate('');
      setPage(1);
      setHasMore(true);
  };

  const handleClearAllData = async () => {
      if(!confirm("⚠️ WARNING: This will delete ALL dumped messages and tasks history. This action cannot be undone.\n\nAre you sure you want to proceed?")) return;
      try {
          await dumperAPI.clearAll();
          setMessages([]);
          alert("All data cleared successfully.");
          loadMessages(true);
      } catch (e) {
          alert("Failed to clear data.");
      }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];
    return colors[(name?.length || 0) % colors.length];
  };
  
  const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : '??';
  
  const formatTime = (isoString: string) => {
      try {
        return new Date(isoString).toLocaleString('vi-VN', { 
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' 
        });
      } catch { return isoString; }
  };

  return (
    <div className="p-8 h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
        <div className="mb-6 flex-shrink-0">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold flex items-center gap-3"><Archive className="text-purple-500"/> Dumped Messages</h1>
                <div className="flex gap-3">
                    {(sessionId !== 0 || chatId !== '' || startDate || endDate) && (
                        <button onClick={handleClearFilter} className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded transition-colors flex items-center gap-2">
                            <X size={14}/> Clear Filters
                        </button>
                    )}
                    <button onClick={handleClearAllData} className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded transition-colors flex items-center gap-2 shadow-lg shadow-red-900/20">
                        <Trash2 size={16}/> Delete All Data
                    </button>
                </div>
            </div>
            
            <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shadow-lg">
                <div className="flex-1"><CustomSelect value={sessionId} onChange={val => {setSessionId(val); setPage(1);}} options={[{value:0, label:'All Accounts'}, ...sessions.map(s=>({value:s.id, label:s.session_name}))]} placeholder="Account" className="w-full"/></div>
                <div className="flex-1"><CustomSelect value={chatId} onChange={val => {setChatId(val); setPage(1);}} options={[{value:'', label:'All Groups'}, ...groups.map(g=>({value:g.id, label:g.name}))]} placeholder="Group" className="w-full"/></div>
                <div className="flex-1 relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18}/><input type="text" value={search} onChange={e=>{setSearch(e.target.value); setPage(1);}} placeholder="Search content..." className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 pr-4 py-2 outline-none focus:ring-2 focus:ring-purple-500 text-white"/></div>
                <div className="flex gap-2 w-full max-w-md">
                    <div className="flex-1 min-w-0"><input type="datetime-local" value={startDate} onChange={e=>{setStartDate(e.target.value); setPage(1);}} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs text-white outline-none focus:ring-2 focus:ring-purple-500 truncate"/></div>
                    <div className="flex-1 min-w-0"><input type="datetime-local" value={endDate} onChange={e=>{setEndDate(e.target.value); setPage(1);}} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs text-white outline-none focus:ring-2 focus:ring-purple-500 truncate"/></div>
                </div>
            </div>
        </div>

        <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto bg-gray-900/50 rounded-xl border border-gray-700 p-6 custom-scrollbar flex flex-col space-y-4 overflow-x-hidden"
        >
            {loading && page > 1 && <div className="text-center py-2 text-xs text-gray-500">Loading history...</div>}
            {messages.length === 0 && !loading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                    <Archive size={64} className="mb-4"/>
                    <p>No dumped messages found</p>
                </div>
            ) : (
                messages.map((msg, i) => (
                    <motion.div 
                        key={`${msg.id}-${i}`} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-4 group hover:bg-gray-800/30 p-2 rounded-lg transition-colors"
                    >
                        <div 
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 cursor-pointer hover:ring-2 ring-blue-500 transition-all ${getAvatarColor(msg.sender_name || 'U')}`}
                            onClick={() => setSelectedUser(msg)}
                        >
                            {getInitials(msg.sender_name || 'U')}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1 min-w-0">
                                <span 
                                    className="font-bold text-blue-400 truncate cursor-pointer hover:underline max-w-[200px]"
                                    onClick={() => setSelectedUser(msg)}
                                >
                                    {msg.sender_name || 'Unknown'}
                                </span>
                                <button 
                                    onClick={() => handleFilterByGroup(msg.chat_id, msg.session_id)}
                                    className="text-xs text-gray-400 hover:text-white hover:underline flex items-center gap-1 transition-colors bg-gray-800 px-2 py-0.5 rounded truncate max-w-[200px]"
                                    title="Filter by this group"
                                >
                                    in {msg.chat_name} <Filter size={10} className="opacity-50 flex-shrink-0" />
                                </button>
                                <span className="text-xs text-gray-500 ml-auto flex-shrink-0">{formatTime(msg.message_date)}</span>
                            </div>
                            <div className="bg-gray-800 rounded-lg rounded-tl-none p-3 inline-block max-w-full border border-gray-700/50 shadow-sm relative">
                                <p className="whitespace-pre-wrap break-words break-all text-gray-200 text-sm">
                                    {msg.content}
                                </p>
                                {msg.media_type && (
                                    <div className="mt-2 text-xs uppercase bg-black/30 px-2 py-1 rounded w-fit text-blue-300 border border-blue-500/20 font-mono">
                                        [{msg.media_type}]
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))
            )}
        </div>

        <AnimatePresence>
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedUser(null)}>
                    <motion.div initial={{scale:0.9}} animate={{scale:1}} exit={{scale:0.9}} className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="relative h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-lg mb-8"><button onClick={() => setSelectedUser(null)} className="absolute top-2 right-2 p-1 bg-black/20 rounded-full hover:bg-black/40 text-white"><X size={20}/></button><div className={`absolute -bottom-8 left-6 w-20 h-20 rounded-full border-4 border-gray-800 flex items-center justify-center text-2xl font-bold text-white ${getAvatarColor(selectedUser.sender_name)}`}>{getInitials(selectedUser.sender_name)}</div></div>
                        <h2 className="text-xl font-bold text-white px-2">{selectedUser.sender_name}</h2>
                        <div className="flex items-center gap-2 text-gray-400 px-2 mb-4 text-sm"><span>ID: {selectedUser.sender_id}</span><button onClick={() => navigator.clipboard.writeText(selectedUser.sender_id)} className="hover:text-white"><Copy size={14}/></button></div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => navigate('/telegram/osint', { state: { query: selectedUser.sender_id, type: 'profile' } })} className="bg-blue-600 hover:bg-blue-700 py-2 rounded text-white text-sm">View Profile</button>
                            <button onClick={() => window.open(`tg://user?id=${selectedUser.sender_id}`, '_blank')} className="bg-gray-700 hover:bg-gray-600 py-2 rounded text-white text-sm">Open in TG</button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </div>
  );
}