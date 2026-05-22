import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

let db: Database.Database;

export function getDB(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'pathkeeper.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initSchema();
    runMigrations();
    seedIfEmpty();
    seedCountdownsIfEmpty();
  }
  return db;
}

function runMigrations() {
  const chatCols = db.prepare('PRAGMA table_info(chat_messages)').all() as Array<{ name: string }>;
  if (!chatCols.some(c => c.name === 'model')) {
    db.exec("ALTER TABLE chat_messages ADD COLUMN model TEXT DEFAULT 'claude'");
  }
  const cdCols = db.prepare('PRAGMA table_info(countdowns)').all() as Array<{ name: string }>;
  if (!cdCols.some(c => c.name === 'event_time')) {
    db.exec('ALTER TABLE countdowns ADD COLUMN event_time TEXT');
  }
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      domain TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      ai_prepped INTEGER DEFAULT 0,
      ai_prep_content TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_focus (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      task_id TEXT REFERENCES tasks(id),
      position INTEGER,
      completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      company TEXT,
      relationship TEXT,
      last_contact_date TEXT,
      next_follow_up TEXT,
      notes TEXT,
      importance INTEGER DEFAULT 3
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      category TEXT,
      description TEXT,
      date TEXT DEFAULT (date('now')),
      is_income INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      monthly_limit REAL NOT NULL,
      month TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skill_tracks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      total_lessons INTEGER DEFAULT 0,
      completed_lessons INTEGER DEFAULT 0,
      salary_range TEXT
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      track_id TEXT REFERENCES skill_tracks(id),
      title TEXT NOT NULL,
      content TEXT,
      duration_minutes INTEGER DEFAULT 10,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      order_num INTEGER
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_completed TEXT
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_date TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS countdowns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function seedIfEmpty() {
  const goalCount = (db.prepare('SELECT COUNT(*) as c FROM goals').get() as { c: number }).c;
  if (goalCount > 0) return;

  // Goals
  const goals = [
    { id: uuidv4(), title: 'Debt-free by 25', target_date: '2028-04-30', status: 'active', notes: null },
    { id: uuidv4(), title: 'Graduate University of Iowa', target_date: '2026-12-31', status: 'active', notes: null },
    { id: uuidv4(), title: 'Crush RSM internship → convert to full-time or exit to AI role', target_date: '2026-08-31', status: 'active', notes: null },
    { id: uuidv4(), title: 'Be in the room where enterprise AI decisions get made', target_date: '2028-05-31', status: 'active', notes: null },
  ];
  const insertGoal = db.prepare('INSERT INTO goals (id, title, target_date, status, notes) VALUES (?, ?, ?, ?, ?)');
  for (const g of goals) insertGoal.run(g.id, g.title, g.target_date, g.status, g.notes);

  // Skill tracks
  const tracks = [
    { id: uuidv4(), name: 'AI Engineering', description: 'Building AI systems: agents, RAG, embeddings, orchestration, prompt engineering.', total_lessons: 25, salary_range: '$130-180k AI Solutions Architect' },
    { id: uuidv4(), name: 'Enterprise AI Deployment', description: 'How to put AI into company workflows: change management, integration patterns, ROI measurement.', total_lessons: 20, salary_range: '$140-200k AI Strategy Consultant' },
    { id: uuidv4(), name: 'AI Governance & Risk', description: 'Frameworks for responsible AI: bias testing, model monitoring, compliance (EU AI Act, SOC2 for AI).', total_lessons: 20, salary_range: '$120-160k AI Governance Lead — brand new field, almost no competition' },
    { id: uuidv4(), name: 'Data Foundations', description: 'SQL, Python, data pipelines. The bedrock.', total_lessons: 30, salary_range: '$95-130k Data roles, prerequisite for everything else' },
    { id: uuidv4(), name: 'Enterprise Sales & Communication', description: 'Pitching AI to executives, writing proposals, building business cases.', total_lessons: 15, salary_range: 'The skill that turns technical ability into money' },
  ];
  const insertTrack = db.prepare('INSERT INTO skill_tracks (id, name, description, total_lessons, completed_lessons, salary_range) VALUES (?, ?, ?, ?, 0, ?)');
  for (const t of tracks) insertTrack.run(t.id, t.name, t.description, t.total_lessons, t.salary_range);

  // Sample lessons for AI Governance track
  const govTrack = tracks[2];
  const lessons = [
    { id: uuidv4(), track_id: govTrack.id, title: 'SOX IT Controls 101', duration_minutes: 10, order_num: 1 },
    { id: uuidv4(), track_id: govTrack.id, title: 'COBIT Framework Overview', duration_minutes: 10, order_num: 2 },
    { id: uuidv4(), track_id: govTrack.id, title: 'EU AI Act: What You Need to Know', duration_minutes: 10, order_num: 3 },
    { id: uuidv4(), track_id: govTrack.id, title: 'Model Risk Management Basics', duration_minutes: 10, order_num: 4 },
    { id: uuidv4(), track_id: govTrack.id, title: 'Bias Testing Frameworks', duration_minutes: 10, order_num: 5 },
  ];
  const insertLesson = db.prepare('INSERT INTO lessons (id, track_id, title, duration_minutes, completed, order_num) VALUES (?, ?, ?, ?, 0, ?)');
  for (const l of lessons) insertLesson.run(l.id, l.track_id, l.title, l.duration_minutes, l.order_num);

  // Contacts
  const contacts = [
    { id: uuidv4(), name: 'Mary Clare Toomajian', role: 'Sr. Campus Recruiter', company: 'RSM', relationship: 'rsm', importance: 5 },
    { id: uuidv4(), name: 'Nate Herkelman', role: 'Founder', company: 'Uppit AI / ex-Goldman Sachs', relationship: 'mentor', importance: 5 },
    { id: uuidv4(), name: 'Aiden Stanik', role: 'Former AKPsi President', company: 'Uppit AI', relationship: 'akpsi', importance: 4 },
    { id: uuidv4(), name: 'Cal', role: 'Advisor', company: 'Tippie Career Services', relationship: 'school', importance: 3 },
    { id: uuidv4(), name: 'Jonalyn Trimboli', role: 'Campus Recruiter', company: 'Uline', relationship: 'recruiter', importance: 3 },
  ];
  const insertContact = db.prepare('INSERT INTO contacts (id, name, role, company, relationship, importance) VALUES (?, ?, ?, ?, ?, ?)');
  for (const c of contacts) insertContact.run(c.id, c.name, c.role, c.company, c.relationship, c.importance);

  // Budgets for current month
  const month = new Date().toISOString().slice(0, 7);
  const budgets = [
    { category: 'food', monthly_limit: 300 },
    { category: 'rent', monthly_limit: 665 },
    { category: 'transport', monthly_limit: 150 },
    { category: 'entertainment', monthly_limit: 50 },
    { category: 'education', monthly_limit: 30 },
    { category: 'other', monthly_limit: 100 },
  ];
  const insertBudget = db.prepare('INSERT INTO budgets (id, category, monthly_limit, month) VALUES (?, ?, ?, ?)');
  for (const b of budgets) insertBudget.run(uuidv4(), b.category, b.monthly_limit, month);

  // Streaks
  const insertStreak = db.prepare('INSERT INTO streaks (id, type, current_streak, longest_streak) VALUES (?, ?, 0, 0)');
  insertStreak.run(uuidv4(), 'daily_tasks');
  insertStreak.run(uuidv4(), 'skills');
  insertStreak.run(uuidv4(), 'check_in');

  // Seed 3 initial tasks for daily focus
  const today = new Date().toISOString().slice(0, 10);
  const taskIds = [uuidv4(), uuidv4(), uuidv4()];
  const insertTask = db.prepare('INSERT INTO tasks (id, title, description, domain, status, due_date) VALUES (?, ?, ?, ?, ?, ?)');
  insertTask.run(taskIds[0], 'Review RSM onboarding packet', 'Read through all pre-start materials from RSM', 'rsm', 'pending', today);
  insertTask.run(taskIds[1], 'Email Nate Herkelman', 'Follow up on last conversation — share what you\'ve built recently', 'network', 'pending', today);
  insertTask.run(taskIds[2], 'Complete AI Governance lesson', 'SOX IT Controls 101 — 10 minutes', 'skills', 'pending', today);

  const insertFocus = db.prepare('INSERT INTO daily_focus (id, date, task_id, position, completed) VALUES (?, ?, ?, ?, 0)');
  insertFocus.run(uuidv4(), today, taskIds[0], 1);
  insertFocus.run(uuidv4(), today, taskIds[1], 2);
  insertFocus.run(uuidv4(), today, taskIds[2], 3);
}

function seedCountdownsIfEmpty() {
  const count = (db.prepare('SELECT COUNT(*) as c FROM countdowns').get() as { c: number }).c;
  if (count > 0) return;
  const insert = db.prepare('INSERT INTO countdowns (id, title, event_date) VALUES (?, ?, ?)');
  insert.run(uuidv4(), 'RSM Day 1', '2026-06-15');
  insert.run(uuidv4(), 'Graduation', '2026-12-31');
}

// ── Query functions ──────────────────────────────────────────────────

export function getTasks() {
  return db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
}

export function addTask(task: { title: string; description?: string; domain: string; due_date?: string }) {
  const id = uuidv4();
  db.prepare('INSERT INTO tasks (id, title, description, domain, due_date) VALUES (?, ?, ?, ?, ?)').run(
    id, task.title, task.description ?? null, task.domain, task.due_date ?? null
  );
  return id;
}

export function updateTask(id: string, updates: Record<string, unknown>) {
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  db.prepare(`UPDATE tasks SET ${fields} WHERE id = ?`).run(...values, id);
}

export function getDailyFocus(date: string) {
  return db.prepare(`
    SELECT df.*, t.title, t.description, t.domain, t.status, t.ai_prep_content
    FROM daily_focus df
    JOIN tasks t ON t.id = df.task_id
    WHERE df.date = ?
    ORDER BY df.position
  `).all(date);
}

export function completeFocusTask(taskId: string, date: string) {
  db.prepare('UPDATE daily_focus SET completed = 1 WHERE task_id = ? AND date = ?').run(taskId, date);
  db.prepare("UPDATE tasks SET status = ?, completed_at = datetime('now') WHERE id = ?").run('done', taskId);
  updateStreak('daily_tasks');
}

export function getContacts() {
  return db.prepare('SELECT * FROM contacts ORDER BY importance DESC').all();
}

export function addContact(contact: Record<string, unknown>) {
  const id = uuidv4();
  const c = contact as { name: string; role?: string; company?: string; relationship?: string; notes?: string; importance?: number };
  db.prepare('INSERT INTO contacts (id, name, role, company, relationship, notes, importance) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, c.name, c.role ?? null, c.company ?? null, c.relationship ?? null, c.notes ?? null, c.importance ?? 3
  );
  return id;
}

export function updateContact(id: string, updates: Record<string, unknown>) {
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updates);
  db.prepare(`UPDATE contacts SET ${fields} WHERE id = ?`).run(...values, id);
}

export function getTransactions(month: string) {
  return db.prepare("SELECT * FROM transactions WHERE strftime('%Y-%m', date) = ? ORDER BY date DESC").all(month);
}

export function addTransaction(tx: { amount: number; category: string; description: string; is_income?: number }) {
  const id = uuidv4();
  db.prepare('INSERT INTO transactions (id, amount, category, description, is_income) VALUES (?, ?, ?, ?, ?)').run(
    id, tx.amount, tx.category, tx.description, tx.is_income ?? 0
  );
  return id;
}

export function getBudgets(month: string) {
  return db.prepare('SELECT * FROM budgets WHERE month = ?').all(month);
}

export function getSkillTracks() {
  return db.prepare('SELECT * FROM skill_tracks').all();
}

export function getLessons(trackId: string) {
  return db.prepare('SELECT * FROM lessons WHERE track_id = ? ORDER BY order_num').all(trackId);
}

export function completeLesson(lessonId: string) {
  db.prepare("UPDATE lessons SET completed = 1, completed_at = datetime('now') WHERE id = ?").run(lessonId);
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId) as { track_id: string } | undefined;
  if (lesson) {
    db.prepare('UPDATE skill_tracks SET completed_lessons = completed_lessons + 1 WHERE id = ?').run(lesson.track_id);
  }
  updateStreak('skills');
}

export function getStreaks() {
  return db.prepare('SELECT * FROM streaks').all();
}

export function updateStreak(type: string) {
  const today = new Date().toISOString().slice(0, 10);
  const streak = db.prepare('SELECT * FROM streaks WHERE type = ?').get(type) as {
    id: string; current_streak: number; longest_streak: number; last_completed: string | null
  } | undefined;
  if (!streak) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let newStreak = 1;
  if (streak.last_completed === yesterday) {
    newStreak = streak.current_streak + 1;
  } else if (streak.last_completed === today) {
    return; // already updated today
  }

  const longest = Math.max(newStreak, streak.longest_streak);
  db.prepare('UPDATE streaks SET current_streak = ?, longest_streak = ?, last_completed = ? WHERE type = ?').run(
    newStreak, longest, today, type
  );
}

export function getChatHistory() {
  return db.prepare('SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT 40').all();
}

export function addChatMessage(role: string, content: string, model = 'claude') {
  const id = uuidv4();
  db.prepare('INSERT INTO chat_messages (id, role, content, model) VALUES (?, ?, ?, ?)').run(id, role, content, model);
  return id;
}

export function getPreppedTasks() {
  return db.prepare("SELECT id, title FROM tasks WHERE ai_prepped = 1 AND status != ? ORDER BY created_at DESC LIMIT 5").all('done') as Array<{ id: string; title: string }>;
}

export function clearChatHistory() {
  db.prepare('DELETE FROM chat_messages').run();
}

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getGoals() {
  return db.prepare("SELECT * FROM goals WHERE status = 'active'").all();
}

export function completeTaskById(id: string) {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare("UPDATE tasks SET status = ?, completed_at = datetime('now') WHERE id = ?").run('done', id);
  db.prepare('UPDATE daily_focus SET completed = 1 WHERE task_id = ? AND date = ?').run(id, today);
  updateStreak('daily_tasks');
}

export function addToFocus(taskId: string, date: string): boolean {
  const existing = (db.prepare('SELECT COUNT(*) as c FROM daily_focus WHERE date = ?').get(date) as { c: number }).c;
  if (existing >= 3) return false;
  db.prepare('INSERT INTO daily_focus (id, date, task_id, position, completed) VALUES (?, ?, ?, ?, 0)')
    .run(uuidv4(), date, taskId, existing + 1);
  return true;
}

export function getCountdowns() {
  return db.prepare('SELECT * FROM countdowns ORDER BY event_date ASC').all();
}

export function addCountdown(title: string, event_date: string, event_time?: string) {
  const id = uuidv4();
  db.prepare('INSERT INTO countdowns (id, title, event_date, event_time) VALUES (?, ?, ?, ?)').run(id, title, event_date, event_time ?? null);
  return id;
}

export function deleteCountdown(id: string) {
  db.prepare('DELETE FROM countdowns WHERE id = ?').run(id);
}

export function updateCountdown(id: string, updates: { title?: string; event_date?: string; event_time?: string }) {
  const entries = Object.entries(updates).filter(([, v]) => v !== undefined);
  if (!entries.length) return;
  const fields = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);
  db.prepare(`UPDATE countdowns SET ${fields} WHERE id = ?`).run(...values, id);
}

export function toggleFocusTask(taskId: string, date: string) {
  const row = db.prepare('SELECT completed FROM daily_focus WHERE task_id = ? AND date = ?').get(taskId, date) as { completed: number } | undefined;
  const isCurrentlyDone = row?.completed === 1;
  const newCompleted = isCurrentlyDone ? 0 : 1;
  db.prepare('UPDATE daily_focus SET completed = ? WHERE task_id = ? AND date = ?').run(newCompleted, taskId, date);
  if (newCompleted === 1) {
    db.prepare("UPDATE tasks SET status = ?, completed_at = datetime('now') WHERE id = ?").run('done', taskId);
    updateStreak('daily_tasks');
  } else {
    db.prepare('UPDATE tasks SET status = ?, completed_at = NULL WHERE id = ?').run('pending', taskId);
  }
  return newCompleted;
}
