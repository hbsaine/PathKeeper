import { useState, useEffect } from 'react';

interface Props {
  onSave: (anthropicKey: string, geminiKey: string) => void;
}

export default function ApiKeySetup({ onSave }: Props) {
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchExistingKeys = async () => {
      if (typeof window !== 'undefined' && window.pathkeeper) {
        const existingAnt = await window.pathkeeper.db.getSetting('anthropic_api_key');
        const existingGem = await window.pathkeeper.db.getSetting('gemini_api_key');
        if (existingAnt) setAnthropicKey(existingAnt);
        if (existingGem) setGeminiKey(existingGem);
      }
    };
    fetchExistingKeys();
  }, []);

  const handleSubmit = () => {
    const antTrimmed = anthropicKey.trim();
    const gemTrimmed = geminiKey.trim();

    if (!antTrimmed && !gemTrimmed) {
      setError('Please provide at least one API key to proceed.');
      return;
    }

    if (antTrimmed && !antTrimmed.startsWith('sk-ant-')) {
      setError('Anthropic key must start with sk-ant-');
      return;
    }

    if (gemTrimmed && !gemTrimmed.startsWith('AIzaSy')) {
      setError('Gemini key must start with AIzaSy');
      return;
    }

    onSave(antTrimmed, gemTrimmed);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center select-none overflow-y-auto">
      {/* Alchemy eye — Truth awaits */}
      <div
        className="mb-5"
        style={{ fontSize: '52px', lineHeight: 1, color: '#d4a017', opacity: 0.25 }}
        aria-hidden
      >◉</div>

      <h2 className="text-[16px] font-semibold text-text-primary mb-2">
        Connect to Truth & Agency
      </h2>
      <p className="text-[13px] text-text-secondary mb-6 max-w-[320px] leading-relaxed">
        PathKeeper needs your AI credentials. Keys are stored locally on your device and are never sent to external servers.
      </p>

      <div className="w-full max-w-sm space-y-4">
        {/* Anthropic Row */}
        <div className="space-y-1.5 text-left">
          <label className="text-[11px] font-semibold tracking-wider text-text-muted uppercase px-1">
            Anthropic API Key (Claude Chat)
          </label>
          <input
            type="password"
            value={anthropicKey}
            onChange={e => { setAnthropicKey(e.target.value); setError(''); }}
            placeholder="sk-ant-api..."
            className="w-full outline-none text-[13px] text-text-primary placeholder-text-muted rounded-lg px-4 py-2.5 transition-all duration-200 no-drag"
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
        </div>

        {/* Gemini Row */}
        <div className="space-y-1.5 text-left">
          <label className="text-[11px] font-semibold tracking-wider text-text-muted uppercase px-1">
            Google Gemini API Key (Task Pre-work)
          </label>
          <input
            type="password"
            value={geminiKey}
            onChange={e => { setGeminiKey(e.target.value); setError(''); }}
            placeholder="AIzaSy..."
            className="w-full outline-none text-[13px] text-text-primary placeholder-text-muted rounded-lg px-4 py-2.5 transition-all duration-200 no-drag"
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
        </div>

        {error && <p className="text-[12px] text-danger mt-1">{error}</p>}
        
        <button
          onClick={handleSubmit}
          disabled={!anthropicKey.trim() && !geminiKey.trim()}
          className="no-drag w-full py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all duration-200 disabled:opacity-30 hover:opacity-85 active:scale-[0.99] mt-2"
          style={{ background: 'linear-gradient(135deg, #9333ea 0%, #a855f7 100%)' }}
        >
          Enter the Gate
        </button>
      </div>

      <div className="flex gap-4 text-[10px] text-text-muted mt-6 font-mono select-none">
        <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="hover:text-text-secondary transition-colors">console.anthropic.com</a>
        <span>•</span>
        <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="hover:text-text-secondary transition-colors">aistudio.google.com</a>
      </div>
    </div>
  );
}
