import type { ReactNode } from 'react';
import { ChatMessage as ChatMessageType } from '../types';

// ── Inline markdown renderer ──────────────────────────────────────────
function inlineRender(text: string): ReactNode[] {
  // Split on **bold**, *italic*, `code` — capture groups keep the tokens
  const tokens = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/);
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4)
      return <strong key={i} className="font-semibold text-text-primary">{token.slice(2, -2)}</strong>;
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2)
      return <em key={i} className="italic">{token.slice(1, -1)}</em>;
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2)
      return <code key={i} className="md-code">{token.slice(1, -1)}</code>;
    return token;
  });
}

function MarkdownContent({ text }: { text: string }) {
  const elements: ReactNode[] = [];

  // Split on ```code blocks``` — capture group keeps the block text
  const segments = text.split(/(```[\w]*\n?[\s\S]*?```)/g);

  segments.forEach((seg, si) => {
    if (seg.startsWith('```')) {
      const inner = seg.replace(/^```[\w]*\n?/, '').replace(/```$/, '').trim();
      elements.push(<pre key={`code-${si}`} className="md-code-block">{inner}</pre>);
      return;
    }

    const paras = seg.split(/\n\n+/);
    paras.forEach((para, pi) => {
      if (!para.trim()) return;
      const k = `p-${si}-${pi}`;

      // Headers
      if (para.startsWith('### ')) {
        elements.push(
          <p key={k} className="text-[13px] font-semibold text-text-primary mt-1.5 leading-snug">
            {inlineRender(para.slice(4))}
          </p>
        );
        return;
      }
      if (para.startsWith('## ')) {
        elements.push(
          <p key={k} className="text-[14px] font-semibold text-text-primary mt-2 leading-snug">
            {inlineRender(para.slice(3))}
          </p>
        );
        return;
      }
      if (para.startsWith('# ')) {
        elements.push(
          <p key={k} className="text-[15px] font-bold text-text-primary mt-2 leading-snug">
            {inlineRender(para.slice(2))}
          </p>
        );
        return;
      }

      // List — paragraph where every non-empty line starts with - * •
      const lines = para.split('\n');
      const listItems = lines.filter(l => /^[-*•]\s/.test(l));
      if (listItems.length > 0 && listItems.length >= lines.filter(l => l.trim()).length) {
        elements.push(
          <ul key={k} className="space-y-1 mt-1" style={{ listStyleType: 'none' }}>
            {listItems.map((l, li) => (
              <li key={li} className="flex gap-2 text-[14px] leading-[1.7]">
                <span
                  className="text-accent flex-shrink-0"
                  style={{ fontSize: '7px', marginTop: '8px' }}
                >◆</span>
                <span>{inlineRender(l.replace(/^[-*•]\s/, ''))}</span>
              </li>
            ))}
          </ul>
        );
        return;
      }

      // Regular paragraph — preserve single newlines as line breaks
      elements.push(
        <p key={k} className="text-[14px] leading-[1.7]">
          {lines.map((line, li) => (
            <span key={li}>
              {li > 0 && <br />}
              {inlineRender(line)}
            </span>
          ))}
        </p>
      );
    });
  });

  return <div className="space-y-1.5">{elements}</div>;
}

// ── Message components ────────────────────────────────────────────────
interface Props {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end fade-in-up">
        <div
          className="max-w-[80%] px-4 py-3 rounded-xl rounded-tr-sm text-text-primary"
          style={{
            background: '#16142a',
            borderRight: '2px solid rgba(147,51,234,0.5)',
          }}
        >
          <p className="text-[14px] leading-[1.7] whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start fade-in-up">
      <div
        className="max-w-[92%] px-4 py-3 rounded-xl rounded-tl-sm text-text-primary"
        style={{
          background: '#0f0e18',
          borderLeft: '2px solid #d4a017',
        }}
      >
        <MarkdownContent text={message.content} />
      </div>
    </div>
  );
}

export function StreamingMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-start fade-in-up">
      <div
        className="max-w-[92%] px-4 py-3 rounded-xl rounded-tl-sm text-text-primary"
        style={{
          background: '#0f0e18',
          borderLeft: '2px solid #d4a017',
        }}
      >
        <MarkdownContent text={text} />
        <span
          className="inline-block w-0.5 h-3.5 ml-0.5 align-middle cursor-blink"
          style={{ background: '#d4a017', verticalAlign: 'middle' }}
        />
      </div>
    </div>
  );
}

export function LoadingDots() {
  return (
    <div className="flex justify-start fade-in">
      <div
        className="px-4 py-3 rounded-xl rounded-tl-sm"
        style={{ background: '#0f0e18', borderLeft: '2px solid #d4a017' }}
      >
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: 'rgba(212,160,23,0.5)',
                animation: `blink 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
