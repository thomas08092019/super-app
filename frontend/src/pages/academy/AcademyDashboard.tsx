import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Trophy, Brain, CheckCircle, Clock, Zap, X, AlertCircle } from 'lucide-react';
import { academyAPI } from '../../services/api';
import type { AcademyStats, MistakeDetail } from '../../types';
import { formatTime } from '@/utils/time';

export default function AcademyDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AcademyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [sessionMistakes, setSessionMistakes] = useState<MistakeDetail[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
        loadSessionDetails(selectedSessionId);
    }
  }, [selectedSessionId]);

  const loadStats = async () => {
    try {
      const data = await academyAPI.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load academy stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionDetails = async (id: number) => {
      setLoadingHistory(true);
      try {
          const mistakes = await academyAPI.getSessionHistory(id);
          setSessionMistakes(mistakes.filter(m => !m.is_correct));
      } catch (e) {
          console.error(e);
      } finally {
          setLoadingHistory(false);
      }
  };

  const StatCard = ({ icon: Icon, label, value, color }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 hover:border-gray-500 transition-colors"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
      <h3 className="text-2xl font-bold mb-1 text-white">{value}</h3>
      <p className="text-sm text-gray-400">{label}</p>
    </motion.div>
  );

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3 text-white">
            <BookOpen className="text-indigo-500" /> Japanese Academy
          </h1>
          <p className="text-gray-400">Master Hiragana & Katakana</p>
        </div>
        <div className="flex gap-3">
            <button onClick={() => navigate('/academy/learn')} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20 text-white">
                <Brain size={20} /> Learn
            </button>
            <button onClick={() => navigate('/academy/quiz')} className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold transition-all text-white">
                <Zap size={20} /> Quiz
            </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard icon={Brain} label="Total Sessions" value={stats?.total_sessions || 0} color="from-blue-500 to-blue-600" />
        <StatCard icon={CheckCircle} label="Avg Accuracy" value={`${stats?.average_accuracy || 0}%`} color="from-green-500 to-green-600" />
        <StatCard icon={Trophy} label="Questions Answered" value={stats?.total_questions_answered || 0} color="from-purple-500 to-purple-600" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 flex-1">
        <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2"><Clock size={20} className="text-gray-400"/> Recent Activity</h2>
        <div className="space-y-2">
          {stats?.recent_history.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No activity yet. Start learning!</div>
          ) : (
            stats?.recent_history.map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => setSelectedSessionId(item.id)}
                className="flex justify-between items-center p-4 bg-gray-900/50 rounded-lg hover:bg-gray-700/50 transition-colors border border-gray-700/30 cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${item.mode.includes('quiz') ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                  <div>
                      <span className="text-gray-200 font-medium block">{item.mode}</span>
                      <span className="text-xs text-gray-500">{formatTime(item.date)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="font-mono font-bold bg-gray-800 px-3 py-1 rounded text-indigo-400 border border-gray-700 group-hover:border-indigo-500/50 transition-colors">{item.score}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* HISTORY DETAIL MODAL */}
      <AnimatePresence>
        {selectedSessionId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelectedSessionId(null)}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-800 rounded-xl w-full max-w-2xl border border-gray-700 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900">
                        <h3 className="font-bold text-lg text-white flex items-center gap-2"><AlertCircle className="text-red-500" size={20}/> Mistakes Review</h3>
                        <button onClick={() => setSelectedSessionId(null)} className="hover:text-white text-gray-400"><X size={20}/></button>
                    </div>
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                        {loadingHistory ? (
                            <div className="text-center py-10"><div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div></div>
                        ) : sessionMistakes.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                                <CheckCircle size={48} className="text-green-500 mb-4 opacity-50"/>
                                <p>Perfect Score! No mistakes found in this session.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sessionMistakes.map((m, i) => (
                                    <div key={i} className="bg-gray-900/50 p-4 rounded-lg border border-red-500/20">
                                        <p className="text-white font-medium mb-2 text-lg">{m.question}</p>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="text-red-400">
                                                <span className="block text-xs text-gray-500 uppercase">Your Answer</span>
                                                {m.user_answer}
                                            </div>
                                            <div className="text-green-400">
                                                <span className="block text-xs text-gray-500 uppercase">Correct Answer</span>
                                                {m.correct_answer}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}