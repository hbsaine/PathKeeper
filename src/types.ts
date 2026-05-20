export interface Task {
  id: string;
  title: string;
  description?: string;
  domain: string;
  status: 'pending' | 'done' | 'skipped' | 'snoozed';
  due_date?: string;
  created_at: string;
  completed_at?: string;
  ai_prepped: number;
  ai_prep_content?: string;
}

export interface DailyFocusItem {
  id: string;
  date: string;
  task_id: string;
  position: number;
  completed: number;
  // joined from tasks
  title: string;
  description?: string;
  domain: string;
  status: string;
  ai_prep_content?: string;
}

export interface Contact {
  id: string;
  name: string;
  role?: string;
  company?: string;
  relationship?: string;
  last_contact_date?: string;
  next_follow_up?: string;
  notes?: string;
  importance: number;
}

export interface SkillTrack {
  id: string;
  name: string;
  description?: string;
  total_lessons: number;
  completed_lessons: number;
  salary_range?: string;
}

export interface Streak {
  id: string;
  type: string;
  current_streak: number;
  longest_streak: number;
  last_completed?: string;
}

export interface Countdown {
  id: string;
  title: string;
  event_date: string;
  created_at: string;
}

export interface Goal {
  id: string;
  title: string;
  target_date?: string;
  status: string;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PathkeeperAPI {
  db: {
    getTasks: () => Promise<Task[]>;
    addTask: (task: Partial<Task>) => Promise<string>;
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
    getDailyFocus: (date: string) => Promise<DailyFocusItem[]>;
    completeFocusTask: (taskId: string, date: string) => Promise<void>;
    toggleFocusTask: (taskId: string, date: string) => Promise<number>;
    getContacts: () => Promise<Contact[]>;
    addContact: (contact: Partial<Contact>) => Promise<string>;
    updateContact: (id: string, updates: Partial<Contact>) => Promise<void>;
    getSkillTracks: () => Promise<SkillTrack[]>;
    getLessons: (trackId: string) => Promise<unknown[]>;
    completeLesson: (lessonId: string) => Promise<void>;
    getStreaks: () => Promise<Streak[]>;
    getChatHistory: () => Promise<ChatMessage[]>;
    addChatMessage: (role: string, content: string) => Promise<string>;
    clearChatHistory: () => Promise<void>;
    getGoals: () => Promise<Goal[]>;
    getSetting: (key: string) => Promise<string | null>;
    setSetting: (key: string, value: string) => Promise<void>;
    getCountdowns: () => Promise<Countdown[]>;
    addCountdown: (title: string, eventDate: string) => Promise<string>;
    deleteCountdown: (id: string) => Promise<void>;
  };
  ai: {
    sendMessage: (systemPrompt: string, messages: { role: string; content: string }[], model?: 'claude' | 'gemini') => Promise<string>;
    startPreworkGrill: (taskId: string) => Promise<string>;
    submitGrillAnswer: (taskId: string, answer: string) => Promise<{ completed: boolean; nextQuestion?: string }>;
    cancelGrill: (taskId: string) => Promise<void>;
    onStreamChunk: (cb: (chunk: string) => void) => void;
    onStreamDone: (cb: () => void) => void;
    removeStreamListeners: () => void;
    onDataChanged: (cb: () => void) => void;
    removeDataChangedListeners: () => void;
    onCountdownsUpdated: (cb: () => void) => void;
    removeCountdownsUpdatedListeners: () => void;
  };
}

declare global {
  interface Window {
    pathkeeper: PathkeeperAPI;
  }
}
