import { useState, useCallback, useRef } from 'react';
import { ChatMessage, DailyFocusItem, Goal, Streak } from '../types';
import { buildSystemPrompt } from '../lib/systemPrompt';

const isElectron = typeof window !== 'undefined' && !!window.pathkeeper;

interface UseAIOptions {
  focus: DailyFocusItem[];
  goals: Goal[];
  streaks: Streak[];
}

export function useAI({ focus, goals, streaks }: UseAIOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  const loadHistory = useCallback(async () => {
    if (!isElectron) return;
    const history = await window.pathkeeper.db.getChatHistory();
    // getChatHistory returns DESC order, reverse for display
    const ordered = [...history].reverse();
    setMessages(ordered);
    messagesRef.current = ordered;

    const apiKey = await window.pathkeeper.db.getSetting('anthropic_api_key');
    setHasApiKey(!!apiKey);
  }, []);

  const sendMessage = useCallback(async (userText: string) => {
    if (!isElectron || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messagesRef.current, userMsg];
    messagesRef.current = newMessages;
    setMessages(newMessages);
    setIsLoading(true);
    setStreamingText('');

    await window.pathkeeper.db.addChatMessage('user', userText);

    const systemPrompt = buildSystemPrompt({ focus, goals, streaks });

    // Last 20 messages for context
    const contextMessages = newMessages.slice(-20).map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Setup streaming listeners
    window.pathkeeper.ai.removeStreamListeners();

    let accumulated = '';
    window.pathkeeper.ai.onStreamChunk((chunk: string) => {
      accumulated += chunk;
      setStreamingText(accumulated);
    });

    window.pathkeeper.ai.onStreamDone(() => {
      setStreamingText('');
      setIsLoading(false);

      if (accumulated === '__NO_API_KEY__' || accumulated === '') {
        if (accumulated === '__NO_API_KEY__') setHasApiKey(false);
        return;
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: accumulated,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...messagesRef.current, assistantMsg];
      messagesRef.current = finalMessages;
      setMessages(finalMessages);

      window.pathkeeper.db.addChatMessage('assistant', accumulated);
    });

    try {
      const result = await window.pathkeeper.ai.sendMessage(systemPrompt, contextMessages);
      if (result === '__NO_API_KEY__') {
        setHasApiKey(false);
        setIsLoading(false);
        setStreamingText('');
      }
    } catch (err) {
      console.error('AI error:', err);
      setIsLoading(false);
      setStreamingText('');
    }
  }, [focus, goals, streaks, isLoading]);

  const setApiKey = useCallback(async (key: string) => {
    if (!isElectron) return;
    await window.pathkeeper.db.setSetting('anthropic_api_key', key);
    setHasApiKey(true);
  }, []);

  return {
    messages,
    streamingText,
    isLoading,
    hasApiKey,
    loadHistory,
    sendMessage,
    setApiKey,
  };
}
