import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Trophy, Settings, Play, CheckCircle, XCircle, Home, RotateCcw, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { academyAPI } from '../../services/api';
import type { QuizQuestion, QuizSubmissionDetail } from '../../types';

type QuizMode = 'character' | 'sentence';
type Direction = 'jp_to_ro' | 'ro_to_jp';

export default function Quiz() {
  const navigate = useNavigate();
  
  // --- STATES ---
  const [step, setStep] = useState<'setup' | 'quiz' | 'result'>('setup');
  const [loading, setLoading] = useState(false);
  
  // Setup States
  const [quizMode, setQuizMode] = useState<QuizMode>('character');
  const [alphabets, setAlphabets] = useState<string[]>(['hiragana']);
  const [direction, setDirection] = useState<Direction>('jp_to_ro');
  const [count, setCount] = useState<string>('10'); // '10', '20', 'all'

  // Quiz States
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<QuizSubmissionDetail[]>([]);
  const [score, setScore] = useState(0);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);

  // --- ACTIONS ---

  const handleStartQuiz = async () => {
    setLoading(true);
    try {
      let data: QuizQuestion[] = [];
      const limit = count === 'all' ? -1 : parseInt(count);

      if (quizMode === 'character') {
        data = await academyAPI.getCharacterQuiz(alphabets, direction, limit);
      } else {
        data = await academyAPI.getSentenceQuiz(limit, direction);
      }
      
      setQuestions(data);
      setCurrentIdx(0);
      setScore(0);
      setAnswers([]);
      setStep('quiz');
    } catch (error) {
      alert('Failed to generate quiz. Please check settings or connection.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (option: string) => {
    if (showFeedback) return;

    const currentQ = questions[currentIdx];
    const isCorrect = option === currentQ.correct_answer;
    
    setShowFeedback(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setScore(s => s + 1);

    const newAnswer: QuizSubmissionDetail = {
      question_content: `${currentQ.question_text} ${currentQ.question_subtext ? `(${currentQ.question_subtext})` : ''}`,
      user_answer: option,
      correct_answer: currentQ.correct_answer,
      is_correct: isCorrect
    };

    setAnswers([...answers, newAnswer]);

    setTimeout(() => {
      setShowFeedback(null);
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(prev => prev + 1);
      } else {
        finishQuiz([...answers, newAnswer]);
      }
    }, 1000);
  };

  const finishQuiz = async (finalAnswers: QuizSubmissionDetail[]) => {
    setStep('result');
    try {
      await academyAPI.submitQuiz({ 
        quiz_type: quizMode,
        details: finalAnswers 
      });
    } catch (error) {
      console.error("Failed to save result", error);
    }
  };

  // --- RENDERERS ---

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400 animate-pulse">Generating Quiz...</p>
    </div>
  );

  // 1. SETUP SCREEN
  if (step === 'setup') {
    return (
      <div className="max-w-2xl mx-auto h-full flex flex-col justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-2xl p-8 border border-gray-700 shadow-xl">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-700 pb-4">
            <Settings className="text-indigo-500" size={28} />
            <h1 className="text-2xl font-bold text-white">Configure Quiz</h1>
          </div>

          <div className="space-y-6">
            {/* Mode Selection */}
            <div>
              <label className="block text-gray-400 text-sm mb-2 uppercase font-bold tracking-wider">Quiz Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setQuizMode('character')} className={`p-4 rounded-xl border-2 transition-all ${quizMode === 'character' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'}`}>
                  <div className="font-bold text-lg mb-1">Alphabet</div>
                  <div className="text-xs opacity-70">Hiragana / Katakana</div>
                </button>
                <button onClick={() => setQuizMode('sentence')} className={`p-4 rounded-xl border-2 transition-all ${quizMode === 'sentence' ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'}`}>
                  <div className="font-bold text-lg mb-1">Sentence</div>
                  <div className="text-xs opacity-70">Vocabulary & Context</div>
                </button>
              </div>
            </div>

            {/* Alphabet Selection (Only for Character Mode) */}
            {quizMode === 'character' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <label className="block text-gray-400 text-sm mb-2 uppercase font-bold tracking-wider">Alphabets</label>
                <div className="flex gap-4">
                  {['hiragana', 'katakana'].map(a => (
                    <label key={a} className="flex items-center gap-3 cursor-pointer bg-gray-900 p-3 rounded-lg border border-gray-700 hover:border-indigo-500 transition-all flex-1">
                      <input 
                        type="checkbox" 
                        checked={alphabets.includes(a)} 
                        onChange={() => setAlphabets(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])}
                        className="w-5 h-5 rounded border-gray-600 text-indigo-600 focus:ring-0 bg-gray-800"
                      />
                      <span className="capitalize font-medium text-white">{a}</span>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Direction */}
            <div>
              <label className="block text-gray-400 text-sm mb-2 uppercase font-bold tracking-wider">Direction</label>
              <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700">
                <button onClick={() => setDirection('jp_to_ro')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${direction === 'jp_to_ro' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                  Japanese → Romaji
                </button>
                <button onClick={() => setDirection('ro_to_jp')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${direction === 'ro_to_jp' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
                  Romaji → Japanese
                </button>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-gray-400 text-sm mb-2 uppercase font-bold tracking-wider">Number of Questions</label>
              <div className="grid grid-cols-4 gap-2">
                {['10', '20', '50', 'all'].map(v => (
                  <button 
                    key={v} 
                    onClick={() => setCount(v)}
                    className={`py-2 rounded-lg border transition-all ${count === v ? 'bg-white text-black border-white font-bold' : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'}`}
                  >
                    {v === 'all' ? 'All' : v}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={handleStartQuiz} 
              disabled={quizMode === 'character' && alphabets.length === 0}
              className="w-full mt-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl font-bold text-white text-lg shadow-lg flex items-center justify-center gap-2 transition-transform transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={24} fill="currentColor" /> Start Quiz
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. RESULT SCREEN
  if (step === 'result') {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 overflow-y-auto">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-800 rounded-2xl p-8 border border-gray-700 text-center max-w-4xl w-full shadow-2xl">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-500 border border-yellow-500/50">
            <Trophy size={40} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Quiz Completed!</h2>
          <p className="text-gray-400 mb-6">Score: <span className="text-white font-bold">{score}</span> / {questions.length} ({percentage}%)</p>
          
          {/* MISTAKES SUMMARY */}
          {answers.some(a => !a.is_correct) && (
            <div className="mb-8 text-left bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 max-h-60 overflow-y-auto custom-scrollbar">
              <h3 className="text-sm font-bold text-red-400 mb-3 uppercase tracking-wider sticky top-0 bg-gray-900/95 py-1">Mistakes Review</h3>
              <div className="space-y-2">
                {answers.filter(a => !a.is_correct).map((a, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-gray-800 rounded border border-red-900/30">
                    <div>
                      <div className="font-bold text-white">{a.question_content}</div>
                      <div className="text-xs text-red-400">You: {a.user_answer}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Correct</div>
                      <div className="text-sm text-green-400 font-bold">{a.correct_answer}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => navigate('/academy')} className="flex items-center justify-center gap-2 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-bold transition-colors">
                <Home size={20} /> Dashboard
            </button>
            <button onClick={() => setStep('setup')} className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-bold transition-colors shadow-lg">
                <RotateCcw size={20} /> New Quiz
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 3. QUIZ SCREEN
  const question = questions[currentIdx];
  const progress = ((currentIdx) / questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col justify-center p-6">
      {/* Header Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-end text-sm text-gray-400 mb-2">
            <div className="flex items-center gap-2">
                <button onClick={() => setStep('setup')} className="hover:text-white transition-colors"><ChevronLeft size={20}/></button>
                <span className="font-medium text-white">Q{currentIdx + 1}</span> of {questions.length}
            </div>
            <div className="font-mono">{score} Correct</div>
        </div>
        <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden border border-gray-700">
            <motion.div 
                className="bg-indigo-500 h-full" 
                initial={{ width: 0 }} 
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
            />
        </div>
      </div>

      {/* Question Card */}
      <motion.div 
        key={currentIdx}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-10 border border-gray-700 text-center shadow-xl mb-8 min-h-[200px] flex flex-col items-center justify-center relative overflow-hidden"
      >
        <h3 className="text-gray-500 text-xs uppercase tracking-widest font-bold mb-4 absolute top-6">
            {quizMode === 'sentence' ? 'Translate this' : 'Identify Character'}
        </h3>
        
        <div className="text-5xl md:text-6xl font-bold text-white mb-4 break-words max-w-full">
            {question.question_text}
        </div>
        
        {/* Vietnamese Hint for Romaji in Sentence Mode */}
        {question.question_subtext && (
            <div className="text-lg text-indigo-300 font-medium mt-2 bg-indigo-900/30 px-4 py-1 rounded-full border border-indigo-500/30">
                {question.question_subtext}
            </div>
        )}
      </motion.div>

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {question.options.map((opt, idx) => {
            const isSelected = showFeedback && (opt === question.correct_answer || (answers[answers.length] && answers[answers.length].user_answer === opt)); // This check logic is tricky with async state, simplified below
            
            let btnClass = "bg-gray-800 hover:bg-gray-700 border-gray-600 hover:border-gray-500";
            let icon = null;
            
            if (showFeedback) {
                if (opt === question.correct_answer) {
                    btnClass = "bg-green-600/20 border-green-500 text-green-100";
                    icon = <CheckCircle size={20} className="text-green-400" />;
                } else if (opt !== question.correct_answer) {
                    btnClass = "bg-gray-800 opacity-40 border-transparent";
                }
                // Highlight wrong selection
                // Note: Implementing exact user selection highlight requires local state per question or passing it. 
                // For simplicity, we just highlight correct. If user clicked wrong, they see correct green one.
            }

            return (
                <button
                    key={idx}
                    onClick={() => handleAnswer(opt)}
                    disabled={!!showFeedback}
                    className={`p-5 rounded-xl text-lg font-bold border-2 transition-all transform active:scale-[0.98] ${btnClass} text-white shadow-lg flex items-center justify-between group`}
                >
                    <span className="truncate">{opt}</span>
                    {icon}
                </button>
            )
        })}
      </div>
    </div>
  );
}