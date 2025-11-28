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
  const [chatId, setChatId] = useState('');
  const [limit, setLimit] = useState('');
  const [mediaTypes, setMediaTypes] = useState<string[]>(['photo', 'video', 'document']);
  const [saveLocally, setSaveLocally] = useState(false);
  
  const { taskId, isDownloading, progress, logs, setTaskId, setIsDownloading, setProgress, addLog, clearLogs } = useDownloadStore();

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => {
    let interval: any; if (taskId) { checkTaskStatus(); interval = setInterval(checkTaskStatus, 1000); }
    return () => { if (interval) clearInterval(interval); };
  }, [taskId]);

  const loadSessions = async () => { try { setSessions(await telegramAPI.getSessions()); if (sessions.length>0) setSessionId(sessions[0].id); } catch {} };

  const checkTaskStatus = async () => {
    if (!taskId) return;
    try {
      const s = await downloaderAPI.getTaskStatus(taskId);
      if (s.status==='PROGRESS' && s.info?.status) { const last=logs[logs.length-1]; if(!last||!last.includes(s.info.status)) addLog(s.info.status); }
      if (s.info?.progress!==undefined) setProgress(s.info.progress);
      if (s.status==='SUCCESS') { setIsDownloading(false); setTaskId(null); addLog(s.info?.message||'Done'); addLog('---'); }
      else if (s.status==='FAILURE') { setIsDownloading(false); setTaskId(null); addLog(`ERR: ${s.info?.error}`); addLog('---'); }
    } catch {}
  };

  const handleStartDownload = async () => {
    if (!sessionId || !chatId) { alert('Select session & chat'); return; }
    clearLogs(); setIsDownloading(true); setProgress(0); addLog('Starting...');
    try {
      const res = await downloaderAPI.startDownload({ session_id: sessionId, chat_id: chatId, media_types: mediaTypes, limit: limit ? parseInt(limit) : undefined, save_locally: saveLocally });
      setTaskId(res.task_id); addLog(`Task: ${res.task_id}`);
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
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8"><h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><Download className="text-blue-500" /> Data Miner</h1></motion.div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 h-fit">
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-300 mb-2">Telegram Session</label><CustomSelect value={sessionId||''} onChange={setSessionId} options={sessionOptions} placeholder="Select Account" disabled={isDownloading}/></div>
            <div><label className="block text-sm font-medium text-gray-300 mb-2">Chat ID</label><ChatSelector sessionId={sessionId} value={chatId} onChange={setChatId} placeholder="Enter chat ID..." /></div>
            <div><label className="block text-sm font-medium text-gray-300 mb-2">Limit (Optional)</label><input type="number" value={limit} onChange={e=>setLimit(e.target.value)} placeholder="Empty = All" disabled={isDownloading} className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"/></div>
            <div>
              <div className="flex justify-between mb-2"><label className="block text-sm font-medium text-gray-300">Media Types</label><button onClick={toggleSelectAll} disabled={isDownloading} className="text-xs text-blue-400 hover:text-blue-300">Select All</button></div>
              <div className="grid grid-cols-2 gap-2">{ALL_MEDIA_TYPES.map(t => (<label key={t} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={mediaTypes.includes(t)} onChange={()=>toggleMediaType(t)} disabled={isDownloading} className="rounded bg-gray-700 border-gray-500"/><span className="text-sm capitalize text-gray-300">{t}</span></label>))}</div>
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-600/50"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={saveLocally} onChange={e=>setSaveLocally(e.target.checked)} disabled={isDownloading} className="w-5 h-5 rounded bg-gray-700 border-gray-500 text-blue-600"/><div className="text-sm font-medium text-gray-200 flex items-center gap-2"><HardDrive size={16}/> Save to Host Disk</div></label></div>
            {isDownloading ? <button onClick={handleStopDownload} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-medium"><Square size={20} fill="currentColor"/> Stop</button> : <button onClick={handleStartDownload} disabled={!sessionId||!chatId} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"><Download size={20}/> Start Download</button>}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="xl:col-span-2">
          <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700 flex flex-col h-[500px]">
            <div className="bg-gray-800 px-4 py-3 flex items-center gap-2 border-b border-gray-700 shrink-0"><div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-red-500"/><div className="w-3 h-3 rounded-full bg-yellow-500"/><div className="w-3 h-3 rounded-full bg-green-500"/></div><span className="text-sm text-gray-400 font-mono flex-1 text-center flex justify-center gap-2"><Terminal size={16}/> Terminal</span></div>
            <div className="bg-black p-6 font-mono text-sm overflow-y-auto flex-1 flex flex-col">
                {logs.length===0 ? <div className="text-green-400"><p>$ Ready...</p></div> : <div className="space-y-1 flex-1">{logs.map((l,i)=><p key={i} className={l.includes('ERR')?'text-red-400':l.includes('Done')?'text-green-400':l.includes('STOP')?'text-yellow-400':'text-gray-300'}>{l}</p>)}</div>}
                {isDownloading && <div className="mt-4 pt-4 border-t border-gray-800"><div className="flex justify-between text-xs text-gray-400 mb-1"><span>Progress</span><span className="text-white font-bold">{progress}%</span></div><div className="flex gap-2"><div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden"><div className="h-full bg-green-500 transition-all duration-300" style={{width:`${progress}%`}}/></div><span className="text-yellow-400 animate-pulse">▋</span></div></div>}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}