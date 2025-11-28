/**
 * Main App component with routing
 */
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
import Downloader from './pages/Downloader';
import OSINT from './pages/OSINT';
import Broadcaster from './pages/Broadcaster';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// Admin-only route wrapper
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Layout with sidebar
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex-1 lg:ml-64">{children}</main>
    </div>
  );
}

function App() {
  const { initAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initAuth();
    setIsLoading(false);
  }, [initAuth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        {/* Admin routes */}
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <Layout>
                <UserManagement />
              </Layout>
            </AdminRoute>
          }
        />
        
        {/* Telegram routes */}
        <Route
          path="/telegram/accounts"
          element={
            <ProtectedRoute>
              <Layout>
                <TelegramAccounts />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/telegram/feed"
          element={
            <ProtectedRoute>
              <Layout>
                <LiveFeed />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/telegram/summary"
          element={
            <ProtectedRoute>
              <Layout>
                <AISummary />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/telegram/downloader"
          element={
            <ProtectedRoute>
              <Layout>
                <Downloader />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/telegram/osint"
          element={
            <ProtectedRoute>
              <Layout>
                <OSINT />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/telegram/broadcast"
          element={
            <ProtectedRoute>
              <Layout>
                <Broadcaster />
              </Layout>
            </ProtectedRoute>
          }
        />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

