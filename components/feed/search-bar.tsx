"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value && value !== local) {
      setLocal(value);
      prevValueRef.current = value;
    }
  }, [value, local]);

  const emit = (next: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(next);
    }, 300);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setLocal(next);
    emit(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onChange(local);
    }
    if (e.key === "Escape") {
      setLocal("");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onChange("");
    }
  };

  const clear = () => {
    setLocal("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange("");
  };

  return (
    <div className="relative w-full md:max-w-md">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={local}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search events or performers"
        aria-label="Search events"
        className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
      {local && (
        <button
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
