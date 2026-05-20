import { useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType } from '../types';
import ChatMessageComponent, { StreamingMessage, LoadingDots } from './ChatMessage';
import ChatInput from './ChatInput';
import ApiKeySetup from './ApiKeySetup';

interface Props {
  messages: ChatMessageType[];
  streamingText: string;
  isLoading: boolean;
  hasApiKey: boolean | null;
  onSend: (text: string) => void;
  onSetApiKey: (anthropicKey: string, geminiKey: string) => void;
}

export default function ChatPanel({
  messages,
  streamingText,
  isLoading,
  hasApiKey,
  onSend,
  onSetApiKey,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  const header = (
    <div
      className="flex-shrink-0 px-5 py-4 drag-region"
      style={{ borderBottom: '1px solid rgba(147,51,234,0.08)' }}
    >
      <div className="no-drag flex items-center gap-2.5">
        <span
          className="text-gold"
          style={{ fontSize: '17px', lineHeight: 1, opacity: 0.9 }}
          aria-hidden
        >◉</span>
        <span className="text-[13px] font-semibold text-text-primary tracking-tight">
          AI Chief of Staff
        </span>
        <div className="ml-auto flex items-center gap-1.5">
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

        {messages.map(msg => (
          <ChatMessageComponent key={msg.id} message={msg} />
        ))}

        {streamingText && <StreamingMessage text={streamingText} />}
        {isLoading && !streamingText && <LoadingDots />}

        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={onSend} disabled={isLoading || hasApiKey === null} />
    </div>
  );
}
