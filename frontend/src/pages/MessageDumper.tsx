import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Square, Database, Play } from 'lucide-react';
import { dumperAPI, telegramAPI } from '../services/api';
import { useDumperStore } from '../store/dumperStore';
import CustomSelect from '../components/CustomSelect';
import ChatSelector from '../components/ChatSelector';

export default function MessageDumper() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [chatId, setChatId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  const { taskId, isDumping, progress, logs, setTaskId, setIsDumping, setProgress, addLog, clearLogs } = useDumperStore();

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

  const handleStart = async () => {
    if (!sessionId) { alert('Select session'); return; }
    clearLogs(); setIsDumping(true); setProgress(0); addLog('Starting Dump...');
    try {
        const res = await dumperAPI.startDump({ session_id: sessionId, chat_id: chatId || null, start_time: startTime || null, end_time: endTime || null });
        setTaskId(res.task_id);
    } catch (e: any) { addLog(`Error: ${e.message}`); setIsDumping(false); }
  };

  const handleStop = async () => {
    if (taskId && confirm('Stop?')) { await dumperAPI.stopDump(taskId); setIsDumping(false); setTaskId(null); addLog('STOPPED'); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
        <motion.div initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 h-fit">
            <h2 className="text-xl font-semibold mb-4">Dump Configuration</h2>
            <div className="space-y-4">
                <div><label className="text-sm text-gray-300 block mb-2">Session</label><CustomSelect value={sessionId||''} onChange={setSessionId} options={sessions.map(s=>({value:s.id, label:s.session_name}))} placeholder="Select Account" disabled={isDumping}/></div>
                <div><label className="text-sm text-gray-300 block mb-2">Target Group (Optional)</label><ChatSelector sessionId={sessionId} value={chatId} onChange={setChatId} placeholder="Leave empty for ALL groups"/></div>
                <div><label className="text-sm text-gray-300 block mb-2">Start Date</label><input type="datetime-local" value={startTime} onChange={e=>setStartTime(e.target.value)} disabled={isDumping} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="text-sm text-gray-300 block mb-2">End Date</label><input type="datetime-local" value={endTime} onChange={e=>setEndTime(e.target.value)} disabled={isDumping} className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"/></div>
                {isDumping ? <button onClick={handleStop} className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-medium flex justify-center gap-2"><Square size={20} fill="currentColor"/> Stop Dump</button> : 
                <button onClick={handleStart} disabled={!sessionId} className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-lg font-medium flex justify-center gap-2 disabled:opacity-50"><Play size={20}/> Start Dump</button>}
            </div>
        </motion.div>
        <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} className="xl:col-span-2 flex flex-col h-[600px] bg-gray-900 rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
            <div className="bg-gray-800 px-4 py-3 flex items-center gap-2 border-b border-gray-700"><div className="flex gap-2"><div className="w-3 h-3 rounded-full bg-red-500"/><div className="w-3 h-3 rounded-full bg-yellow-500"/><div className="w-3 h-3 rounded-full bg-green-500"/></div><span className="text-sm text-gray-400 font-mono flex-1 text-center">Dump Terminal</span></div>
            <div className="bg-black p-6 font-mono text-sm overflow-y-auto flex-1 flex flex-col">
                {logs.length===0 ? <div className="text-purple-400"><p>$ Message Dumper v1.0</p><p className="text-gray-500">Waiting for command...</p></div> : <div className="space-y-1 flex-1">{logs.map((l,i)=><p key={i} className={l.includes('ERR')?'text-red-400':l.includes('Done')?'text-green-400':'text-gray-300'}>{l}</p>)}</div>}
                {isDumping && <div className="mt-4 pt-4 border-t border-gray-800"><div className="flex justify-between text-xs text-gray-400 mb-1"><span>Progress</span><span>{progress}%</span></div><div className="bg-gray-800 h-2 rounded-full overflow-hidden"><div className="h-full bg-purple-500 transition-all duration-300" style={{width:`${progress}%`}}/></div></div>}
            </div>
        </motion.div>
    </div>
  );
}