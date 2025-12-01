export interface User {
  id: number;
  username?: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'banned';
  created_at: string;
}

export interface LoginRequest { email: string; password: string; }
export interface TokenResponse { access_token: string; token_type: string; user: User; }

export interface TelegramSession {
  id: number;
  session_name: string;
  phone_number: string;
  is_active: boolean;
  created_at: string;
}

export interface JapaneseCharacter {
  id: number;
  character: string;
  romaji: string;
  type: 'hiragana' | 'katakana';
  group_name: string;
}

export interface QuizQuestion {
  id?: number;
  question_text: string;
  question_subtext?: string;
  options: string[];
  correct_answer: string;
  type: string;
}

export interface QuizSubmissionDetail {
  question_content: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
}

export interface QuizSubmission {
  quiz_type: string;
  details: QuizSubmissionDetail[];
}

export interface AcademyStats {
  total_sessions: number;
  total_questions_answered: number;
  average_accuracy: number;
  recent_history: {
    id: number;
    date: string;
    score: string;
    mode: string;
  }[];
}

export interface MistakeDetail {
    question: string;
    user_answer: string;
    correct_answer: string;
    is_correct: boolean;
}