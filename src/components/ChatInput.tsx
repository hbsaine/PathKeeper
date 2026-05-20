import { useState, useRef, KeyboardEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const textareaRef     = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  return (
    <div
      className="flex items-end gap-2.5 p-3"
      style={{ borderTop: '1px solid rgba(147,51,234,0.08)' }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={disabled ? 'PathKeeper is working...' : 'Message PathKeeper...'}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none outline-none text-[13px] text-text-primary placeholder-text-muted disabled:opacity-50 rounded-lg px-3.5 py-2.5 transition-colors duration-200"
        style={{
          background: '#0f0e18',
          border: '1px solid rgba(147,51,234,0.15)',
          minHeight: '40px',
          maxHeight: '120px',
          color: '#e8e4f0',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onFocus={e => {
          e.target.style.borderColor = 'rgba(147,51,234,0.5)';
          e.target.style.boxShadow   = '0 0 0 3px rgba(147,51,234,0.08)';
        }}
        onBlur={e => {
          e.target.style.borderColor = 'rgba(147,51,234,0.15)';
          e.target.style.boxShadow   = 'none';
        }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-30 hover:opacity-80 active:scale-95"
        style={{ background: '#9333ea' }}
        aria-label="Send message"
      >
        {/* Gold arrow pointing up */}
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 13V3M3 8l5-5 5 5"
            stroke="#d4a017"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
