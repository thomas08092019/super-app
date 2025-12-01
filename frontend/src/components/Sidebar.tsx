import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, MessageSquare, Bot, Database, Search, Radio, 
  ChevronDown, ChevronRight, LogOut, Menu, Folder, Archive, BookOpen, 
  Brain, Zap, Languages 
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
      { name: 'User Management', path: '/admin/users', icon: Users, adminOnly: true }
    ] 
  },
  { 
    name: 'Telegram', 
    icon: MessageSquare, 
    children: [
      { name: 'Accounts', path: '/telegram/accounts', icon: Users },
      { name: 'Live Feed', path: '/telegram/feed', icon: Radio },
      { name: 'AI Summary', path: '/telegram/summary', icon: Bot },
      { name: 'Data Miner', path: '/telegram/downloader', icon: Database },
      { name: 'Dump Manager', path: '/telegram/dumps', icon: Archive },
      { name: 'File Manager', path: '/telegram/files', icon: Folder },
      { name: 'OSINT Tools', path: '/telegram/osint', icon: Search },
      { name: 'Broadcaster', path: '/telegram/broadcast', icon: Radio },
    ] 
  },
  { 
    name: 'Academy', 
    icon: BookOpen, 
    children: [
      {
        name: 'Japanese',
        icon: Languages,
        children: [
          { name: 'Dashboard', path: '/academy', icon: LayoutDashboard },
          { name: 'Flashcards', path: '/academy/learn', icon: Brain },
          { name: 'Question', path: '/academy/quiz', icon: Zap },
        ]
      }
    ]
  }
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [expanded, setExpanded] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sidebar_expanded');
      return saved ? JSON.parse(saved) : ['System', 'Telegram', 'Academy', 'Japanese'];
    } catch {
      return ['System', 'Telegram', 'Academy', 'Japanese'];
    }
  });
  
  const location = useLocation();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const handleResize = () => setIsOpen(window.innerWidth >= 1024);
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar_expanded', JSON.stringify(expanded));
  }, [expanded]);

  const toggle = (name: string) => {
    setExpanded(prev => prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]);
  };

  const isActive = (path?: string) => location.pathname === path;
  const isAdmin = user?.role === 'admin';

  const renderMenuItem = (item: MenuItem) => {
    if (item.adminOnly && !isAdmin) return null;

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expanded.includes(item.name);

    if (hasChildren) {
      return (
        <div key={item.name}>
          <button 
            onClick={() => toggle(item.name)} 
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon size={20} className="text-gray-400" />
              <span className="font-medium text-gray-200">{item.name}</span>
            </div>
            {isExpanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
          </button>
          <AnimatePresence>
            {isExpanded && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }} 
                className="overflow-hidden"
              >
                <div className="ml-4 mt-1 space-y-1 border-l border-gray-800 pl-1">
                  {item.children!.map(child => renderMenuItem(child))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <Link 
        key={item.path || item.name} 
        to={item.path || '#'} 
        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${isActive(item.path) ? 'bg-blue-600 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}
      >
        <item.icon size={18} />
        <span className="text-sm">{item.name}</span>
      </Link>
    );
  };

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="fixed top-4 left-4 z-50 lg:hidden bg-gray-800 p-2 rounded-lg text-white hover:bg-gray-700"><Menu size={24} /></button>
      <motion.aside initial={false} animate={{ x: isOpen ? 0 : -300 }} className="fixed left-0 top-0 h-screen w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-40">
        <div className="p-6 border-b border-gray-800"><h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Super App</h1><p className="text-sm text-gray-400 mt-1">Telegram OSINT Center</p></div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {menuItems.map(item => renderMenuItem(item))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-semibold text-white">{user?.email?.[0].toUpperCase()}</div><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate text-white">{user?.email}</p><p className="text-xs text-gray-400 capitalize">{user?.role}</p></div></div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white"><LogOut size={18} /><span>Logout</span></button>
        </div>
      </motion.aside>
      {isOpen && <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/50 z-30 lg:hidden" />}
    </>
  );
}