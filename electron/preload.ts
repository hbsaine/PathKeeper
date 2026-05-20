import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('pathkeeper', {
  db: {
    getTasks: () => ipcRenderer.invoke('db:getTasks'),
    addTask: (task: unknown) => ipcRenderer.invoke('db:addTask', task),
    updateTask: (id: string, updates: unknown) => ipcRenderer.invoke('db:updateTask', id, updates),
    getDailyFocus: (date: string) => ipcRenderer.invoke('db:getDailyFocus', date),
    completeFocusTask: (taskId: string, date: string) => ipcRenderer.invoke('db:completeFocusTask', taskId, date),

    getContacts: () => ipcRenderer.invoke('db:getContacts'),
    addContact: (contact: unknown) => ipcRenderer.invoke('db:addContact', contact),
    updateContact: (id: string, updates: unknown) => ipcRenderer.invoke('db:updateContact', id, updates),

    getTransactions: (month: string) => ipcRenderer.invoke('db:getTransactions', month),
    addTransaction: (tx: unknown) => ipcRenderer.invoke('db:addTransaction', tx),
    getBudgets: (month: string) => ipcRenderer.invoke('db:getBudgets', month),

    getSkillTracks: () => ipcRenderer.invoke('db:getSkillTracks'),
    getLessons: (trackId: string) => ipcRenderer.invoke('db:getLessons', trackId),
    completeLesson: (lessonId: string) => ipcRenderer.invoke('db:completeLesson', lessonId),

    getStreaks: () => ipcRenderer.invoke('db:getStreaks'),
    getChatHistory: () => ipcRenderer.invoke('db:getChatHistory'),
    addChatMessage: (role: string, content: string) => ipcRenderer.invoke('db:addChatMessage', role, content),
    getGoals: () => ipcRenderer.invoke('db:getGoals'),

    getSetting: (key: string) => ipcRenderer.invoke('db:getSetting', key),
    setSetting: (key: string, value: string) => ipcRenderer.invoke('db:setSetting', key, value),
    getCountdowns: () => ipcRenderer.invoke('db:getCountdowns'),
    addCountdown: (title: string, eventDate: string) => ipcRenderer.invoke('db:addCountdown', title, eventDate),
  },
  ai: {
    sendMessage: (systemPrompt: string, messages: unknown) =>
      ipcRenderer.invoke('ai:sendMessage', systemPrompt, messages),
    startPreworkGrill: (taskId: string) =>
      ipcRenderer.invoke('ai:startPreworkGrill', taskId),
    submitGrillAnswer: (taskId: string, answer: string) =>
      ipcRenderer.invoke('ai:submitGrillAnswer', taskId, answer),
    cancelGrill: (taskId: string) =>
      ipcRenderer.invoke('ai:cancelGrill', taskId),
    onStreamChunk: (cb: (chunk: string) => void) => {
      ipcRenderer.on('ai:stream-chunk', (_event, chunk) => cb(chunk));
    },
    onStreamDone: (cb: () => void) => {
      ipcRenderer.on('ai:stream-done', cb);
    },
    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('ai:stream-chunk');
      ipcRenderer.removeAllListeners('ai:stream-done');
    },
    onDataChanged: (cb: () => void) => {
      ipcRenderer.on('db:changed', cb);
    },
    removeDataChangedListeners: () => {
      ipcRenderer.removeAllListeners('db:changed');
    },
  },
});
