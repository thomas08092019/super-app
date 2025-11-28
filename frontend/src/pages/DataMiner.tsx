import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Database } from 'lucide-react';
import Downloader from './Downloader';
import MessageDumper from './MessageDumper';

export default function DataMiner() {
  const [activeTab, setActiveTab] = useState<'media' | 'message'>('media');

  return (
    <div className="p-8 h-screen flex flex-col">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3"><Database className="text-purple-500" /> Data Miner</h1>
        <p className="text-gray-400">Download Media & Dump Message History</p>
      </motion.div>

      <div className="flex gap-4 border-b border-gray-700 mb-6">
        <button onClick={() => setActiveTab('media')} className={`px-4 py-2 font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'media' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}><Download size={18} /> Media Downloader</button>
        <button onClick={() => setActiveTab('message')} className={`px-4 py-2 font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'message' ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-400 hover:text-white'}`}><Database size={18} /> Message Dumper</button>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'media' ? <Downloader /> : <MessageDumper />}
      </div>
    </div>
  );
}