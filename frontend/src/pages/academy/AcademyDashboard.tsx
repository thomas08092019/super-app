import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Trophy, Brain, CheckCircle, Clock, Zap } from 'lucide-react';
import { academyAPI } from '../../services/api';
import type { AcademyStats } from '../../types';

export default function AcademyDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AcademyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

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
              <div key={idx} className="flex justify-between items-center p-4 bg-gray-900/50 rounded-lg hover:bg-gray-700/50 transition-colors border border-gray-700/30">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${item.mode === 'quiz' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                  <span className="text-gray-200 capitalize font-medium">{item.mode} Session</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-sm text-gray-500">{new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString()}</span>
                  <span className="font-mono font-bold bg-gray-800 px-3 py-1 rounded text-indigo-400 border border-gray-700">{item.score}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}