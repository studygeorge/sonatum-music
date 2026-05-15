'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onFocus?: () => void;
}

export default function SearchBar({ value, onChange, placeholder = 'Поиск...', onFocus }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative w-full">
      <div className={`
        relative overflow-hidden rounded-full transition-all duration-300
        ${isFocused ? 'shadow-lg scale-105' : 'shadow-sm'}
      `}>
        <div className="absolute inset-0 bg-white/90 backdrop-blur-xl" />
        
        {isFocused && (
          <div className="absolute inset-0 bg-gradient-to-r from-gray-100/10 via-gray-50/10 to-gray-100/10" />
        )}
        
        <div className="relative flex items-center gap-3 px-6 py-4">
          <Search className={`w-5 h-5 transition-colors ${isFocused ? 'text-gray-900' : 'text-gray-400'}`} />
          
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              onFocus?.();
            }}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder={placeholder}
            className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 text-base"
          />
          
          {value && (
            <button
              onClick={() => onChange('')}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
