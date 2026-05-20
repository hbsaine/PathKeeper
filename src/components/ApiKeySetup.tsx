import { useState } from 'react';

interface Props {
  onSave: (key: string) => void;
}

export default function ApiKeySetup({ onSave }: Props) {
  const [key,   setKey]   = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const trimmed = key.trim();
    if (!trimmed.startsWith('sk-ant-')) {
      setError('Must start with sk-ant-');
      return;
    }
    onSave(trimmed);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center select-none">
      {/* Alchemy eye — Truth awaits */}
      <div
        className="mb-5"
        style={{ fontSize: '52px', lineHeight: 1, color: '#d4a017', opacity: 0.25 }}
        aria-hidden
      >◉</div>

      <h2 className="text-[16px] font-semibold text-text-primary mb-2">
        Connect to Truth
      </h2>
      <p className="text-[13px] text-text-secondary mb-8 max-w-[260px] leading-relaxed">
        PathKeeper needs your Anthropic API key. Stored locally. Never transmitted.
      </p>

      <div className="w-full max-w-sm space-y-3">
        <input
          type="password"
          value={key}
          onChange={e => { setKey(e.target.value); setError(''); }}
          placeholder="sk-ant-api..."
          className="w-full outline-none text-[13px] text-text-primary placeholder-text-muted rounded-lg px-4 py-2.5 transition-colors duration-200 no-drag"
          style={{
            background:  '#0f0e18',
            border:      '1px solid rgba(147,51,234,0.2)',
            color:       '#e8e4f0',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'rgba(147,51,234,0.5)';
            e.target.style.boxShadow   = '0 0 0 3px rgba(147,51,234,0.08)';
          }}
          onBlur={e => {
            e.target.style.borderColor = 'rgba(147,51,234,0.2)';
            e.target.style.boxShadow   = 'none';
          }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        {error && <p className="text-[12px] text-danger">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={!key.trim()}
          className="no-drag w-full py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-30 hover:opacity-80 active:scale-[0.99]"
          style={{ background: '#9333ea' }}
        >
          Enter the Gate
        </button>
      </div>

      <p className="text-[11px] text-text-muted mt-6">console.anthropic.com</p>
    </div>
  );
}
