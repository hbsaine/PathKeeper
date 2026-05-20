import { useEffect, useState } from 'react';
import CommandCenter from './components/CommandCenter';
import ChatPanel from './components/ChatPanel';
import { useDailyFocus, useStreaks, useGoals, useSkillTracks, useCountdowns } from './hooks/useDB';
import { useAI } from './hooks/useAI';

const isElectron = typeof window !== 'undefined' && !!window.pathkeeper;

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isElectron) return;
    const bump = () => setRefreshKey(k => k + 1);
    window.pathkeeper.ai.onDataChanged(bump);
    return () => window.pathkeeper.ai.removeDataChangedListeners();
  }, []);

  const { focus, completeTask } = useDailyFocus(refreshKey);
  const streaks = useStreaks(refreshKey);
  const goals = useGoals();
  const tracks = useSkillTracks(refreshKey);
  const countdowns = useCountdowns(refreshKey);

  const {
    messages,
    streamingText,
    isLoading,
    hasApiKey,
    loadHistory,
    sendMessage,
    setApiKey,
  } = useAI({ focus, goals, streaks });

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="flex h-screen w-screen bg-bg overflow-hidden">
      {/* Left: Command Center — 55% */}
      <div className="flex flex-col" style={{ width: '55%', minWidth: 0 }}>
        <CommandCenter
          focus={focus}
          streaks={streaks}
          tracks={tracks}
          countdowns={countdowns}
          onCompleteTask={completeTask}
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
        />
      </div>
    </div>
  );
}
