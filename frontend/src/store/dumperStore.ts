import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DumperState {
  taskId: string | null;
  isDumping: boolean;
  progress: number;
  logs: string[];
  setTaskId: (id: string | null) => void;
  setIsDumping: (status: boolean) => void;
  setProgress: (progress: number) => void;
  addLog: (message: string) => void;
  clearLogs: () => void;
}

export const useDumperStore = create<DumperState>()(
  persist(
    (set) => ({
      taskId: null,
      isDumping: false,
      progress: 0,
      logs: [],
      setTaskId: (id) => set({ taskId: id }),
      setIsDumping: (status) => set({ isDumping: status }),
      setProgress: (progress) => set({ progress }),
      addLog: (message) => set((state) => {
        const lastLog = state.logs[state.logs.length - 1];
        if (lastLog && lastLog.includes(message)) return state;
        return { logs: [...state.logs, `[${new Date().toLocaleTimeString()}] ${message}`] };
      }),
      clearLogs: () => set({ logs: [] }),
    }),
    { name: 'dumper-storage' }
  )
);