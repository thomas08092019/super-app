import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Sparkles, Calendar, ChevronDown, Clock, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { aiAPI, telegramAPI } from '../services/api';
import type { TelegramSession } from '../types';
import ChatSelector from '../components/ChatSelector';
import CustomSelect from '../components/CustomSelect';

export default function AISummary() {
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [chatIds, setChatIds] = useState<string[]>([]);
  
  // Auto-fill time: Today 00:00 -> Now
  const now = new Date();
  const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  const todayStart = new Date(now.setHours(0,0,0,0) - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  
  const [startTime, setStartTime] = useState(todayStart);
  const [endTime, setEndTime] = useState(localNow);
  
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  
  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadSessions();
    loadHistory();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await telegramAPI.getSessions();
      setSessions(data);
      if (data.length > 0) setSessionId(data[0].id);
    } catch (error) { console.error(error); }
  };

  const loadHistory = async () => {
    try {
        const data = await aiAPI.getHistory(1);
        setHistory(data);
    } catch (e) { console.error(e); }
  };

  const handleGenerateSummary = async () => {
    if (!sessionId) { alert('Please select a session'); return; }
    setLoading(true);
    try {
      const toUTC = (d: string) => d ? new Date(d).toISOString() : undefined;
      const result = await aiAPI.summarize({
        session_id: sessionId,
        chat_ids: chatIds,
        start_time: toUTC(startTime),
        end_time: toUTC(endTime),
      });
      setSummary(result.summary);
      setMessageCount(result.message_count);
      loadHistory(); // Refresh history
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to generate summary');
    } finally { setLoading(false); }
  };

  const sessionOptions = sessions.map(s => ({ value: s.id, label: s.session_name }));

  return (
    <div className="p-8 h-full flex flex-col overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><Bot className="text-purple-500" /> AI Summary</h1>
        <p className="text-gray-400">Real-time Telegram summarization with Gemini</p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Config Panel */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 h-fit overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-semibold">Configuration</h2>
             <button onClick={() => setShowHistory(!showHistory)} className="text-sm text-blue-400 hover:underline flex items-center gap-1">
                 <Clock size={14} /> History
             </button>
          </div>

          {showHistory ? (
             <div className="space-y-3">
                 {history.map(h => (
                     <div key={h.id} onClick={() => {setSummary(h.summary_content); setMessageCount(h.message_count);}} className="p-3 bg-gray-900/50 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors border border-gray-600/30">
                         <div className="flex justify-between text-xs text-gray-400 mb-1">
                             <span>{new Date(h.created_at).toLocaleDateString()}</span>
                             <span>{h.message_count} msgs</span>
                         </div>
                         <div className="text-sm font-medium text-gray-200 truncate">{h.summary_content.substring(0, 50)}...</div>
                     </div>
                 ))}
                 <button onClick={() => setShowHistory(false)} className="w-full text-center text-xs text-gray-500 mt-2 hover:text-white">Back to Config</button>
             </div>
          ) : (
            <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-300 mb-2">Session</label><CustomSelect value={sessionId||''} onChange={setSessionId} options={sessionOptions} placeholder="Select Account" /></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-2">Target Chats</label><ChatSelector sessionId={sessionId} value={chatIds} onChange={setChatIds} placeholder="Select chats..." /></div>
                <div className="grid grid-cols-1 gap-3">
                    <div><label className="block text-xs font-medium text-gray-400 mb-1">Start Time</label><input type="datetime-local" value={startTime} onChange={e=>setStartTime(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs text-white"/></div>
                    <div><label className="block text-xs font-medium text-gray-400 mb-1">End Time</label><input type="datetime-local" value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs text-white"/></div>
                </div>
                <button onClick={handleGenerateSummary} disabled={loading || !sessionId} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Sparkles size={20} /> Generate Summary</>}
                </button>
            </div>
          )}
        </motion.div>

        {/* Result Panel */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="xl:col-span-2 bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 flex flex-col h-full min-h-0">
          <h2 className="text-xl font-semibold mb-4 flex-shrink-0">Summary Result</h2>
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-900/30 rounded-lg p-4 border border-gray-700/50">
            {summary ? (
                <div className="prose prose-invert max-w-none">
                    <div className="mb-4 flex items-center gap-2 text-xs text-gray-400 bg-blue-900/20 p-2 rounded w-fit">
                        <FileText size={14} /> Analyzed {messageCount} messages based on real-time Telegram history.
                    </div>
                    <ReactMarkdown>{summary}</ReactMarkdown>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Bot size={64} className="mb-4 opacity-50" />
                    <p>No summary generated yet</p>
                    <p className="text-sm mt-2">Select chats and time range to start.</p>
                </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}