import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import * as db from './db';
import * as ai from './ai';
import * as gemini from './gemini';

const isDev = process.env.NODE_ENV === 'development';

// Track the current window for AI streaming (updated when window is created)
let mainWin: BrowserWindow | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWin = win;

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.on('closed', () => {
    mainWin = null;
  });

  return win;
}

// Helper to get the current window (for AI handlers that need to stream)
function getWin(): BrowserWindow {
  if (mainWin && !mainWin.isDestroyed()) return mainWin;
  const wins = BrowserWindow.getAllWindows();
  if (wins.length > 0) return wins[0];
  throw new Error('No window available');
}

// Register IPC handlers ONCE at app startup (not per-window)
function registerIPC() {
  // DB handlers
  ipcMain.handle('db:getTasks', () => db.getTasks());
  ipcMain.handle('db:addTask', (_e, task) => db.addTask(task));
  ipcMain.handle('db:updateTask', (_e, id, updates) => db.updateTask(id, updates));
  ipcMain.handle('db:getDailyFocus', (_e, date) => db.getDailyFocus(date));
  ipcMain.handle('db:completeFocusTask', (_e, taskId, date) => db.completeFocusTask(taskId, date));
  ipcMain.handle('db:toggleFocusTask', (_e, taskId, date) => db.toggleFocusTask(taskId, date));

  ipcMain.handle('db:getContacts', () => db.getContacts());
  ipcMain.handle('db:addContact', (_e, contact) => db.addContact(contact));
  ipcMain.handle('db:updateContact', (_e, id, updates) => db.updateContact(id, updates));

  ipcMain.handle('db:getTransactions', (_e, month) => db.getTransactions(month));
  ipcMain.handle('db:addTransaction', (_e, tx) => db.addTransaction(tx));
  ipcMain.handle('db:getBudgets', (_e, month) => db.getBudgets(month));

  ipcMain.handle('db:getSkillTracks', () => db.getSkillTracks());
  ipcMain.handle('db:getLessons', (_e, trackId) => db.getLessons(trackId));
  ipcMain.handle('db:completeLesson', (_e, lessonId) => db.completeLesson(lessonId));

  ipcMain.handle('db:getStreaks', () => db.getStreaks());
  ipcMain.handle('db:getChatHistory', () => db.getChatHistory());
  ipcMain.handle('db:addChatMessage', (_e, role, content) => db.addChatMessage(role, content));
  ipcMain.handle('db:clearChatHistory', () => db.clearChatHistory());
  ipcMain.handle('db:getGoals', () => db.getGoals());
  ipcMain.handle('db:getCountdowns', () => db.getCountdowns());
  ipcMain.handle('db:addCountdown', (_e, title, event_date) => db.addCountdown(title, event_date));
  ipcMain.handle('db:deleteCountdown', (_e, id) => db.deleteCountdown(id));

  ipcMain.handle('db:getSetting', (_e, key) => db.getSetting(key));
  ipcMain.handle('db:setSetting', (_e, key, value) => {
    db.setSetting(key, value);
    if (key === 'anthropic_api_key') ai.setApiKey(value);
    if (key === 'gemini_api_key') gemini.setGeminiApiKey(value);
  });

  // AI handler — uses getWin() to dynamically resolve the current window
  ipcMain.handle('ai:sendMessage', async (_e, systemPrompt, messages, model) => {
    const win = getWin();
    try {
      return await ai.sendMessage(win, systemPrompt, messages, model);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'NO_API_KEY' || message === 'NO_GEMINI_API_KEY') {
        win.webContents.send('ai:stream-done');
        return message === 'NO_API_KEY' ? '__NO_API_KEY__' : '__NO_GEMINI_API_KEY__';
      }
      throw err;
    }
  });

  ipcMain.handle('ai:startPreworkGrill', async (_e, taskId) => {
    try {
      return await gemini.startPreworkGrill(taskId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'NO_GEMINI_API_KEY' || message.includes('NO_GEMINI_API_KEY')) {
        return '__NO_GEMINI_API_KEY__';
      }
      throw err;
    }
  });

  ipcMain.handle('ai:submitGrillAnswer', async (_e, taskId, answer) => {
    const win = getWin();
    try {
      return await gemini.submitGrillAnswer(taskId, answer, win);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'NO_GEMINI_API_KEY' || message.includes('NO_GEMINI_API_KEY')) {
        return '__NO_GEMINI_API_KEY__';
      }
      throw err;
    }
  });

  ipcMain.handle('ai:cancelGrill', async (_e, taskId) => {
    return await gemini.cancelGrill(taskId);
  });
}

app.whenReady().then(() => {
  // Initialize DB
  db.getDB();

  // Auto-launch on Mac login
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false,
  });

  // Register IPC handlers ONCE
  registerIPC();

  // Create the first window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
