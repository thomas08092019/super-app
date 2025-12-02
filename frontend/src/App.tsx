import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import TelegramAccounts from './pages/TelegramAccounts';
import LiveFeed from './pages/LiveFeed';
import AISummary from './pages/AISummary';
import DataMiner from './pages/DataMiner';
import FileManager from './pages/FileManager';
import OSINT from './pages/OSINT';
import Broadcaster from './pages/Broadcaster';
import MessageDumpManager from './pages/MessageDumpManager';

// --- ACADEMY IMPORTS ---
import AcademyDashboard from './pages/academy/AcademyDashboard';
import Flashcards from './pages/academy/Flashcards';
import Quiz from './pages/academy/Quiz';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen bg-gray-900 text-white overflow-hidden"><Sidebar /><main className="flex-1 lg:ml-64 h-full overflow-hidden">{children}</main></div>;
}

function App() {
  const { initAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { initAuth(); setIsLoading(false); }, [initAuth]);

  if (isLoading) return <div className="flex items-center justify-center h-screen bg-gray-900"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* System & Telegram Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/admin/users" element={<AdminRoute><Layout><UserManagement /></Layout></AdminRoute>} />
        <Route path="/telegram/accounts" element={<ProtectedRoute><Layout><TelegramAccounts /></Layout></ProtectedRoute>} />
        <Route path="/telegram/feed" element={<ProtectedRoute><Layout><LiveFeed /></Layout></ProtectedRoute>} />
        <Route path="/telegram/downloader" element={<ProtectedRoute><Layout><DataMiner /></Layout></ProtectedRoute>} />
        <Route path="/telegram/files" element={<ProtectedRoute><Layout><FileManager /></Layout></ProtectedRoute>} />
        <Route path="/telegram/dumps" element={<ProtectedRoute><Layout><MessageDumpManager /></Layout></ProtectedRoute>} />
        <Route path="/telegram/osint" element={<ProtectedRoute><Layout><OSINT /></Layout></ProtectedRoute>} />
        <Route path="/telegram/broadcast" element={<ProtectedRoute><Layout><Broadcaster /></Layout></ProtectedRoute>} />
        
        {/* --- ACADEMY ROUTES --- */}
        <Route path="/academy" element={<ProtectedRoute><Layout><AcademyDashboard /></Layout></ProtectedRoute>} />
        <Route path="/academy/learn" element={<ProtectedRoute><Layout><Flashcards /></Layout></ProtectedRoute>} />
        <Route path="/academy/quiz" element={<ProtectedRoute><Layout><Quiz /></Layout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;