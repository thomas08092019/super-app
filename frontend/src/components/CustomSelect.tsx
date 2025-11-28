import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface Option { value: string | number; label: string; icon?: any; }
interface Props { value: string | number; onChange: (val: any) => void; options: Option[]; placeholder?: string; icon?: any; className?: string; disabled?: boolean; }

export default function CustomSelect({ value, onChange, options, placeholder="Select...", icon: Icon, className="", disabled=false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener("mousedown", handleClick); return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <div onClick={() => !disabled && setIsOpen(!isOpen)} className={`flex items-center justify-between w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg cursor-pointer transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-500'} ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          {Icon && <Icon size={18} className="text-gray-400 flex-shrink-0" />}
          <span className={`truncate ${selected ? 'text-white' : 'text-gray-400'}`}>{selected ? selected.label : placeholder}</span>
        </div>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
          {options.length > 0 ? options.map((opt) => (
            <div key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-gray-700/50 last:border-0 ${value === opt.value ? 'bg-blue-600/10 text-blue-400' : 'text-gray-200 hover:bg-gray-700'}`}>
              <div className="flex items-center gap-2 truncate">
                {opt.icon && <opt.icon size={16} className="opacity-70" />}
                <span className="truncate">{opt.label}</span>
              </div>
              {value === opt.value && <Check size={16} className="flex-shrink-0" />}
            </div>
          )) : <div className="p-3 text-center text-gray-500 text-sm">No options</div>}
        </div>
      )}
    </div>
  );
}