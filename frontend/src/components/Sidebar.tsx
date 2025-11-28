/**
 * Collapsible sidebar navigation component
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Bot,
  Database,
  Search,
  Radio,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface MenuItem {
  name: string;
  path?: string;
  icon: any;
  children?: MenuItem[];
  adminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  {
    name: 'System',
    icon: LayoutDashboard,
    children: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'User Management', path: '/admin/users', icon: Users, adminOnly: true },
    ],
  },
  {
    name: 'Telegram',
    icon: MessageSquare,
    children: [
      { name: 'Accounts', path: '/telegram/accounts', icon: Users },
      { name: 'Live Feed', path: '/telegram/feed', icon: Radio },
      { name: 'AI Summary', path: '/telegram/summary', icon: Bot },
      { name: 'Data Miner', path: '/telegram/downloader', icon: Database },
      { name: 'OSINT Tools', path: '/telegram/osint', icon: Search },
      { name: 'Broadcaster', path: '/telegram/broadcast', icon: Radio },
    ],
  },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedItems, setExpandedItems] = useState<string[]>(['System', 'Telegram']);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const toggleExpand = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path;
  };

  const isAdmin = user?.role === 'admin';

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-gray-800 p-2 rounded-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: isOpen ? 0 : -300 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 h-screen w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-40"
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Super App
          </h1>
          <p className="text-sm text-gray-400 mt-1">Telegram OSINT Center</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {menuItems.map((item) => (
            <div key={item.name}>
              {/* Parent item */}
              <button
                onClick={() => toggleExpand(item.name)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon size={20} className="text-gray-400" />
                  <span className="font-medium">{item.name}</span>
                </div>
                {expandedItems.includes(item.name) ? (
                  <ChevronDown size={18} className="text-gray-400" />
                ) : (
                  <ChevronRight size={18} className="text-gray-400" />
                )}
              </button>

              {/* Children */}
              <AnimatePresence>
                {expandedItems.includes(item.name) && item.children && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 mt-1 space-y-1">
                      {item.children.map((child) => {
                        // Skip admin-only items for non-admin users
                        if (child.adminOnly && !isAdmin) return null;

                        return (
                          <Link
                            key={child.path}
                            to={child.path || '#'}
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                              isActive(child.path)
                                ? 'bg-blue-600 text-white'
                                : 'hover:bg-gray-800 text-gray-300'
                            }`}
                          >
                            <child.icon size={18} />
                            <span className="text-sm">{child.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-semibold">
              {user?.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </motion.aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
        />
      )}
    </>
  );
}

