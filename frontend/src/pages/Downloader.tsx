import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Terminal, Square, HardDrive, Trash2 } from 'lucide-react';
import { downloaderAPI, telegramAPI } from '../services/api';
import type { TelegramSession } from '../types';
import ChatSelector from '../components/ChatSelector';
import { useDownloadStore } from '../store/downloadStore';
import CustomSelect from '../components/CustomSelect';

const ALL_MEDIA_TYPES = ['photo', 'video', 'audio', 'document', 'archive'];

export default function Downloader() {
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [chatIds, setChatIds] = useState<string[]>([]);
  const [limit, setLimit] = useState('');
  const [mediaTypes, setMediaTypes] = useState<string[]>(['photo', 'video', 'document']);
  const [saveLocally, setSaveLocally] = useState(false);
  
  const { taskId, isDownloading, progress, logs, setTaskId, setIsDownloading, setProgress, addLog, clearLogs } = useDownloadStore();
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadSessions(); }, []);

  useEffect(() => {
    let interval: any;
    if (taskId) {
      checkTaskStatus();
      interval = setInterval(checkTaskStatus, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [taskId]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, isDownloading]);

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
      if (status.info?.progress !== undefined) setProgress(status.info.progress);
      if (status.status === 'SUCCESS') {
        setIsDownloading(false); setTaskId(null);
        addLog(status.info?.message || 'Completed successfully'); addLog('--------------------------------');
      } else if (status.status === 'FAILURE') {
        setIsDownloading(false); setTaskId(null);
        addLog(`ERROR: ${status.info?.error || 'Worker crashed'}`); addLog('--------------------------------');
      }
    } catch (error) { console.error(error); }
  };

  const handleStartDownload = async () => {
    if (!sessionId) { alert('Select session'); return; }
    clearLogs(); setIsDownloading(true); setProgress(0); addLog('Initializing download task...');
    try {
      const res = await downloaderAPI.startDownload({ 
          session_id: sessionId, 
          chat_id: "", 
          chat_ids: chatIds, 
          media_types: mediaTypes, 
          limit: limit ? parseInt(limit) : undefined, 
          save_locally: saveLocally
          // Time filters removed
      });
      setTaskId(res.task_id); addLog(`Task ID: ${res.task_id} started.`);
    } catch (e: any) { addLog(`Error: ${e.message}`); setIsDownloading(false); }
  };

  const handleStopDownload = async () => {
    if (!taskId || !confirm('Stop?')) return;
    try { await downloaderAPI.cancelTask(taskId); addLog('Stopping...'); setIsDownloading(false); setTaskId(null); addLog('STOPPED'); } catch (e: any) { addLog(`Error: ${e.message}`); }
  };

  const toggleMediaType = (t: string) => setMediaTypes(prev => prev.includes(t) ? prev.filter(i=>i!==t) : [...prev,t]);
  const toggleSelectAll = () => setMediaTypes(mediaTypes.length === ALL_MEDIA_TYPES.length ? [] : [...ALL_MEDIA_TYPES]);
  const sessionOptions = sessions.map(s => ({ value: s.id, label: s.session_name }));

  return (
    <div className="h-full flex gap-6 pb-2">
      {/* Left Config Panel - Optimized for space */}
      <div className="w-[350px] flex-shrink-0 flex flex-col gap-4">
        <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl border border-gray-700 flex-1 flex flex-col overflow-hidden shadow-lg">
          <div className="p-4 border-b border-gray-700/50 bg-gray-800/80">
              <h3 className="font-semibold text-white flex items-center gap-2"><Download size={18} className="text-blue-500"/> Configuration</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
            <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Session</label>
                <CustomSelect value={sessionId||''} onChange={setSessionId} options={sessionOptions} placeholder="Select Account" disabled={isDownloading} className="text-sm"/>
            </div>

            <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Target Chats</label>
                <ChatSelector sessionId={sessionId} value={chatIds} onChange={setChatIds} placeholder="Select chats..." />
                <p className="text-[10px] text-gray-500 mt-1.5 italic">Leave empty to scan all chats available.</p>
            </div>

            <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">File Limit</label>
                <input type="number" value={limit} onChange={e=>setLimit(e.target.value)} placeholder="Empty = All files" disabled={isDownloading} className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-600 transition-all hover:border-gray-500"/>
            </div>

            <div>
              <div className="flex justify-between mb-2 items-center">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Media Types</label>
                  <button onClick={toggleSelectAll} disabled={isDownloading} className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors">Select All</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                  {ALL_MEDIA_TYPES.map(t => (
                      <label key={t} className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border transition-all ${mediaTypes.includes(t) ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-900/40 border-transparent hover:border-gray-600'}`}>
                          <input type="checkbox" checked={mediaTypes.includes(t)} onChange={()=>toggleMediaType(t)} disabled={isDownloading} className="rounded bg-gray-700 border-gray-500 text-blue-500 w-3.5 h-3.5 focus:ring-0 focus:ring-offset-0"/>
                          <span className={`text-xs capitalize font-medium ${mediaTypes.includes(t) ? 'text-blue-200' : 'text-gray-400'}`}>{t}</span>
                      </label>
                  ))}
              </div>
            </div>
            
            <div className={`p-3 rounded-lg border transition-all ${saveLocally ? 'bg-blue-900/10 border-blue-500/30' : 'bg-gray-900/30 border-gray-600/30'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={saveLocally} onChange={e=>setSaveLocally(e.target.checked)} disabled={isDownloading} className="w-4 h-4 rounded bg-gray-700 border-gray-500 text-blue-600 focus:ring-0"/>
                    <div>
                        <span className={`block text-sm font-medium flex items-center gap-1.5 ${saveLocally ? 'text-blue-200' : 'text-gray-300'}`}>
                            <HardDrive size={14}/> Save to Host Disk
                        </span>
                        <span className="text-[10px] text-gray-500 block">Files will be saved to <code>./exports</code> folder</span>
                    </div>
                </label>
            </div>
          </div>
          
          <div className="p-4 border-t border-gray-700 bg-gray-800/30">
            {isDownloading ? 
                <button onClick={handleStopDownload} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-sm transition-all shadow-lg shadow-red-900/20 transform active:scale-[0.98]"><Square size={18} fill="currentColor"/> STOP DOWNLOAD</button> : 
                <button onClick={handleStartDownload} disabled={!sessionId} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20 transform active:scale-[0.98] transition-all"><Download size={18}/> START DOWNLOAD</button>
            }
          </div>
        </div>
      </div>
      
      {/* Right Terminal - Expanded */}
      <div className="flex-1 flex flex-col h-full bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
        <div className="bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-3">
                <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"/><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"/><div className="w-2.5 h-2.5 rounded-full bg-green-500"/></div>
                <span className="text-xs text-gray-400 font-mono flex items-center gap-2"><Terminal size={14}/> activity_log.sh</span>
            </div>
            <button onClick={clearLogs} className="p-1.5 hover:bg-gray-800 rounded-md text-gray-500 hover:text-gray-300 transition-colors" title="Clear Logs"><Trash2 size={14}/></button>
        </div>
        <div ref={terminalRef} className="bg-black p-4 font-mono text-xs overflow-y-auto flex-1 flex flex-col custom-scrollbar">
            {logs.length===0 ? 
                <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-40">
                    <Terminal size={64} strokeWidth={1} />
                    <p className="mt-4">Waiting for tasks...</p>
                </div> : 
                <div className="space-y-1.5 flex-1 pb-4">
                    {logs.map((l,i)=>(
                        <p key={i} className={`flex gap-3 ${l.includes('ERR')?'text-red-400':l.includes('Done')?'text-green-400':l.includes('STOP')?'text-yellow-400':'text-gray-300'}`}>
                            <span className="opacity-30 select-none w-4 text-right">{i+1}</span>
                            <span>{l}</span>
                        </p>
                    ))}
                </div>
            }
            {isDownloading && <div className="mt-auto pt-4 border-t border-gray-900 sticky bottom-0 bg-black pb-2"><div className="flex justify-between text-[10px] text-gray-500 mb-1.5 uppercase tracking-widest"><span>Progress</span><span className="text-green-500 font-bold">{progress}%</span></div><div className="flex gap-2 items-center"><div className="flex-1 bg-gray-900 rounded-full h-1.5 overflow-hidden"><div className="h-full bg-green-500 transition-all duration-300 ease-out" style={{width:`${progress}%`}}/></div><span className="text-green-500 animate-pulse text-xs">●</span></div></div>}
        </div>
      </div>
    </div>
  );
}