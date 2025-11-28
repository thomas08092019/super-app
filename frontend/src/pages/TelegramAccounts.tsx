import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Phone, Calendar } from 'lucide-react';
import { telegramAPI } from '../services/api';
import type { TelegramSession } from '../types';

export default function TelegramAccounts() {
  const [sessions, setSessions] = useState<TelegramSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loginStep, setLoginStep] = useState<'init' | 'otp' | '2fa'>('init');
  const [formData, setFormData] = useState({
    session_name: '',
    phone_number: '',
    api_id: '',
    api_hash: '',
    code: '',
    password: '',
  });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await telegramAPI.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    setIsSubmitting(true);
    try {
      await telegramAPI.sendCode({
        session_name: formData.session_name,
        phone_number: formData.phone_number,
        api_id: formData.api_id,
        api_hash: formData.api_hash,
      });
      setLoginStep('otp');
      alert('OTP sent to your phone!');
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail;
      if (Array.isArray(errorMsg)) {
        alert(errorMsg.map((e: any) => e.msg).join('\n'));
      } else {
        alert(errorMsg || 'Failed to send code');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    setIsSubmitting(true);
    try {
      const result = await telegramAPI.verifyCode({
        session_name: formData.session_name,
        code: formData.code,
      });

      if (result.requires_2fa) {
        setLoginStep('2fa');
        return;
      }

      await telegramAPI.createSession({
        session_name: formData.session_name,
        phone_number: formData.phone_number,
        api_id: formData.api_id,
        api_hash: formData.api_hash,
        session_string: result.session_string,
      });

      alert('Login successful!');
      setShowAddModal(false);
      loadSessions();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail;
      
      if (typeof errorMsg === 'string' && (errorMsg.includes('SESSION_PASSWORD_NEEDED') || errorMsg.includes('password is required'))) {
          setLoginStep('2fa');
          return;
      }

      if (Array.isArray(errorMsg)) {
        alert(errorMsg.map((e: any) => e.msg).join('\n'));
      } else {
        alert(errorMsg || 'Failed to verify code');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify2FA = async () => {
    setIsSubmitting(true);
    try {
      const result = await telegramAPI.verify2FA({
        session_name: formData.session_name,
        password: formData.password,
      });

      await telegramAPI.createSession({
        session_name: formData.session_name,
        phone_number: formData.phone_number,
        api_id: formData.api_id,
        api_hash: formData.api_hash,
        session_string: result.session_string,
      });

      alert('Login successful!');
      setShowAddModal(false);
      loadSessions();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail;
      if (Array.isArray(errorMsg)) {
        alert(errorMsg.map((e: any) => e.msg).join('\n'));
      } else {
        alert(errorMsg || 'Failed to verify 2FA');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to remove this account?')) return;

    try {
      await telegramAPI.deleteSession(sessionId);
      loadSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold mb-2">Telegram Accounts</h1>
          <p className="text-gray-400">Manage your Telegram sessions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus size={20} />
          Add Account
        </button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session, index) => (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gray-800/50 backdrop-blur-lg rounded-xl p-6 border border-gray-700 relative"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">{session.session_name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                <Phone size={16} />
                <span>{session.phone_number}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Calendar size={16} />
                <span>{new Date(session.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  session.is_active
                    ? 'bg-green-500/20 text-green-300'
                    : 'bg-gray-500/20 text-gray-300'
                }`}
              >
                {session.is_active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => handleDeleteSession(session.id)}
                className="p-2 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </motion.div>
        ))}

        {sessions.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <Phone size={48} className="mx-auto mb-4 opacity-50" />
            <p>No Telegram accounts connected yet</p>
            <p className="text-sm mt-2">Click "Add Account" to get started</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700"
          >
            <h2 className="text-2xl font-bold mb-4">Add Telegram Account</h2>

            {loginStep === 'init' && (
              <form onSubmit={(e) => { e.preventDefault(); handleSendCode(); }} className="space-y-4">
                <input
                  type="text"
                  placeholder="Session Name"
                  value={formData.session_name}
                  onChange={(e) =>
                    setFormData({ ...formData, session_name: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <input
                  type="tel"
                  placeholder="Phone Number (+1234567890)"
                  value={formData.phone_number}
                  onChange={(e) =>
                    setFormData({ ...formData, phone_number: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <input
                  type="text"
                  placeholder="API ID"
                  value={formData.api_id}
                  onChange={(e) => setFormData({ ...formData, api_id: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <input
                  type="text"
                  placeholder="API Hash"
                  value={formData.api_hash}
                  onChange={(e) => setFormData({ ...formData, api_hash: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Send Code"
                  )}
                </button>
              </form>
            )}

            {loginStep === 'otp' && (
              <form onSubmit={(e) => { e.preventDefault(); handleVerifyCode(); }} className="space-y-4">
                <p className="text-gray-400 text-sm">
                  Enter the OTP code sent to your phone
                </p>
                <input
                  type="text"
                  placeholder="OTP Code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Verify Code"
                  )}
                </button>
              </form>
            )}

            {loginStep === '2fa' && (
              <form onSubmit={(e) => { e.preventDefault(); handleVerify2FA(); }} className="space-y-4">
                <p className="text-gray-400 text-sm">Enter your 2FA password</p>
                <input
                  type="password"
                  placeholder="2FA Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Verify 2FA"
                  )}
                </button>
              </form>
            )}

            <button
              onClick={() => {
                setShowAddModal(false);
                setLoginStep('init');
              }}
              disabled={isSubmitting}
              className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}