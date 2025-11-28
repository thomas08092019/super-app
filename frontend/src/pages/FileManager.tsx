import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, File, FileText, Image as ImageIcon, 
  Video, Trash2, Eye, Download, X, FileSpreadsheet, Music, Archive,
  Search, Filter, ChevronLeft, ChevronRight, RefreshCw, Users, AlertCircle
} from 'lucide-react';
import { storageAPI } from '../services/api';

interface FileObject {
  id: number;
  name: string;
  file_name: string;
  chat_id: string;
  chat_name: string;
  size: number;
  last_modified: string;
  url: string;
  type: string;
}

interface GroupOption {
  id: string;
  name: string;
}

export default function FileManager() {
  const [files, setFiles] = useState<FileObject[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedType, setSelectedType] = useState('');
  
  const [previewFile, setPreviewFile] = useState<FileObject | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => {
    loadFiles();
  }, [page, selectedGroup, selectedType]);

  const loadFiles = async (searchTerm = search) => {
    setLoading(true);
    try {
      const data = await storageAPI.listFiles({
        page,
        limit: 20,
        search: searchTerm,
        chat_id: selectedGroup,
        file_type: selectedType
      });
      setFiles(data.files);
      setTotalPages(data.total_pages);
      setGroups(data.groups);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadFiles(search);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await storageAPI.deleteFile(id);
      loadFiles();
    } catch (error) {
      alert('Failed to delete file');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return <ImageIcon className="text-blue-400" />;
    if (['mp4','mov','avi','mkv','webm'].includes(ext)) return <Video className="text-purple-400" />;
    if (['mp3','wav','ogg','flac','m4a'].includes(ext)) return <Music className="text-pink-400" />;
    if (['zip','rar','7z','tar','gz'].includes(ext)) return <Archive className="text-yellow-400" />;
    if (['pdf'].includes(ext)) return <FileText className="text-red-400" />;
    if (['xls','xlsx','csv'].includes(ext)) return <FileSpreadsheet className="text-green-400" />;
    return <File className="text-gray-400" />;
  };

  const handlePreview = async (file: FileObject) => {
    const ext = file.file_name.split('.').pop()?.toLowerCase();
    if (['txt', 'csv', 'log', 'json', 'md'].includes(ext || '')) {
      try {
        const response = await fetch(file.url);
        const text = await response.text();
        setPreviewContent(text);
      } catch (e) {
        setPreviewContent('Error loading content');
      }
    } else {
      setPreviewContent(null);
    }
    setPreviewFile(file);
  };

  const renderPreviewContent = (file: FileObject) => {
    const ext = file.file_name.split('.').pop()?.toLowerCase() || '';

    if (previewContent !== null) {
      return (
        <div className="bg-gray-900 p-4 rounded-lg overflow-auto max-h-[70vh] w-full font-mono text-sm whitespace-pre-wrap text-left text-gray-300">
          {previewContent}
        </div>
      );
    }

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
      return (
        <img 
          src={file.url} 
          alt={file.file_name} 
          className="max-w-full max-h-[75vh] rounded mx-auto object-contain shadow-lg" 
        />
      );
    }

    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
      return (
        <div className="flex flex-col items-center w-full">
            <video 
              src={file.url} 
              controls 
              autoPlay
              muted
              playsInline
              className="max-w-full max-h-[70vh] rounded mx-auto shadow-lg bg-black"
            >
              Your browser does not support the video tag.
            </video>
            <div className="mt-4 flex items-center gap-2 text-sm text-yellow-500 bg-yellow-500/10 px-4 py-2 rounded-lg border border-yellow-500/20">
                <AlertCircle size={16} />
                <span>
                    Video black? Format (HEVC) may be unsupported. 
                    <a href={file.url} download className="text-blue-400 hover:underline ml-1 font-bold">Download to watch</a>
                </span>
            </div>
        </div>
      );
    }

    if (['mp3', 'wav', 'flac', 'm4a', 'ogg'].includes(ext)) {
        return (
            <div className="bg-gray-900 p-10 rounded-lg flex flex-col items-center border border-gray-700">
                <Music size={64} className="text-pink-500 mb-6 animate-pulse" />
                <h3 className="text-xl mb-6 text-white font-medium text-center break-all">{file.file_name}</h3>
                <audio src={file.url} controls autoPlay className="w-full min-w-[300px]" />
            </div>
        );
    }

    if (ext === 'pdf') {
      return (
        <iframe 
          src={file.url} 
          title={file.file_name}
          className="w-full h-[75vh] rounded border border-gray-700 bg-white" 
        />
      );
    }

    return (
      <div className="text-center py-10">
        <Archive size={80} className="mx-auto mb-6 text-gray-600" />
        <p className="text-xl mb-6 text-gray-300">Preview not available for <b>.{ext}</b> files</p>
        <a 
          href={file.url} 
          download 
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 text-white font-medium transition-colors shadow-lg hover:shadow-blue-500/20"
        >
          <Download size={20} /> Download File
        </a>
      </div>
    );
  };

  return (
    <div className="p-8 h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
          <Folder className="text-yellow-500" /> File Manager
        </h1>

        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-wrap gap-4 items-center shadow-lg">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search filename..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder-gray-500 transition-all focus:border-blue-500"
            />
          </form>

          <div className="relative min-w-[200px]">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select 
              value={selectedGroup}
              onChange={(e) => { setSelectedGroup(e.target.value); setPage(1); }}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 pr-4 py-2 appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-white cursor-pointer hover:border-gray-500 transition-colors"
            >
              <option value="">All Groups</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[150px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select 
              value={selectedType}
              onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 pr-4 py-2 appearance-none focus:ring-2 focus:ring-blue-500 outline-none text-white cursor-pointer hover:border-gray-500 transition-colors"
            >
              <option value="">All Types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
              <option value="archive">Archives</option>
              <option value="document">Documents</option>
            </select>
          </div>
          
          <button 
            onClick={() => loadFiles()} 
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center p-12 h-full items-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6">
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-gray-800/50 backdrop-blur rounded-xl border border-gray-700 p-4 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all group relative flex flex-col h-40"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 bg-gray-700/50 rounded-lg group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                    {getFileIcon(file.file_name)}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 absolute top-4 right-4 bg-gray-800 rounded-lg shadow-lg p-1 border border-gray-700 scale-95 group-hover:scale-100">
                    <button 
                      onClick={() => handlePreview(file)} 
                      className="p-1.5 hover:bg-blue-500/20 hover:text-blue-400 rounded-md transition-colors"
                      title="Preview"
                    >
                      <Eye size={16} />
                    </button>
                    <a 
                      href={file.url} 
                      download
                      className="p-1.5 hover:bg-green-500/20 hover:text-green-400 rounded-md transition-colors"
                      title="Download"
                    >
                      <Download size={16} />
                    </a>
                    <button 
                      onClick={() => handleDelete(file.id)} 
                      className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="mt-auto">
                  <h3 className="font-medium truncate mb-1 text-sm text-gray-200 group-hover:text-white transition-colors" title={file.file_name}>
                    {file.file_name}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-blue-400 mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <Users size={12} />
                    <span className="truncate" title={file.chat_name}>{file.chat_name}</span>
                  </div>
                  <div className="flex justify-between items-end text-xs text-gray-500">
                    <span>{new Date(file.last_modified).toLocaleDateString()}</span>
                    <span className="bg-gray-700/50 px-2 py-0.5 rounded text-gray-400 group-hover:bg-gray-700 group-hover:text-gray-300 transition-colors">
                      {formatSize(file.size)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {files.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-500 h-full">
                <Folder size={64} className="mb-4 opacity-30" />
                <p className="text-lg">No files found matching your filters</p>
                <button 
                  onClick={() => {setSearch(''); setSelectedGroup(''); setSelectedType('');}}
                  className="mt-4 text-sm text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex-shrink-0 pt-4 border-t border-gray-800 flex items-center justify-between">
        <span className="text-sm text-gray-400">
          Page <span className="text-white font-medium">{page}</span> of <span className="text-white font-medium">{totalPages || 1}</span>
        </span>
        <div className="flex gap-2">
          <button 
            onClick={() => setPage(p => Math.max(1, p - 1))} 
            disabled={page === 1} 
            className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
            disabled={page === totalPages || totalPages === 0} 
            className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            onClick={() => setPreviewFile(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-700" 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                  {getFileIcon(previewFile.file_name)}
                  <div className="overflow-hidden">
                    <h3 className="font-semibold truncate text-white text-lg" title={previewFile.file_name}>
                      {previewFile.file_name}
                    </h3>
                    <p className="text-xs text-gray-400 flex items-center gap-2">
                      <span>{formatSize(previewFile.size)}</span>
                      <span>•</span>
                      <span>{new Date(previewFile.last_modified).toLocaleString()}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a 
                    href={previewFile.url} 
                    download
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-blue-400" 
                    title="Download Original"
                  >
                    <Download size={22} />
                  </a>
                  <button 
                    onClick={() => setPreviewFile(null)} 
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 p-6 bg-black/50 overflow-auto flex items-center justify-center relative">
                {renderPreviewContent(previewFile)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}