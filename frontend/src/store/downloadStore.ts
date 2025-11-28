import { create } from 'zustand';

interface DownloadState {
  taskId: string | null;
  isDownloading: boolean;
  progress: number;
  logs: string[];
  
  setTaskId: (id: string | null) => void;
  setIsDownloading: (status: boolean) => void;
  setProgress: (progress: number) => void;
  addLog: (message: string) => void;
  clearLogs: () => void;
  reset: () => void;
}

export const useDownloadStore = create<DownloadState>((set) => ({
  taskId: null,
  isDownloading: false,
  progress: 0,
  logs: [],

  setTaskId: (id) => set({ taskId: id }),
  setIsDownloading: (status) => set({ isDownloading: status }),
  setProgress: (progress) => set({ progress }),
  
  addLog: (message) => set((state) => {
    // Prevent duplicate consecutive logs for cleaner UI
    const lastLog = state.logs[state.logs.length - 1];
    if (lastLog && lastLog.includes(message)) {
      return state;
    }
    const timestamp = new Date().toLocaleTimeString();
    return { logs: [...state.logs, `[${timestamp}] ${message}`] };
  }),
  
  clearLogs: () => set({ logs: [] }),
  
  reset: () => set({ 
    taskId: null, 
    isDownloading: false, 
    progress: 0 
    // We keep logs intentionally so user can see result after finish
  }),
}));