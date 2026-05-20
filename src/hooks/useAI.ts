import { useState, useCallback, useRef } from 'react';
import { ChatMessage, Countdown, DailyFocusItem, Goal, Streak } from '../types';
import { buildSystemPrompt } from '../lib/systemPrompt';

const isElectron = typeof window !== 'undefined' && !!window.pathkeeper;

interface UseAIOptions {
  focus: DailyFocusItem[];
  goals: Goal[];
  streaks: Streak[];
  countdowns: Countdown[];
}

export function useAI({ focus, goals, streaks, countdowns }: UseAIOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedModel, setSelectedModel] = useState<'claude' | 'gemini'>('claude');
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

    const savedModel = await window.pathkeeper.db.getSetting('active_chat_model');
    const active = (savedModel === 'claude' || savedModel === 'gemini') ? savedModel : 'claude';
    setSelectedModel(active);

    const anthropicKey = await window.pathkeeper.db.getSetting('anthropic_api_key');
    const geminiKey = await window.pathkeeper.db.getSetting('gemini_api_key');
    setHasApiKey(active === 'claude' ? !!anthropicKey : !!geminiKey);
  }, []);

  const changeModel = useCallback(async (model: 'claude' | 'gemini') => {
    if (!isElectron) return;
    setSelectedModel(model);
    await window.pathkeeper.db.setSetting('active_chat_model', model);

    const key = await window.pathkeeper.db.getSetting(model === 'claude' ? 'anthropic_api_key' : 'gemini_api_key');
    setHasApiKey(!!key);
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

    const systemPrompt = buildSystemPrompt({ focus, goals, streaks, countdowns });

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

      if (accumulated === '__NO_API_KEY__' || accumulated === '__NO_GEMINI_API_KEY__' || accumulated === '') {
        if (accumulated === '__NO_API_KEY__' || accumulated === '__NO_GEMINI_API_KEY__') {
          setHasApiKey(false);
        }
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
      const result = await window.pathkeeper.ai.sendMessage(systemPrompt, contextMessages, selectedModel);
      if (result === '__NO_API_KEY__' || result === '__NO_GEMINI_API_KEY__') {
        setHasApiKey(false);
        setIsLoading(false);
        setStreamingText('');
      }
    } catch (err) {
      console.error('AI error:', err);
      setIsLoading(false);
      setStreamingText('');
    }
  }, [focus, goals, streaks, countdowns, isLoading, selectedModel]);

  const setApiKey = useCallback(async (anthropicKey: string, geminiKey: string) => {
    if (!isElectron) return;
    await window.pathkeeper.db.setSetting('anthropic_api_key', anthropicKey);
    await window.pathkeeper.db.setSetting('gemini_api_key', geminiKey);
    const key = await window.pathkeeper.db.getSetting(selectedModel === 'claude' ? 'anthropic_api_key' : 'gemini_api_key');
    setHasApiKey(!!key);
  }, [selectedModel]);

  const clearChat = useCallback(async () => {
    if (!isElectron) return;
    await window.pathkeeper.db.clearChatHistory();
    setMessages([]);
    messagesRef.current = [];
  }, []);

  return {
    messages,
    selectedModel,
    changeModel,
    streamingText,
    isLoading,
    hasApiKey,
    loadHistory,
    sendMessage,
    setApiKey,
    clearChat,
  };
}
