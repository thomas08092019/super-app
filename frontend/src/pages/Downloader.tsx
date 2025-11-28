/**
 * Data Downloader page - Terminal-style media downloader
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Terminal } from 'lucide-react';
import { downloaderAPI, telegramAPI } from '../services/api';
import type { TelegramSession } from '../types';
import ChatSelector from '../components/ChatSelector';

export default function Downloader() {
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [chatId, setChatId] = useState('');
  const [mediaTypes, setMediaTypes] = useState<string[]>(['photo', 'video', 'document']);
  const [downloading, setDownloading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

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
      const status = await downloaderAPI.getTaskStatus(taskId);
      
      if (status.info.status) {
        addLog(status.info.status);
      }
      
      if (status.info.progress !== undefined) {
        setProgress(status.info.progress);
      }

      if (status.status === 'SUCCESS' || status.status === 'FAILURE') {
        setDownloading(false);
        setTaskId(null);
        addLog(status.info.message || 'Task completed');
      }
    } catch (error) {
      console.error('Failed to check task status:', error);
    }
  };

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleStartDownload = async () => {
    if (!sessionId || !chatId) {
      alert('Please select a session and enter a chat ID');
      return;
    }

    setDownloading(true);
    setLogs([]);
    setProgress(0);

    try {
      const result = await downloaderAPI.startDownload({
        session_id: sessionId,
        chat_id: chatId,
        media_types: mediaTypes,
      });

      setTaskId(result.task_id);
      addLog('Download task started...');
    } catch (error: any) {
      addLog(`Error: ${error.response?.data?.detail || 'Failed to start download'}`);
      setDownloading(false);
    }
  };

  const toggleMediaType = (type: string) => {
    setMediaTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Download className="text-blue-500" />
          Data Miner
        </h1>
        <p className="text-gray-400">Bulk download media from Telegram chats</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 h-fit"
        >
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Telegram Session
              </label>
              <select
                value={sessionId || ''}
                onChange={(e) => setSessionId(Number(e.target.value))}
                disabled={downloading}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.session_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Chat ID or Username
              </label>
              <ChatSelector
                sessionId={sessionId}
                value={chatId}
                onChange={setChatId}
                placeholder="Enter chat ID or select from dropdown"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Media Types
              </label>
              <div className="space-y-2">
                {['photo', 'video', 'document'].map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mediaTypes.includes(type)}
                      onChange={() => toggleMediaType(type)}
                      disabled={downloading}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartDownload}
              disabled={downloading || !sessionId || !chatId}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={20} />
              {downloading ? 'Downloading...' : 'Start Download'}
            </button>
          </div>
        </motion.div>

        {/* Terminal window */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          {/* Terminal window frame */}
          <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700">
            {/* macOS-style window controls */}
            <div className="bg-gray-800 px-4 py-3 flex items-center gap-2 border-b border-gray-700">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-sm text-gray-400 font-mono flex items-center justify-center gap-2">
                  <Terminal size={16} />
                  Download Terminal
                </span>
              </div>
            </div>

            {/* Terminal content */}
            <div className="bg-black p-6 font-mono text-sm h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-green-400">
                  <p>$ Telegram Data Miner v1.0</p>
                  <p className="text-gray-500 mt-2">
                    Ready to download media files...
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <p key={index} className="text-green-400">
                      {log}
                    </p>
                  ))}
                  {downloading && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-gray-400">{progress}%</span>
                      </div>
                      <p className="text-yellow-400 animate-pulse">▋</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

