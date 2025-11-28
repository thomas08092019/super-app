import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, File, FileText, Image as ImageIcon, Video, Trash2, Eye, Download, X, FileSpreadsheet, Music, Archive, Search, Filter, ChevronLeft, ChevronRight, RefreshCw, Users, AlertCircle, ChevronDown, Square, CheckSquare } from 'lucide-react';
import { storageAPI } from '../services/api';
import CustomSelect from '../components/CustomSelect';

interface FileObject { id: number; name: string; file_name: string; chat_id: string; chat_name: string; size: number; last_modified: string; url: string; type: string; }
interface GroupOption { id: string; name: string; }

export default function FileManager() {
  const [files, setFiles] = useState<FileObject[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [previewFile, setPreviewFile] = useState<FileObject | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => { loadFiles(); }, [page, selectedGroup, selectedType]);

  const loadFiles = async (searchTerm = search) => {
    setLoading(true);
    try {
      const data = await storageAPI.listFiles({ page, limit: 20, search: searchTerm, chat_id: selectedGroup, file_type: selectedType });
      setFiles(data.files); setTotalPages(data.total_pages); setGroups(data.groups);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); loadFiles(search); };
  const handleDelete = async (id: number) => { if (confirm('Delete?')) { await storageAPI.deleteFile(id); loadFiles(); } };
  const handleDeleteSelected = async () => { if (confirm(`Delete ${selectedFiles.length} files?`)) { await storageAPI.deleteFilesBatch(selectedFiles); setSelectedFiles([]); loadFiles(); } };
  const handleDeleteAll = async () => { if (confirm('DELETE ALL FILES?')) { await storageAPI.deleteAllFiles(); setSelectedFiles([]); loadFiles(); } };
  const toggleSelectFile = (id: number) => setSelectedFiles(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedFiles(selectedFiles.length === files.length ? [] : files.map(f => f.id));
  
  const formatSize = (bytes: number) => { const k=1024, i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+' '+['B','KB','MB','GB'][i]; };
  const getFileIcon = (fname: string) => {
    const ext = fname.split('.').pop()?.toLowerCase() || '';
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return <ImageIcon className="text-blue-400"/>;
    if (['mp4','mov','avi','mkv','webm'].includes(ext)) return <Video className="text-purple-400"/>;
    if (['mp3','wav','ogg','flac'].includes(ext)) return <Music className="text-pink-400"/>;
    if (['zip','rar','7z','tar','gz'].includes(ext)) return <Archive className="text-yellow-400"/>;
    if (['pdf'].includes(ext)) return <FileText className="text-red-400"/>;
    return <File className="text-gray-400"/>;
  };

  const handlePreview = async (file: FileObject) => {
    const ext = file.file_name.split('.').pop()?.toLowerCase();
    if (['txt','csv','log','json','md'].includes(ext||'')) { try { const r = await fetch(file.url); setPreviewContent(await r.text()); } catch {} } else setPreviewContent(null);
    setPreviewFile(file);
  };

  const renderPreview = (file: FileObject) => {
    const ext = file.file_name.split('.').pop()?.toLowerCase() || '';
    if (previewContent) return <div className="bg-gray-900 p-4 rounded text-gray-300 whitespace-pre-wrap overflow-auto max-h-[70vh]">{previewContent}</div>;
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return <img src={file.url} className="max-h-[75vh] object-contain mx-auto"/>;
    if (['mp4','webm','ogg','mov'].includes(ext)) return <div className="text-center"><video src={file.url} controls autoPlay muted className="max-h-[70vh] mx-auto bg-black"/><div className="mt-2 text-yellow-500 flex justify-center gap-2"><AlertCircle size={16}/> If black screen, format unsupported. Download to view.</div></div>;
    if (['mp3','wav','flac'].includes(ext)) return <div className="bg-gray-900 p-10 rounded flex flex-col items-center"><Music size={64} className="text-pink-500 mb-4 animate-pulse"/><h3 className="text-xl mb-4 text-white">{file.file_name}</h3><audio src={file.url} controls autoPlay className="w-96"/></div>;
    if (ext==='pdf') return <iframe src={file.url} className="w-full h-[75vh] bg-white"/>;
    return <div className="text-center py-10"><Archive size={80} className="mx-auto mb-6 text-gray-600"/><a href={file.url} download className="bg-blue-600 px-6 py-3 rounded text-white inline-flex gap-2"><Download/> Download</a></div>;
  };

  const groupOptions = [{value:'', label:'All Groups'}, ...groups.map(g=>({value:g.id, label:g.name}))];
  const typeOptions = [{value:'', label:'All Types'}, {value:'image', label:'Images', icon:ImageIcon}, {value:'video', label:'Videos', icon:Video}, {value:'audio', label:'Audio', icon:Music}, {value:'archive', label:'Archives', icon:Archive}, {value:'document', label:'Documents', icon:FileText}];

  return (
    <div className="p-8 h-screen flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-6">
        <div className="flex justify-between items-start mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-3"><Folder className="text-yellow-500"/> File Manager</h1>
            <div className="flex gap-2">
                {selectedFiles.length>0 && <button onClick={handleDeleteSelected} className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg font-medium border border-red-600/30"><Trash2 size={18}/> Delete Selected ({selectedFiles.length})</button>}
                <button onClick={handleDeleteAll} className="flex items-center gap-2 px-4 py-2 bg-red-900/20 text-red-500 hover:bg-red-900/30 rounded-lg font-medium border border-red-900/30"><AlertCircle size={18}/> Delete All</button>
            </div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex flex-wrap gap-4 items-center shadow-lg">
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px] relative"><Search className="absolute left-3 top-2.5 text-gray-400" size={18}/><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"/></form>
          <div className="min-w-[250px]"><CustomSelect value={selectedGroup} onChange={val=>{setSelectedGroup(val); setPage(1)}} options={groupOptions} placeholder="All Groups" icon={Users}/></div>
          <div className="min-w-[200px]"><CustomSelect value={selectedType} onChange={val=>{setSelectedType(val); setPage(1)}} options={typeOptions} placeholder="All Types" icon={Filter}/></div>
          <button onClick={()=>loadFiles()} className="p-2 hover:bg-gray-700 rounded-lg"><RefreshCw size={20}/></button>
        </div>
        <div className="flex items-center justify-between mt-4 text-sm text-gray-400 px-1">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 hover:text-white">{files.length>0 && selectedFiles.length===files.length ? <CheckSquare size={18} className="text-blue-500"/> : <Square size={18}/>} Select All on Page</button>
            <span>Total: {files.length}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
        {loading ? <div className="flex justify-center p-12"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/></div> : 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6">
            {files.map(file => (
                <motion.div key={file.id} onClick={()=>toggleSelectFile(file.id)} initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className={`bg-gray-800/50 backdrop-blur rounded-xl border p-4 transition-all group relative flex flex-col h-40 cursor-pointer ${selectedFiles.includes(file.id)?'border-blue-500 bg-blue-500/10':'border-gray-700 hover:border-blue-500/50'}`}>
                    <div className="absolute top-4 left-4 z-10">{selectedFiles.includes(file.id)?<CheckSquare size={20} className="text-blue-500 bg-gray-900 rounded"/>:<Square size={20} className="text-gray-500"/>}</div>
                    <div className="flex items-start justify-end mb-3 pl-8">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all absolute top-4 right-4 bg-gray-800 p-1 rounded shadow-lg z-20" onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>handlePreview(file)} className="p-1.5 hover:text-blue-400"><Eye size={16}/></button>
                            <a href={file.url} download className="p-1.5 hover:text-green-400"><Download size={16}/></a>
                            <button onClick={()=>handleDelete(file.id)} className="p-1.5 hover:text-red-400"><Trash2 size={16}/></button>
                        </div>
                        <div className="p-3 bg-gray-700/50 rounded-lg">{getFileIcon(file.file_name)}</div>
                    </div>
                    <div className="mt-auto">
                        <h3 className="font-medium truncate text-sm text-gray-200" title={file.file_name}>{file.file_name}</h3>
                        <div className="flex items-center gap-1 text-xs text-blue-400 mb-1"><Users size={12}/><span className="truncate">{file.chat_name}</span></div>
                        <div className="flex justify-between text-xs text-gray-500"><span>{new Date(file.last_modified).toLocaleDateString()}</span><span className="bg-gray-700 px-2 rounded">{formatSize(file.size)}</span></div>
                    </div>
                </motion.div>
            ))}
            {files.length===0 && <div className="col-span-full text-center py-20 text-gray-500"><Folder size={64} className="mx-auto mb-4 opacity-30"/><p>No files found</p></div>}
        </div>}
      </div>
      <div className="flex-shrink-0 pt-4 border-t border-gray-800 flex justify-between"><span className="text-sm text-gray-400">Page <span className="text-white">{page}</span> of <span className="text-white">{totalPages}</span></span><div className="flex gap-2"><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="p-2 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50"><ChevronLeft/></button><button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="p-2 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50"><ChevronRight/></button></div></div>
      <AnimatePresence>
        {previewFile && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={()=>setPreviewFile(null)}>
                <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-gray-800 rounded-xl max-w-6xl w-full max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>
                    <div className="flex justify-between p-4 bg-gray-900 border-b border-gray-700"><h3 className="text-white truncate">{previewFile.file_name}</h3><button onClick={()=>setPreviewFile(null)}><X size={24}/></button></div>
                    <div className="flex-1 p-6 bg-black/50 overflow-auto flex justify-center">{renderPreview(previewFile)}</div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}