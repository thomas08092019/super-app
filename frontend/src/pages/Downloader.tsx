import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Terminal, Square, HardDrive } from 'lucide-react';
import { downloaderAPI, telegramAPI } from '../services/api';
import type { TelegramSession } from '../types';
import ChatSelector from '../components/ChatSelector';
import { useDownloadStore } from '../store/downloadStore';
import CustomSelect from '../components/CustomSelect';

const ALL_MEDIA_TYPES = ['photo', 'video', 'audio', 'document', 'archive'];

export default function Downloader() {
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [chatIds, setChatIds] = useState<string[]>([]); // Changed to array for Multi-select
  const [limit, setLimit] = useState('');
  const [mediaTypes, setMediaTypes] = useState<string[]>(['photo', 'video', 'document']);
  const [saveLocally, setSaveLocally] = useState(false);
  
  const { 
    taskId, isDownloading, progress, logs,
    setTaskId, setIsDownloading, setProgress, addLog, clearLogs 
  } = useDownloadStore();

  useEffect(() => { loadSessions(); }, []);

  useEffect(() => {
    let interval: any;
    if (taskId) {
      checkTaskStatus();
      interval = setInterval(checkTaskStatus, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [taskId]);

  const loadSessions = async () => {
    try {
      const data = await telegramAPI.getSessions();
      setSessions(data);
      if (data.length > 0) setSessionId(data[0].id);
    } catch (error) { console.error(error); }
  };

  const checkTaskStatus = async () => {
    if (!taskId) return;
    try {
      const status = await downloaderAPI.getTaskStatus(taskId);
      
      if (status.status === 'PROGRESS' && status.info?.status) {
        const lastLog = logs[logs.length - 1];
        if (!lastLog || !lastLog.includes(status.info.status)) {
             addLog(status.info.status);
        }
      }
      
      if (status.info?.progress !== undefined) {
          setProgress(status.info.progress);
      }

      if (status.status === 'SUCCESS') {
        setIsDownloading(false); 
        setTaskId(null);
        addLog(status.info?.message || 'Completed successfully'); 
        addLog('--------------------------------');
      } else if (status.status === 'FAILURE') {
        setIsDownloading(false); 
        setTaskId(null);
        addLog(`ERROR: ${status.info?.error || 'Worker crashed'}`); 
        addLog('--------------------------------');
      }
    } catch (error) { console.error(error); }
  };

  const handleStartDownload = async () => {
    if (!sessionId) { alert('Please select a session'); return; }
    
    clearLogs(); 
    setIsDownloading(true); 
    setProgress(0); 
    addLog('Initializing download task...');

    try {
      const res = await downloaderAPI.startDownload({
        session_id: sessionId, 
        chat_id: "", // Backward compatibility
        chat_ids: chatIds, // Send list of chats
        media_types: mediaTypes, 
        limit: limit ? parseInt(limit) : undefined,
        save_locally: saveLocally
      });
      setTaskId(res.task_id); 
      addLog(`Task ID: ${res.task_id} started.`);
    } catch (e: any) { 
      addLog(`Error starting task: ${e.message}`); 
      setIsDownloading(false); 
    }
  };

  const handleStopDownload = async () => {
    if (!taskId) return;
    if (!confirm('Are you sure you want to STOP the download process?')) return;
    
    try {
        await downloaderAPI.cancelTask(taskId);
        addLog('[USER] Requesting to stop task...');
        setIsDownloading(false);
        setTaskId(null);
        addLog('[STOPPED] Task execution stopped by user.');
        addLog('--------------------------------');
    } catch (error: any) {
        addLog(`Error stopping task: ${error.message}`);
    }
  };

  const toggleMediaType = (type: string) => {
    setMediaTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const toggleSelectAll = () => {
    if (mediaTypes.length === ALL_MEDIA_TYPES.length) {
      setMediaTypes([]);
    } else {
      setMediaTypes([...ALL_MEDIA_TYPES]);
    }
  };

  const sessionOptions = sessions.map(s => ({ value: s.id, label: s.session_name }));

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><Download className="text-blue-500" /> Data Miner</h1>
        <p className="text-gray-400">Bulk download media from Telegram chats</p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 h-fit">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Telegram Session</label>
              <CustomSelect
                value={sessionId || ''}
                onChange={(val) => setSessionId(val)}
                options={sessionOptions}
                placeholder="Select Account"
                disabled={isDownloading}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Target Chats (Empty = All)</label>
              {/* ChatSelector automatically enables multi-select when value is an array */}
              <ChatSelector 
                sessionId={sessionId} 
                value={chatIds} 
                onChange={setChatIds} 
                placeholder="Select chats..." 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Limit (Optional)</label>
              <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Leave empty for all files" disabled={isDownloading} className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-white" />
              <p className="text-xs text-gray-500 mt-1">Download N most recent matching files.</p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-300">Media Types</label>
                <button 
                  onClick={toggleSelectAll} 
                  disabled={isDownloading}
                  className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                >
                  {mediaTypes.length === ALL_MEDIA_TYPES.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_MEDIA_TYPES.map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                    <input type="checkbox" checked={mediaTypes.includes(type)} onChange={() => toggleMediaType(type)} disabled={isDownloading} className="w-4 h-4 rounded bg-gray-700 border-gray-500 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm capitalize text-gray-300">{type}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-600/50">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={saveLocally} 
                        onChange={(e) => setSaveLocally(e.target.checked)}
                        disabled={isDownloading}
                        className="w-5 h-5 rounded bg-gray-700 border-gray-500 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                        <span className="block text-sm font-medium text-gray-200 flex items-center gap-2">
                            <HardDrive size={16} /> Save to Host Disk
                        </span>
                        <span className="text-[10px] text-gray-500 block">
                            Files will be saved to <code>./exports</code> folder.
                        </span>
                    </div>
                </label>
            </div>

            {isDownloading ? (
                <button onClick={handleStopDownload} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-all">
                    <Square size={20} fill="currentColor" /> Stop Download
                </button>
            ) : (
                <button onClick={handleStartDownload} disabled={!sessionId} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <Download size={20} /> Start Download
                </button>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="xl:col-span-2">
          <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700 flex flex-col h-[500px]">
            <div className="bg-gray-800 px-4 py-3 flex items-center gap-2 border-b border-gray-700 shrink-0">
              <div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><div className="w-3 h-3 rounded-full bg-yellow-500"></div><div className="w-3 h-3 rounded-full bg-green-500"></div></div>
              <span className="text-sm text-gray-400 font-mono flex items-center justify-center gap-2 flex-1"><Terminal size={16} /> Download Terminal</span>
            </div>
            
            <div className="bg-black p-6 font-mono text-sm overflow-y-auto flex-1 flex flex-col">
              {logs.length === 0 ? (
                <div className="text-green-400">
                  <p>$ Telegram Data Miner v1.0</p>
                  <p className="text-gray-500 mt-2">Ready to download media files...</p>
                </div>
              ) : (
                <div className="space-y-1 flex-1">
                  {logs.map((log, i) => {
                    const isError = log.includes('ERROR') || log.includes('failed');
                    const isSuccess = log.includes('successfully') || log.includes('Done!');
                    const isStopped = log.includes('STOPPED');
                    return (
                      <p key={i} className={`${isError ? 'text-red-400' : isSuccess ? 'text-green-400' : isStopped ? 'text-yellow-400' : 'text-gray-300'} break-words`}>
                        {log}
                      </p>
                    );
                  })}
                </div>
              )}
              
              {isDownloading && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span className="text-white font-bold">{progress}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-yellow-400 animate-pulse">▋</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}