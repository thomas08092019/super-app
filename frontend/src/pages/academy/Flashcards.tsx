import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { academyAPI } from '../../services/api';
import type { JapaneseCharacter } from '../../types';

export default function Flashcards() {
  const navigate = useNavigate();
  const [type, setType] = useState<'hiragana' | 'katakana'>('hiragana');
  const [chars, setChars] = useState<JapaneseCharacter[]>([]);
  const [flipped, setFlipped] = useState<{[key: number]: boolean}>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChars();
    setFlipped({});
  }, [type]);

  const loadChars = async () => {
    setLoading(true);
    try {
      const data = await academyAPI.getCharacters(type);
      setChars(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFlip = (id: number) => {
    setFlipped(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/academy')} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors">
                <ChevronLeft size={24} />
            </button>
            <h1 className="text-3xl font-bold text-white">Flashcards</h1>
        </div>
        
        <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
          {['hiragana', 'katakana'].map(t => (
            <button
              key={t}
              onClick={() => setType(t as any)}
              className={`px-6 py-2 rounded-md text-sm font-bold capitalize transition-all ${
                type === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 overflow-y-auto custom-scrollbar pb-10">
          {chars.map((char) => (
            <div 
              key={char.id}
              onClick={() => toggleFlip(char.id)}
              className="aspect-square cursor-pointer group perspective-1000"
            >
              <motion.div 
                initial={false}
                animate={{ rotateY: flipped[char.id] ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring" }}
                className="relative w-full h-full preserve-3d"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Front */}
                <div className="absolute w-full h-full bg-gray-800 border-2 border-gray-700 rounded-2xl flex flex-col items-center justify-center backface-hidden group-hover:border-indigo-500/50 shadow-xl transition-colors" style={{ backfaceVisibility: 'hidden' }}>
                  <span className="text-5xl font-bold text-white mb-2">{char.character}</span>
                  <span className="text-xs text-gray-500 uppercase">{char.group_name}</span>
                </div>
                {/* Back */}
                <div className="absolute w-full h-full bg-indigo-600 rounded-2xl flex items-center justify-center backface-hidden rotate-y-180 shadow-xl border-2 border-indigo-400" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <span className="text-4xl font-bold text-white">{char.romaji}</span>
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}