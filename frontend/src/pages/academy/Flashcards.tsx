import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { academyAPI } from '../../services/api';
import type { JapaneseCharacter } from '../../types';

// Định nghĩa thứ tự chuẩn của bảng chữ cái Nhật (Full)
const ROW_ORDER = [
  // Basic
  'a', 'ka', 'sa', 'ta', 'na', 'ha', 'ma', 'ya', 'ra', 'wa', 'n',
  // Dakuon (Âm đục)
  'ga', 'za', 'da', 'ba',
  // Handakuon (Âm bán đục)
  'pa',
  // Yoon (Âm ghép)
  'kya', 'sha', 'cha', 'nya', 'hya', 'mya', 'rya',
  // Yoon Dakuon (Âm ghép đục)
  'gya', 'ja', 'bya',
  // Yoon Handakuon (Âm ghép bán đục)
  'pya'
];

export default function Flashcards() {
  const navigate = useNavigate();
  const [type, setType] = useState<'hiragana' | 'katakana'>('hiragana');
  const [chars, setChars] = useState<JapaneseCharacter[]>([]);
  const [flipped, setFlipped] = useState<{[key: number]: boolean}>({});
  const [loading, setLoading] = useState(true);
  
  // Ref để điều khiển thanh cuộn
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChars();
    setFlipped({});
  }, [type]);

  // Reset scroll lên đầu khi chuyển loại bảng chữ cái (Hiragana <-> Katakana)
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [type, chars]);

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

  // Nhóm các ký tự theo group_name
  const groupedChars = chars.reduce((acc, char) => {
    const group = char.group_name || 'others';
    if (!acc[group]) acc[group] = [];
    acc[group].push(char);
    return acc;
  }, {} as Record<string, JapaneseCharacter[]>);

  const getGroupTitle = (group: string) => {
      if (group === 'n') return 'N';
      if (['ga', 'za', 'da', 'ba'].includes(group)) return `${group.toUpperCase()} (Dakuon)`;
      if (group === 'pa') return 'PA (Handakuon)';
      if (['kya', 'sha', 'cha', 'nya', 'hya', 'mya', 'rya'].includes(group)) return `${group.toUpperCase()} (Yoon)`;
      if (['gya', 'ja', 'bya'].includes(group)) return `${group.toUpperCase()} (Dakuon Yoon)`;
      if (group === 'pya') return 'PYA (Handakuon Yoon)';
      return `${group.toUpperCase()}-Row`;
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-8 flex-shrink-0">
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
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto custom-scrollbar pb-20 pr-4 space-y-10"
        >
          {ROW_ORDER.map((groupName) => {
            const groupChars = groupedChars[groupName];
            if (!groupChars || groupChars.length === 0) return null;

            return (
              <div key={groupName}>
                {/* Tiêu đề hàng */}
                <h3 className="text-gray-500 text-sm font-bold uppercase mb-4 ml-1 opacity-50 tracking-widest border-b border-gray-800 pb-2">
                  {getGroupTitle(groupName)}
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {groupChars.map((char) => (
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}