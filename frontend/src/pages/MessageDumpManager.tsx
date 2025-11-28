import { useState, useEffect } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, Database } from 'lucide-react';
import { dumperAPI, telegramAPI } from '../services/api';
import CustomSelect from '../components/CustomSelect';

export default function MessageDumpManager() {
  const [messages, setMessages] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<number>(0);
  const [chatId, setChatId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  
  useEffect(() => {
    telegramAPI.getSessions().then(setSessions);
    dumperAPI.getGroups().then(setGroups);
  }, []);

  useEffect(() => {
    dumperAPI.getMessages({ session_id: sessionId || undefined, chat_id: chatId, search, page, limit: 20 }).then(setMessages);
  }, [sessionId, chatId, search, page]);

  return (
    <div className="p-8 h-screen flex flex-col">
        <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold flex items-center gap-3"><Database className="text-purple-500"/> Dumped Messages</h1>
            <div className="flex gap-2">
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} className="p-2 bg-gray-800 rounded hover:bg-gray-700"><ChevronLeft/></button>
                <button onClick={()=>setPage(p=>p+1)} className="p-2 bg-gray-800 rounded hover:bg-gray-700"><ChevronRight/></button>
            </div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex gap-4 mb-6">
            <CustomSelect value={sessionId} onChange={setSessionId} options={[{value:0, label:'All Accounts'}, ...sessions.map(s=>({value:s.id, label:s.session_name}))]} placeholder="Account" className="min-w-[200px]"/>
            <CustomSelect value={chatId} onChange={setChatId} options={[{value:'', label:'All Groups'}, ...groups.map(g=>({value:g.id, label:g.name}))]} placeholder="Group" className="min-w-[250px]"/>
            <div className="flex-1 relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18}/><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search content..." className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 pr-4 py-2 outline-none focus:ring-2 focus:ring-purple-500"/></div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
            {messages.map(msg => (
                <div key={msg.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <div className="flex justify-between mb-2 text-xs text-gray-400">
                        <span>{new Date(msg.message_date).toLocaleString()}</span>
                        <span>{msg.chat_name}</span>
                    </div>
                    <div className="font-medium text-blue-400 mb-1">{msg.sender_name}</div>
                    <div className="text-gray-200 whitespace-pre-wrap">{msg.content || <span className="italic text-gray-500">[{msg.media_type}]</span>}</div>
                </div>
            ))}
            {messages.length===0 && <div className="text-center text-gray-500 py-10">No messages found</div>}
        </div>
    </div>
  );
}