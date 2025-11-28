import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Send, Plus, X } from 'lucide-react';
import { broadcasterAPI, telegramAPI } from '../services/api';
import type { TelegramSession } from '../types';
import ChatSelector from '../components/ChatSelector';
import CustomSelect from '../components/CustomSelect';

export default function Broadcaster() {
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [targetChats, setTargetChats] = useState<string[]>(['']);
  const [delayMin, setDelayMin] = useState(2);
  const [delayMax, setDelayMax] = useState(5);
  const [broadcasting, setBroadcasting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (taskId) {
      const interval = setInterval(() => {
        checkTaskStatus();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [taskId]);

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

  const checkTaskStatus = async () => {
    if (!taskId) return;

    try {
      const statusData = await broadcasterAPI.getStatus(taskId);
      setStatus(statusData);

      if (statusData.status === 'SUCCESS' || statusData.status === 'FAILURE') {
        setBroadcasting(false);
        setTaskId(null);
      }
    } catch (error) {
      console.error('Failed to check task status:', error);
    }
  };

  const addTargetChat = () => {
    setTargetChats([...targetChats, '']);
  };

  const removeTargetChat = (index: number) => {
    setTargetChats(targetChats.filter((_, i) => i !== index));
  };

  const updateTargetChat = (index: number, value: string) => {
    const updated = [...targetChats];
    updated[index] = value;
    setTargetChats(updated);
  };

  const handleBroadcast = async () => {
    if (!sessionId || !message || targetChats.filter((c) => c).length === 0) {
      alert('Please fill all required fields');
      return;
    }

    setBroadcasting(true);
    setStatus(null);

    try {
      const result = await broadcasterAPI.send({
        session_id: sessionId,
        message,
        target_chat_ids: targetChats.filter((c) => c),
        delay_min: delayMin,
        delay_max: delayMax,
      });

      setTaskId(result.task_id);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to start broadcast');
      setBroadcasting(false);
    }
  };

  const sessionOptions = sessions.map(s => ({ value: s.id, label: s.session_name }));

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Radio className="text-purple-500" />
          Broadcaster
        </h1>
        <p className="text-gray-400">Send messages to multiple chats safely</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Message</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Telegram Session
                </label>
                <CustomSelect
                    value={sessionId || ''}
                    onChange={(val) => setSessionId(val)}
                    options={sessionOptions}
                    placeholder="Select Account"
                    disabled={broadcasting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Message Content
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message..."
                  disabled={broadcasting}
                  rows={6}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50 text-white"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 relative z-20">
            <h2 className="text-xl font-semibold mb-4">Target Chats</h2>
            <div className="space-y-3">
              {targetChats.map((chat, index) => (
                <div key={index} className="flex gap-2 relative" style={{ zIndex: targetChats.length - index }}>
                  <div className="flex-1">
                    <ChatSelector
                      sessionId={sessionId}
                      value={chat}
                      onChange={(value) => updateTargetChat(index, value)}
                      placeholder="@username or chat ID"
                    />
                  </div>
                  {targetChats.length > 1 && (
                    <button
                      onClick={() => removeTargetChat(index)}
                      disabled={broadcasting}
                      className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addTargetChat}
                disabled={broadcasting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                <Plus size={20} />
                Add Target
              </button>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 relative z-10">
            <h2 className="text-xl font-semibold mb-4">Safety Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Min Delay (seconds): {delayMin}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={delayMin}
                  onChange={(e) => setDelayMin(Number(e.target.value))}
                  disabled={broadcasting}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Delay (seconds): {delayMax}
                </label>
                <input
                  type="range"
                  min="2"
                  max="20"
                  value={delayMax}
                  onChange={(e) => setDelayMax(Number(e.target.value))}
                  disabled={broadcasting}
                  className="w-full"
                />
              </div>
              <p className="text-sm text-gray-400">
                ⚠️ Random delays between messages help avoid Telegram flood bans
              </p>
            </div>
          </div>

          <button
            onClick={handleBroadcast}
            disabled={broadcasting || !sessionId || !message}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {broadcasting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send size={20} />
                Start Broadcast
              </>
            )}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700"
        >
          <h2 className="text-xl font-semibold mb-4">Broadcast Status</h2>
          {status ? (
            <div className="space-y-4">
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Status</p>
                <p className="text-lg font-semibold capitalize">{status.status}</p>
              </div>
              {status.info && status.info.sent !== undefined && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-400 mb-1">Total</p>
                    <p className="text-2xl font-bold">{status.info.total}</p>
                  </div>
                  <div className="p-4 bg-green-500/20 rounded-lg">
                    <p className="text-sm text-green-300 mb-1">Sent</p>
                    <p className="text-2xl font-bold text-green-400">{status.info.sent}</p>
                  </div>
                  <div className="p-4 bg-red-500/20 rounded-lg">
                    <p className="text-sm text-red-300 mb-1">Failed</p>
                    <p className="text-2xl font-bold text-red-400">{status.info.failed}</p>
                  </div>
                </div>
              )}
              {status.info?.progress !== undefined && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Progress</span>
                    <span className="text-sm font-semibold">{status.info.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
                      style={{ width: `${status.info.progress}%` }}
                    />
                  </div>
                </div>
              )}
              {status.info?.status && (
                <div className="p-4 bg-blue-500/20 rounded-lg">
                  <p className="text-sm text-blue-300">{status.info.status}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <Radio size={64} className="mx-auto mb-4 opacity-50" />
                <p>No broadcast in progress</p>
                <p className="text-sm mt-2">Configure settings and click "Start Broadcast"</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}