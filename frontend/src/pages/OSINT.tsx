/**
 * OSINT Tools page - Profile and group lookup
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, User, Users, Shield } from 'lucide-react';
import { telegramAPI } from '../services/api';
import type { TelegramSession } from '../types';

export default function OSINT() {
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [searchType, setSearchType] = useState<'profile' | 'group'>('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await telegramAPI.getSessions();
      setSessions(data);
      if (data.length > 0) {
        setSessionId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleSearch = async () => {
    if (!sessionId || !searchQuery) {
      alert('Please select a session and enter a search query');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let data;
      if (searchType === 'profile') {
        data = await telegramAPI.lookupProfile(sessionId, searchQuery);
      } else {
        data = await telegramAPI.lookupGroup(sessionId, searchQuery);
      }
      setResult(data);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Search className="text-blue-500" />
          OSINT Tools
        </h1>
        <p className="text-gray-400">Lookup Telegram profiles and groups</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Search panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 h-fit"
        >
          <h2 className="text-xl font-semibold mb-4">Search</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Telegram Session
              </label>
              <select
                value={sessionId || ''}
                onChange={(e) => setSessionId(Number(e.target.value))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.session_name} - {session.phone_number}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSearchType('profile')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                    searchType === 'profile'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <User size={20} />
                  Profile
                </button>
                <button
                  onClick={() => setSearchType('group')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                    searchType === 'group'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <Users size={20} />
                  Group
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {searchType === 'profile' ? 'Username or Phone' : 'Group Link or Username'}
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  searchType === 'profile'
                    ? '@username or +1234567890'
                    : '@groupname or t.me/groupname'
                }
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleSearch}
              disabled={loading || !sessionId || !searchQuery}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Search size={20} />
                  Search
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Results panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700"
        >
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          {result ? (
            searchType === 'profile' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-700">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold">
                    {result.first_name?.[0] || '?'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      {result.first_name} {result.last_name}
                    </h3>
                    {result.username && (
                      <p className="text-gray-400">@{result.username}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {result.user_id && (
                    <div>
                      <p className="text-sm text-gray-400">User ID</p>
                      <p className="font-mono">{result.user_id}</p>
                    </div>
                  )}
                  {result.phone && (
                    <div>
                      <p className="text-sm text-gray-400">Phone</p>
                      <p>{result.phone}</p>
                    </div>
                  )}
                  {result.bio && (
                    <div>
                      <p className="text-sm text-gray-400">Bio</p>
                      <p className="text-sm">{result.bio}</p>
                    </div>
                  )}
                  {result.dc_id && (
                    <div>
                      <p className="text-sm text-gray-400">Data Center</p>
                      <p>DC{result.dc_id}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-400">Common Chats</p>
                    <p>{result.common_chats_count || 0}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-700">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
                    <Users size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      {result.title}
                      {result.is_verified && (
                        <Shield size={20} className="text-blue-500" />
                      )}
                    </h3>
                    {result.username && (
                      <p className="text-gray-400">@{result.username}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Chat ID</p>
                    <p className="font-mono">{result.chat_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Members</p>
                    <p>{result.member_count?.toLocaleString() || 'N/A'}</p>
                  </div>
                  {result.description && (
                    <div>
                      <p className="text-sm text-gray-400">Description</p>
                      <p className="text-sm">{result.description}</p>
                    </div>
                  )}
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

