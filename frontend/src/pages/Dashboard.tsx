/**
 * Dashboard page component
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, MessageSquare, Database, Activity } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { telegramAPI } from '../services/api';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await telegramAPI.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      name: 'Active Sessions',
      value: sessions.length,
      icon: MessageSquare,
      color: 'from-blue-500 to-blue-600',
    },
    {
      name: 'Total Messages',
      value: '0',
      icon: Database,
      color: 'from-purple-500 to-purple-600',
    },
    {
      name: 'Active Tasks',
      value: '0',
      icon: Activity,
      color: 'from-green-500 to-green-600',
    },
  ];

  return (
    <div className="p-8">
      {/* Welcome section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {user?.email.split('@')[0]}!
        </h1>
        <p className="text-gray-400">Here's what's happening with your Telegram accounts</p>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}
              >
                <stat.icon size={24} className="text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mb-1">{stat.value}</h3>
            <p className="text-sm text-gray-400">{stat.name}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700"
      >
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <a
            href="/telegram/accounts"
            className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors group"
          >
            <Users size={24} className="text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium mb-1">Add Telegram Account</h3>
            <p className="text-sm text-gray-400">Connect a new Telegram session</p>
          </a>
          <a
            href="/telegram/feed"
            className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors group"
          >
            <Activity size={24} className="text-green-400 mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium mb-1">Live Message Feed</h3>
            <p className="text-sm text-gray-400">Monitor real-time messages</p>
          </a>
          <a
            href="/telegram/summary"
            className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors group"
          >
            <MessageSquare size={24} className="text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
            <h3 className="font-medium mb-1">AI Summary</h3>
            <p className="text-sm text-gray-400">Summarize conversations with AI</p>
          </a>
        </div>
      </motion.div>

      {/* Recent activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700"
      >
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="text-center py-8 text-gray-400">
          <Activity size={48} className="mx-auto mb-4 opacity-50" />
          <p>No recent activity to display</p>
        </div>
      </motion.div>
    </div>
  );
}

