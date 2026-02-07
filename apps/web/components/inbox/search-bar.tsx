"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") || "";

  const [isExpanded, setIsExpanded] = useState(Boolean(currentQuery));
  const [inputValue, setInputValue] = useState(currentQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Focus input when expanding
  useEffect(() => {
    if (isExpanded) {
      inputRef.current?.focus();
    }
  }, [isExpanded]);

  // Sync input value when URL param changes externally
  useEffect(() => {
    setInputValue(currentQuery);
    if (currentQuery) setIsExpanded(true);
  }, [currentQuery]);

  const updateUrl = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.length >= 2) {
        params.set("q", query);
      } else {
        params.delete("q");
      }
      const qs = params.toString();
      router.push(`/inbox${qs ? `?${qs}` : ""}`);
    },
    [router, searchParams]
  );

  function handleChange(value: string) {
    setInputValue(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateUrl(value), 300);
  }

  function handleClear() {
    setInputValue("");
    clearTimeout(debounceRef.current);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    const qs = params.toString();
    router.push(`/inbox${qs ? `?${qs}` : ""}`);
    setIsExpanded(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      if (inputValue) {
        handleClear();
      } else {
        setIsExpanded(false);
      }
      inputRef.current?.blur();
    }
  }

  if (!isExpanded) {
    return (
      <Button
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => setIsExpanded(true)}
      >
        <Search className="h-3.5 w-3.5" />
        Search
      </Button>
    );
  }

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="text"
        placeholder="Search emails..."
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!inputValue) setIsExpanded(false);
        }}
        className="h-8 w-64 pl-8 pr-8 text-sm"
      />
      {inputValue && (
        <button
          onClick={handleClear}
          className="absolute right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
