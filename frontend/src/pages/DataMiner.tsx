import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Database } from 'lucide-react';
import Downloader from './Downloader';
import MessageDumper from './MessageDumper';

export default function DataMiner() {
  const [activeTab, setActiveTab] = useState<'media' | 'message'>('media');

  return (
    <div className="p-8 h-screen flex flex-col bg-gray-900 text-white">
      {/* Header Title - Giữ lại tiêu đề chính của trang nhưng làm gọn hơn */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-6">
             <h1 className="text-3xl font-bold flex items-center gap-3 text-white">
                <Database className="text-purple-500" /> Data Miner
             </h1>
             
             {/* Tabs Navigation */}
             <div className="flex bg-gray-800/50 p-1 rounded-lg border border-gray-700">
                 <button
                    onClick={() => setActiveTab('media')}
                    className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${
                        activeTab === 'media' 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                 >
                    <Download size={16} /> Media Downloader
                 </button>
                 
                 <button
                    onClick={() => setActiveTab('message')}
                    className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${
                        activeTab === 'message' 
                        ? 'bg-purple-600 text-white shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                 >
                    <Database size={16} /> Message Dumper
                 </button>
             </div>
          </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full"
        >
            {activeTab === 'media' ? <Downloader /> : <MessageDumper />}
        </motion.div>
      </div>
    </div>
  );
}