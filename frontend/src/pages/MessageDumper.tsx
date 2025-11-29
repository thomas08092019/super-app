import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Square, Play, Zap, Trash2, Calendar } from 'lucide-react';
import { dumperAPI, telegramAPI } from '../services/api';
import { useDumperStore } from '../store/dumperStore';
import CustomSelect from '../components/CustomSelect';
import ChatSelector from '../components/ChatSelector';

export default function MessageDumper() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [chatIds, setChatIds] = useState<string[]>([]);
  
  // Default time setup
  const now = new Date();
  const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  const todayStart = new Date(now.setHours(0,0,0,0) - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  
  const [startTime, setStartTime] = useState(todayStart);
  const [endTime, setEndTime] = useState(localNow);
  
  const { taskId, isDumping, progress, logs, setTaskId, setIsDumping, setProgress, addLog, clearLogs } = useDumperStore();
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => { try { setSessions(await telegramAPI.getSessions()); } catch {} };
    load();
  }, []);

  useEffect(() => {
    let interval: any;
    if (taskId) {
        const check = async () => {
            try {
                const s = await dumperAPI.getStatus(taskId);
                if (s.status === 'PROGRESS' && s.info?.status) addLog(s.info.status);
                if (s.info?.progress !== undefined) setProgress(s.info.progress);
                if (s.status === 'SUCCESS') { setIsDumping(false); setTaskId(null); addLog(s.info?.message || 'Done'); }
                else if (s.status === 'FAILURE') { setIsDumping(false); setTaskId(null); addLog(`ERROR: ${s.info?.error}`); }
            } catch {}
        };
        check();
        interval = setInterval(check, 1000);
    }
    return () => clearInterval(interval);
  }, [taskId]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, isDumping]);

  const handleStart = async () => {
    if (!sessionId) { alert('Select session'); return; }
    clearLogs(); setIsDumping(true); setProgress(0); addLog('Starting Dump...');
    try {
        const toUTC = (d: string) => d ? new Date(d).toISOString() : undefined;
        const res = await dumperAPI.startDump({ 
            session_id: sessionId, 
            chat_id: "", 
            chat_ids: chatIds, 
            start_time: toUTC(startTime), 
            end_time: toUTC(endTime) 
        });
        setTaskId(res.task_id);
    } catch (e: any) { addLog(`Error: ${e.message}`); setIsDumping(false); }
  };

  const handleStop = async () => {
    if (taskId && confirm('Stop?')) { await dumperAPI.stopDump(taskId); setIsDumping(false); setTaskId(null); addLog('STOPPED'); }
  };

  const handleAutoDump = async () => {
    if (!confirm('Trigger auto-dump for all accounts (Today)?')) return;
    clearLogs(); setIsDumping(true); addLog('Triggering Auto-Dump for ALL accounts...');
    try {
        const res = await dumperAPI.triggerAutoDump();
        addLog(res.message);
        if(res.task_ids && res.task_ids.length > 0) setTaskId(res.task_ids[0]); 
    } catch(e: any) { addLog(`Error: ${e.message}`); setIsDumping(false); }
  };

  const sessionOptions = sessions.map(s => ({ value: s.id, label: s.session_name }));

  return (
    <div className="h-full flex gap-6 pb-2">
        <div className="w-[350px] flex-shrink-0 flex flex-col gap-4">
            <div className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-5 border border-gray-700 flex-1 flex flex-col overflow-hidden shadow-lg">
                <div className="p-4 border-b border-gray-700/50 bg-gray-800/80 mb-4 -mx-5 -mt-5">
                    <h3 className="font-semibold text-white flex items-center gap-2"><Terminal size={18} className="text-purple-500"/> Dump Configuration</h3>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-5">
                    <button onClick={handleAutoDump} disabled={isDumping} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3 rounded-lg font-bold text-sm flex justify-center gap-2 items-center disabled:opacity-50 shadow-lg shadow-purple-900/20 transition-all transform active:scale-[0.98]">
                        <Zap size={16} fill="currentColor" /> QUICK DUMP (TODAY)
                    </button>
                    
                    <div className="border-t border-gray-700/50 pt-5 space-y-5">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Session</label>
                            <CustomSelect value={sessionId||''} onChange={setSessionId} options={sessionOptions} placeholder="Select Account" disabled={isDumping} className="text-sm"/>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Target Groups</label>
                            <ChatSelector sessionId={sessionId} value={chatIds} onChange={setChatIds} placeholder="Select chats..." />
                            <p className="text-[10px] text-gray-500 mt-1.5 italic">Leave empty to dump ALL chats.</p>
                        </div>
                        
                        <div className="bg-gray-900/30 p-3 rounded-lg border border-gray-600/30">
                            <div className="flex items-center gap-2 mb-3 text-gray-300">
                                <Calendar size={14} /> <span className="text-xs font-medium uppercase tracking-wide">Time Range</span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] text-gray-500 mb-1">FROM</label>
                                    <input type="datetime-local" value={startTime} onChange={e=>setStartTime(e.target.value)} disabled={isDumping} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs text-white outline-none focus:ring-1 focus:ring-purple-500 transition-all"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-500 mb-1">TO</label>
                                    <input type="datetime-local" value={endTime} onChange={e=>setEndTime(e.target.value)} disabled={isDumping} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs text-white outline-none focus:ring-1 focus:ring-purple-500 transition-all"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-700">
                    {isDumping ? 
                        <button onClick={handleStop} className="w-full bg-red-600 hover:bg-red-700 py-2.5 rounded-lg font-bold text-sm flex justify-center gap-2 items-center shadow-lg transition-all"><Square size={16} fill="currentColor"/> STOP DUMP</button> : 
                        <button onClick={handleStart} disabled={!sessionId} className="w-full bg-purple-600 hover:bg-purple-700 py-2.5 rounded-lg font-bold text-sm flex justify-center gap-2 items-center disabled:opacity-50 shadow-lg shadow-purple-900/20 transition-all"><Play size={16} fill="currentColor"/> START DUMP</button>
                    }
                </div>
            </div>
        </div>
        
        <div className="flex-1 flex flex-col h-full bg-black/40 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
            <div className="bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"/><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"/><div className="w-2.5 h-2.5 rounded-full bg-green-500"/></div>
                    <span className="text-xs text-gray-400 font-mono flex items-center gap-2"><Terminal size={14}/> Dump Terminal</span>
                </div>
                <button onClick={clearLogs} className="p-1.5 hover:bg-gray-800 rounded-md text-gray-500 hover:text-gray-300 transition-colors" title="Clear Logs"><Trash2 size={14}/></button>
            </div>
            
            <div ref={terminalRef} className="bg-black p-4 font-mono text-xs overflow-y-auto flex-1 flex flex-col custom-scrollbar">
                {logs.length===0 ? 
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-40">
                        <Terminal size={64} strokeWidth={1} />
                        <p className="mt-4">System ready...</p>
                    </div> : 
                    <div className="space-y-1.5 flex-1 pb-4">
                        {logs.map((l,i)=>(
                            <p key={i} className={`flex gap-3 ${l.includes('ERR')?'text-red-400':l.includes('Done')?'text-green-400':'text-gray-300'}`}>
                                <span className="opacity-30 select-none w-4 text-right">{i+1}</span>
                                <span>{l}</span>
                            </p>
                        ))}
                    </div>
                }
            </div>
        </div>
    </div>
  );
}