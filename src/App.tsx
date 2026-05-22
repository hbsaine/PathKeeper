import { useEffect, useRef, useState } from 'react';
import CommandCenter from './components/CommandCenter';
import ChatPanel from './components/ChatPanel';
import ApiKeySetup from './components/ApiKeySetup';
import { useDailyFocus, useStreaks, useGoals, useSkillTracks, useCountdowns } from './hooks/useDB';
import { useAI } from './hooks/useAI';

const isElectron = typeof window !== 'undefined' && !!window.pathkeeper;

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!isElectron) return;
    const bump = () => setRefreshKey(k => k + 1);
    window.pathkeeper.ai.onDataChanged(bump);
    return () => window.pathkeeper.ai.removeDataChangedListeners();
  }, []);

  const { focus, completeTask } = useDailyFocus(refreshKey);
  const streaks = useStreaks(refreshKey);
  const goals = useGoals(refreshKey);
  const tracks = useSkillTracks(refreshKey);
  const countdowns = useCountdowns(refreshKey);

  const {
    messages,
    streamingText,
    isLoading,
    hasApiKey,
    selectedModel,
    changeModel,
    loadHistory,
    sendMessage,
    setApiKey,
    clearChat,
    triggerMorningBriefing,
  } = useAI({ focus, goals, streaks, countdowns });

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Keep a ref so the morning briefing listener always calls the latest version
  const briefingRef = useRef(triggerMorningBriefing);
  useEffect(() => { briefingRef.current = triggerMorningBriefing; }, [triggerMorningBriefing]);

  useEffect(() => {
    if (!isElectron) return;
    window.pathkeeper.ai.onMorningBriefing(() => briefingRef.current());
    return () => window.pathkeeper.ai.removeMorningBriefingListener();
  }, []);

  return (
    <div className="relative flex h-screen w-screen bg-bg overflow-hidden">
      {/* Left: Command Center — 55% */}
      <div className="flex flex-col" style={{ width: '55%', minWidth: 0 }}>
        <CommandCenter
          focus={focus}
          streaks={streaks}
          tracks={tracks}
          countdowns={countdowns}
          refreshKey={refreshKey}
          onCompleteTask={completeTask}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* Right: Chat Panel — 45% */}
      <div className="flex flex-col" style={{ width: '45%', minWidth: 0 }}>
        <ChatPanel
          messages={messages}
          streamingText={streamingText}
          isLoading={isLoading}
          hasApiKey={hasApiKey}
          onSend={sendMessage}
          onSetApiKey={setApiKey}
          onClearChat={clearChat}
          selectedModel={selectedModel}
          onChangeModel={changeModel}
        />
      </div>

      {/* Persistent Settings Modal Overlay */}
      {isSettingsOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md fade-in no-drag"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="relative w-full max-w-md bg-[#0a0a0f] border border-purple-500/20 rounded-2xl shadow-2xl overflow-hidden fade-in-up"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-[18px] cursor-pointer select-none no-drag transition-colors"
              title="Close Settings"
            >
              ✕
            </button>
            <ApiKeySetup
              onSave={async (antKey, gemKey) => {
                await setApiKey(antKey, gemKey);
                setIsSettingsOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
