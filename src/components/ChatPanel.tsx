import { useEffect, useRef, useState } from 'react';
import { ChatMessage as ChatMessageType } from '../types';
import ChatMessageComponent, { StreamingMessage, LoadingDots } from './ChatMessage';
import ChatInput from './ChatInput';
import ApiKeySetup from './ApiKeySetup';

interface Props {
  messages: ChatMessageType[];
  selectedModel: 'claude' | 'gemini';
  onChangeModel: (model: 'claude' | 'gemini') => void;
  streamingText: string;
  isLoading: boolean;
  hasApiKey: boolean | null;
  onSend: (text: string) => void;
  onSetApiKey: (anthropicKey: string, geminiKey: string) => void;
  onClearChat: () => void;
}

export default function ChatPanel({
  messages,
  selectedModel,
  onChangeModel,
  streamingText,
  isLoading,
  hasApiKey,
  onSend,
  onSetApiKey,
  onClearChat,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const header = (
    <div
      className="flex-shrink-0 px-5 py-4 drag-region"
      style={{ borderBottom: '1px solid rgba(147,51,234,0.08)' }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="text-gold"
          style={{ fontSize: '17px', lineHeight: 1, opacity: 0.9 }}
          aria-hidden
        >◉</span>
        <span className="text-[13px] font-semibold text-text-primary tracking-tight">
          AI Chief of Staff
        </span>
        
        <div ref={dropdownRef} className="relative select-none z-50">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className={`text-[9px] font-medium tracking-wide px-2 py-0.5 rounded-full border flex items-center gap-1 cursor-pointer transition-all duration-200 ${
              selectedModel === 'claude'
                ? 'text-purple-400 bg-purple-500/10 border-purple-500/25 hover:bg-purple-500/20'
                : 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25 hover:bg-cyan-500/20'
            }`}
          >
            <span>{selectedModel === 'claude' ? 'Claude Sonnet 4.6' : 'Gemini 3.5 Flash'}</span>
            <span className="text-[7px]" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s ease' }}>▼</span>
          </button>
          
          {isDropdownOpen && (
            <div
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="absolute left-0 mt-1 w-32 rounded border border-white/10 bg-[#16121e]/95 backdrop-blur-md shadow-xl py-1 z-[100] animate-in fade-in slide-in-from-top-1 duration-150"
            >
              <button
                onClick={() => {
                  onChangeModel('claude');
                  setIsDropdownOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1 text-[10px] hover:bg-purple-500/10 transition-colors flex items-center justify-between cursor-pointer ${
                  selectedModel === 'claude' ? 'text-purple-400 font-semibold' : 'text-text-secondary'
                }`}
              >
                <span>Claude Sonnet 4.6</span>
                {selectedModel === 'claude' && <span className="text-[8px]">●</span>}
              </button>
              <button
                onClick={() => {
                  onChangeModel('gemini');
                  setIsDropdownOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1 text-[10px] hover:bg-cyan-500/10 transition-colors flex items-center justify-between cursor-pointer ${
                  selectedModel === 'gemini' ? 'text-cyan-400 font-semibold' : 'text-text-secondary'
                }`}
              >
                <span>Gemini 3.5 Flash</span>
                {selectedModel === 'gemini' && <span className="text-[8px]">●</span>}
              </button>
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={onClearChat}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="text-[9px] uppercase font-bold tracking-wider text-text-secondary hover:text-purple-400 transition-all duration-200 cursor-pointer select-none border border-white/5 bg-white/5 hover:border-purple-500/20 hover:bg-purple-500/5 px-2 py-0.5 rounded"
              title="Wipe transient chat history"
            >
              Clear Chat
            </button>
          )}
          <div
            className="w-1.5 h-1.5 rounded-full bg-success"
            style={{ boxShadow: '0 0 6px rgba(22,163,74,0.7)' }}
          />
        </div>
      </div>
    </div>
  );

  if (hasApiKey === false) {
    return (
      <div
        className="h-full flex flex-col"
        style={{ borderLeft: '1px solid rgba(147,51,234,0.08)' }}
      >
        {header}
        <div className="flex-1">
          <ApiKeySetup onSave={onSetApiKey} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ borderLeft: '1px solid rgba(147,51,234,0.08)' }}
    >
      {header}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-14 select-none">
            <div
              className="text-[40px] mb-4"
              style={{ opacity: 0.2, color: '#d4a017', lineHeight: 1 }}
            >◉</div>
            <p className="text-text-muted text-[13px]">Truth is watching.</p>
            <p className="text-text-muted text-[12px] mt-1" style={{ opacity: 0.55 }}>
              Say "morning briefing" to begin.
            </p>
          </div>
        )}

        {messages.slice(-10).map(msg => (
          <ChatMessageComponent key={msg.id} message={msg} />
        ))}

        {streamingText && <StreamingMessage text={streamingText} />}
        {isLoading && !streamingText && <LoadingDots />}

        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={onSend} disabled={isLoading || hasApiKey === null} selectedModel={selectedModel} />
    </div>
  );
}
