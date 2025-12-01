import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Trophy, CheckCircle, XCircle, RotateCcw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { academyAPI } from '../../services/api';
import type { QuizQuestion, QuizSubmissionDetail } from '../../types';

export default function Quiz() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<QuizSubmissionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    loadQuiz();
  }, []);

  const loadQuiz = async () => {
    setLoading(true);
    setIsFinished(false);
    setAnswers([]);
    setCurrentIdx(0);
    setScore(0);
    try {
      const data = await academyAPI.getQuiz('hiragana', 10);
      setQuestions(data);
    } catch (error) {
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
      question_content: `Character: ${currentQ.question_char}`,
      user_answer: option,
      is_correct: isCorrect
    };

    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);

    setTimeout(() => {
      setShowFeedback(null);
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(prev => prev + 1);
      } else {
        finishQuiz(newAnswers);
      }
    }, 800);
  };

  const finishQuiz = async (finalAnswers: QuizSubmissionDetail[]) => {
    setIsFinished(true);
    try {
      await academyAPI.submitQuiz({ details: finalAnswers });
    } catch (error) {
      console.error("Failed to save result", error);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;

  // --- RESULT VIEW ---
  if (isFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-800 rounded-2xl p-10 border border-gray-700 text-center max-w-lg w-full shadow-2xl">
          <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-yellow-500 border border-yellow-500/50">
            <Trophy size={48} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Quiz Completed!</h2>
          <p className="text-gray-400 mb-8">You scored {score} out of {questions.length}</p>
          
          <div className="text-6xl font-bold text-white mb-8">{percentage}%</div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => navigate('/academy')} className="flex items-center justify-center gap-2 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-bold transition-colors">
                <Home size={20} /> Dashboard
            </button>
            <button onClick={loadQuiz} className="flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-bold transition-colors shadow-lg shadow-indigo-900/20">
                <RotateCcw size={20} /> Retry
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- QUESTION VIEW ---
  const question = questions[currentIdx];
  const progress = ((currentIdx) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col justify-center p-8">
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Question {currentIdx + 1} / {questions.length}</span>
            <span>{score} Correct</span>
        </div>
        <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden border border-gray-700">
            <motion.div 
                className="bg-indigo-500 h-full" 
                initial={{ width: 0 }} 
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
            />
        </div>
      </div>

      <motion.div 
        key={currentIdx}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-10 border border-gray-700 text-center shadow-xl mb-8"
      >
        <h3 className="text-gray-400 text-sm uppercase tracking-widest font-semibold mb-6">What is this character?</h3>
        <div className="text-9xl font-bold text-white mb-4">{question.question_char}</div>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        {question.options.map((opt, idx) => {
            const isSelected = showFeedback && (opt === question.correct_answer || answers[answers.length-1]?.user_answer === opt);
            let btnClass = "bg-gray-800 hover:bg-gray-700 border-gray-600";
            
            if (showFeedback) {
                if (opt === question.correct_answer) btnClass = "bg-green-600 border-green-500 text-white";
                else if (isSelected && opt !== question.correct_answer) btnClass = "bg-red-600 border-red-500 text-white";
                else btnClass = "bg-gray-800 opacity-50";
            }

            return (
                <button
                    key={idx}
                    onClick={() => handleAnswer(opt)}
                    disabled={!!showFeedback}
                    className={`p-6 rounded-xl text-2xl font-bold border-2 transition-all transform active:scale-95 ${btnClass} text-white shadow-lg`}
                >
                    {opt}
                </button>
            )
        })}
      </div>
      
      <div className="mt-8 text-center">
        <button onClick={() => navigate('/academy')} className="text-gray-500 hover:text-gray-300 text-sm flex items-center justify-center gap-2 mx-auto">
            <ChevronLeft size={16}/> Quit Quiz
        </button>
      </div>
    </div>
  );
}