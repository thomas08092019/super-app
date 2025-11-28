import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; // IMPORT THIS
import { motion } from 'framer-motion';
import { Search, User, Users, Shield, AlertCircle } from 'lucide-react';
import { telegramAPI } from '../services/api';
import type { TelegramSession } from '../types';

export default function OSINT() {
  const location = useLocation(); // USE HOOK
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [searchType, setSearchType] = useState<'profile' | 'group'>('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  // AUTO SEARCH EFFECT
  useEffect(() => {
    if (location.state && sessions.length > 0) {
        const { query, type } = location.state as { query: string, type: 'profile' | 'group' };
        if (query) {
            setSearchQuery(query);
            setSearchType(type || 'profile');
            // Auto select first session if none selected
            if (!sessionId) setSessionId(sessions[0].id);
            
            // Only trigger if we have a session
            if (sessionId || sessions.length > 0) {
                // Short timeout to allow state updates
                setTimeout(() => {
                    handleSearch(query, type, sessionId || sessions[0].id);
                }, 100);
            }
        }
    }
  }, [location.state, sessions]); // Run when sessions load

  const loadSessions = async () => {
    try {
      const data = await telegramAPI.getSessions();
      setSessions(data);
      if (data.length > 0 && !sessionId) {
        setSessionId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleSearch = async (query = searchQuery, type = searchType, session = sessionId) => {
    if (!session || !query) {
      if (!location.state) alert('Please select a session and enter a search query');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      let data;
      if (type === 'profile') {
        data = await telegramAPI.lookupProfile(session, query);
      } else {
        data = await telegramAPI.lookupGroup(session, query);
      }
      
      if (data.error) {
          setError(data.error);
      } else {
          setResult(data);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Search failed. Please check the ID/Username.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      {/* ... (Render code remains the same as previous) ... */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Search className="text-blue-500" /> OSINT Tools
        </h1>
        <p className="text-gray-400">Lookup Telegram profiles and groups</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 h-fit">
             <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Telegram Session</label>
                    <select value={sessionId || ''} onChange={(e) => setSessionId(Number(e.target.value))} className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {sessions.map((s) => <option key={s.id} value={s.id}>{s.session_name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Search Type</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setSearchType('profile')} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${searchType==='profile' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}><User size={20} /> Profile</button>
                        <button onClick={() => setSearchType('group')} className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${searchType==='group' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}><Users size={20} /> Group</button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">{searchType === 'profile' ? 'Username or Phone' : 'Group Link or Username'}</label>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={searchType === 'profile' ? '@username or +1234567890' : '@groupname or t.me/groupname'} className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={() => handleSearch()} disabled={loading || !sessionId || !searchQuery} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Search size={20} /> Search</>}
                </button>
             </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          {error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-400">
                <AlertCircle size={48} className="mb-2" />
                <p className="text-center px-4">{error}</p>
            </div>
          ) : result ? (
            searchType === 'profile' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-700">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
                    {result.first_name?.[0] || '?'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{result.first_name} {result.last_name}</h3>
                    {result.username && <p className="text-gray-400">@{result.username}</p>}
                  </div>
                </div>
                <div className="space-y-3">
                  {result.user_id && <div><p className="text-sm text-gray-400">User ID</p><p className="font-mono">{result.user_id}</p></div>}
                  {result.phone && <div><p className="text-sm text-gray-400">Phone</p><p>{result.phone}</p></div>}
                  {result.bio && <div><p className="text-sm text-gray-400">Bio</p><p className="text-sm">{result.bio}</p></div>}
                  {result.dc_id && <div><p className="text-sm text-gray-400">Data Center</p><p>DC{result.dc_id}</p></div>}
                  <div><p className="text-sm text-gray-400">Common Chats</p><p>{result.common_chats_count || 0}</p></div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                 <div className="flex items-center gap-4 pb-4 border-b border-gray-700">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center"><Users size={32} /></div>
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        {result.title}
                        {result.is_verified && <Shield size={20} className="text-blue-500" />}
                    </h3>
                    {result.username && <p className="text-gray-400">@{result.username}</p>}
                  </div>
                </div>
                <div className="space-y-3">
                    <div><p className="text-sm text-gray-400">Chat ID</p><p className="font-mono">{result.chat_id}</p></div>
                    <div><p className="text-sm text-gray-400">Members</p><p>{result.member_count?.toLocaleString() || 'N/A'}</p></div>
                    {result.description && <div><p className="text-sm text-gray-400">Description</p><p className="text-sm">{result.description}</p></div>}
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <Search size={64} className="mx-auto mb-4 opacity-50" />
                <p>No results yet</p>
                <p className="text-sm mt-2">Enter a query and click Search</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}