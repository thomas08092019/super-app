/**
 * Live Feed page - Real-time message stream
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, User, MessageSquare } from 'lucide-react';
import type { Message } from '../types';

export default function LiveFeed() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);

  return (
    <div className="p-8 h-screen flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Radio className={connected ? 'text-green-500 animate-pulse' : 'text-gray-500'} />
            Live Message Feed
          </h1>
          <p className="text-gray-400">Real-time Telegram message stream</p>
        </div>
        <span
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            connected
              ? 'bg-green-500/20 text-green-300'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 bg-gray-800/50 backdrop-blur-lg rounded-xl border border-gray-700 overflow-hidden flex flex-col"
      >
        {/* Messages container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <MessageSquare size={64} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No messages yet</p>
                <p className="text-sm mt-2">
                  Connect a Telegram account to start receiving messages
                </p>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-700/50 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <User size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {message.sender_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-400">
                        in {message.chat_name || message.chat_id}
                      </span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-400">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-gray-300">{message.content || '[Media]'}</p>
                    {message.media_type && (
                      <span className="inline-block mt-2 px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                        {message.media_type}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

