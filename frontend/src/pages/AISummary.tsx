import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Sparkles, Calendar, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { aiAPI, telegramAPI } from '../services/api';
import type { TelegramSession } from '../types';
import ChatSelector from '../components/ChatSelector';
import CustomSelect from '../components/CustomSelect';

export default function AISummary() {
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [chatId, setChatId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

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

  const handleGenerateSummary = async () => {
    if (!sessionId) {
      alert('Please select a session');
      return;
    }

    setLoading(true);
    try {
      // Fix time format
      const toUTC = (d: string) => d ? new Date(d).toISOString() : undefined;
      
      const result = await aiAPI.summarize({
        session_id: sessionId,
        chat_id: chatId || null,
        start_time: toUTC(startTime),
        end_time: toUTC(endTime),
      });
      setSummary(result.summary);
      setMessageCount(result.message_count);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  };

  const sessionOptions = sessions.map(s => ({ value: s.id, label: s.session_name }));

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><Bot className="text-purple-500" /> AI Summary</h1>
        <p className="text-gray-400">Generate context-aware summaries with Google Gemini</p>
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 h-fit">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-300 mb-2">Telegram Session</label><CustomSelect value={sessionId || ''} onChange={(val) => setSessionId(val)} options={sessionOptions} placeholder="Select Account" /></div>
            <div><label className="block text-sm font-medium text-gray-300 mb-2">Chat (Optional)</label><ChatSelector sessionId={sessionId} value={chatId} onChange={setChatId} placeholder="Leave empty for all chats" /></div>
            <div><label className="block text-sm font-medium text-gray-300 mb-2"><Calendar size={16} className="inline mr-2" /> Start Time</label><input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" /></div>
            <div><label className="block text-sm font-medium text-gray-300 mb-2"><Calendar size={16} className="inline mr-2" /> End Time</label><input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" /></div>
            <button onClick={handleGenerateSummary} disabled={loading || !sessionId} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">{loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Sparkles size={20} /> Generate Summary</>}</button>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Summary Result</h2>
          {summary ? (<div><div className="mb-4 px-4 py-2 bg-blue-500/20 rounded-lg"><p className="text-sm text-blue-300">Analyzed {messageCount} messages</p></div><div className="prose prose-invert max-w-none"><ReactMarkdown>{summary}</ReactMarkdown></div></div>) : (<div className="flex items-center justify-center h-64 text-gray-400"><div className="text-center"><Bot size={64} className="mx-auto mb-4 opacity-50" /><p>No summary generated yet</p></div></div>)}
        </motion.div>
      </div>
    </div>
  );
}