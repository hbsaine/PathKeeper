# PathKeeper — Phase 2 Implementation Spec
**Date:** May 21, 2026
**Owner:** Habib Saine (@hbsaine)
**For:** Claude Code / Antigravity — implementation reference

---

## Current State Summary

PathKeeper is a native Mac Electron app (React 18 + Vite + Tailwind + TypeScript + better-sqlite3 + Anthropic API + Gemini API). Split-panel layout: left = command center, right = AI chief of staff chat with real-time tool use.

**What works now:**
- 7 AI tools (complete_task, add_task, update_task, add_contact, add_countdown, update_countdown, delete_countdown)
- Standard Anthropic SDK (v0.97) with agentic loop (max 5 rounds, error handling)
- Gemini 3.5 Flash for pre-work grill + secondary chat (no tool use)
- Today's Focus with bidirectional toggle, CountdownPanel with SVG arcs, SkillsPanel, streak tracking
- IPC registered once at app.whenReady(), dynamic window resolution
- SQLite with WAL mode, 12 tables, UUID primary keys

**Repo:** github.com/hbsaine/pathkeeper
**Local:** ~/pathkeeper

---

## Phase 2 Features (Priority Order)

### 1. Morning Auto-Briefing

**What:** On app launch, the AI proactively generates today's briefing without user input. Appears as the first message in chat.

**Implementation:**
- In `electron/main.ts`: after `createWindow()`, wait for `win.webContents.on('did-finish-load')`, then emit a new IPC event `ai:morning-briefing`
- In `src/App.tsx`: listen for `ai:morning-briefing` via preload, trigger `sendMessage()` with a special system-only prompt
- The briefing prompt should be a variation of the existing system prompt with an added instruction: "Generate this morning's briefing. Include: today's focus tasks, approaching countdowns (next 7 days), overdue items, streak status, and one proactive recommendation. Do NOT wait for user input."
- Add a setting `last_briefing_date` in SQLite to prevent duplicate briefings if the app is relaunched same-day
- The briefing should use Claude (not Gemini) since it needs tool awareness for proactive task creation

**Acceptance criteria:**
- App opens → AI message appears automatically within 3-5 seconds
- Briefing includes tasks, countdowns, and streak status
- AI may proactively call `add_task` if it identifies gaps (e.g., "RSM is 24 days out and you have no prep tasks")
- Does not re-trigger on same-day relaunch

---

### 2. True Claude Streaming

**What:** Claude responses stream token-by-token like Gemini does, instead of arriving in blocks per agentic loop round.

**Implementation:**
- In `electron/ai.ts` Claude path: replace `anthropic.messages.create()` with `anthropic.messages.stream()`
- Use the stream event API:
```typescript
const stream = anthropic.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: systemPrompt,
  messages: sdkMessages,
  tools: TOOLS,
});

stream.on('text', (text) => {
  fullText += text;
  win.webContents.send('ai:stream-chunk', text);
});

const finalMessage = await stream.finalMessage();
```
- The agentic loop still works: check `finalMessage.stop_reason === 'tool_use'`, process tools, push results, start a new stream
- Each stream iteration streams text live; tool processing happens between iterations
- Keep the existing `ai:stream-done` event firing after the full loop

**Acceptance criteria:**
- Claude text appears character-by-character in the chat, matching Gemini's streaming feel
- Tool calls still work correctly between streaming rounds
- No regression on tool execution or UI refresh

---

### 3. Network Pulse System

**What:** Surface the existing contacts table in the UI with AI-powered follow-up tracking.

**Implementation:**

**New UI component: `NetworkPanel.tsx`**
- Sits below the CountdownPanel/SkillsPanel grid in CommandCenter
- Shows top 5 contacts by importance, with name, role, company, and "last mentioned" date
- Contacts with stale follow-ups (>14 days since last mention) get an amber warning indicator
- Click a contact → expands to show notes and a "Draft Follow-up" button that triggers the grill flow

**New DB functions in `db.ts`:**
- `updateContactLastMention(contactId, date)` — called when the AI mentions a contact name
- `getStaleContacts(daysSince)` — returns contacts not mentioned in N days

**New AI tool: `update_contact_note`**
```typescript
{
  name: 'update_contact_note',
  description: 'Add a note or update last contact date for a person in the network.',
  input_schema: {
    type: 'object',
    properties: {
      contact_id: { type: 'string' },
      notes: { type: 'string' },
      last_contact_date: { type: 'string', description: 'ISO date of last interaction' }
    },
    required: ['contact_id']
  }
}
```

**System prompt update:** Add stale contacts to the live context section:
```
STALE CONTACTS (no mention in 14+ days):
  - Mary Clare Toomajian [ID: xxx] — RSM recruiter — 18 days
```

**Acceptance criteria:**
- NetworkPanel renders contacts from SQLite
- Stale contacts are flagged visually and in the system prompt
- AI proactively warns about stale follow-ups in briefings
- "Draft Follow-up" button triggers the Gemini grill flow for that contact

---

### 4. Smart Task Inference from Chat

**What:** When the user mentions an actionable item conversationally, the AI automatically creates a task without being explicitly asked.

**Implementation:**
- This is primarily a system prompt change, not a code change
- Add to the RULES section of `systemPrompt.ts`:
```
TASK INFERENCE:
- When the user mentions something they need to do ("I need to email Nate", "gotta pack for Minneapolis", "should look into COBIT"), immediately call add_task with an appropriate title, domain, and due_date if inferable.
- If the task is urgent (due within 3 days), set add_to_focus: true.
- Do NOT ask "would you like me to create a task for that?" — just do it. You are a chief of staff, not a chatbot.
- After creating the task, mention it briefly in your response: "Tracked: [task title]"
```
- No code changes needed beyond the prompt update — the `add_task` tool already supports this

**Acceptance criteria:**
- User says "I should email Mary Clare about the packet" → AI calls `add_task` with title "Email Mary Clare about RSM packet", domain "rsm"
- Task appears in the left panel without user explicitly requesting it
- AI confirms briefly: "Tracked: Email Mary Clare about RSM packet"

---

### 5. Dynamic Pre-Working Panel

**What:** Replace the hardcoded "RSM packing list / COBIT overview / Email to Nate" chips with actual prepped tasks.

**Implementation:**
- In `electron/db.ts`: add `getPreppedTasks()`:
```typescript
export function getPreppedTasks() {
  return db.prepare('SELECT id, title FROM tasks WHERE ai_prepped = 1 AND status != ? ORDER BY created_at DESC LIMIT 5').all('done');
}
```
- Add IPC handler in `main.ts` and bridge in `preload.ts`
- In `src/hooks/useDB.ts`: add `usePreppedTasks(refreshKey)` hook
- In `CommandCenter.tsx`: replace the static array with the hook results
- Each chip should be clickable → scrolls to or expands that task in TodaysFocus (if it's in focus) or shows a preview modal

**Acceptance criteria:**
- Pre-Working panel shows tasks that have completed the grill flow
- New preps appear automatically after the grill completes (via refreshKey)
- Panel is empty with a subtle "No pre-work ready" message when nothing is prepped
- Completed tasks don't appear

---

### 6. Error Feedback in Chat

**What:** When API calls fail (rate limit, auth, network), show a styled error message in chat instead of silent failure.

**Implementation:**
- In `src/hooks/useAI.ts`, in the `catch` block of `sendMessage`:
```typescript
catch (err) {
  console.error('AI error:', err);
  const errorMsg: ChatMessage = {
    id: (Date.now() + 1).toString(),
    role: 'assistant',
    content: `[ERROR] ${err instanceof Error ? err.message : 'Connection failed. Check your API key and network.'}`,
    timestamp: new Date().toISOString(),
  };
  const errorMessages = [...messagesRef.current, errorMsg];
  messagesRef.current = errorMessages;
  setMessages(errorMessages);
  setIsLoading(false);
  setStreamingText('');
}
```
- In `ChatMessage.tsx`: detect `[ERROR]` prefix and render with a red/danger styling instead of the normal assistant message card

**Acceptance criteria:**
- API failure → red-styled error message appears in chat
- User can continue chatting after the error (not stuck in loading state)
- Error messages are not saved to chat_messages table (transient only)

---

### 7. Chat History Improvements

**What:** Fix the 10-message display limit and scope history by model.

**Implementation:**

**A. Remove display truncation:**
- In `ChatPanel.tsx` line 165: change `messages.slice(-10)` to `messages` (show all messages)
- The container already has `overflow-y-auto` so scrolling works

**B. Add model column to chat_messages:**
- In `db.ts` schema: `ALTER TABLE chat_messages ADD COLUMN model TEXT DEFAULT 'claude'`
- Handle migration: check if column exists before altering (for existing DBs)
- Update `addChatMessage` to accept and store model
- Update `getChatHistory` to optionally filter by model
- In `useAI.ts`: pass `selectedModel` when calling `addChatMessage`

**C. Clear chat on model switch (simple approach):**
- When `changeModel` is called, don't clear the DB — just filter displayed messages by model
- Or: show a visual separator "— Switched to Gemini 3.5 Flash —" in the chat feed

**Acceptance criteria:**
- All messages visible (no truncation)
- Messages tagged with which model produced them
- Switching models doesn't show cross-model history confusion

---

### 8. Gemini Tool Use Indicator

**What:** When Gemini is selected, display a clear indicator that tool use (modifying the left panel) is disabled.

**Implementation:**
- In `ChatPanel.tsx`: when `selectedModel === 'gemini'`, show a subtle banner below the header:
```tsx
{selectedModel === 'gemini' && (
  <div className="px-4 py-1.5 text-[10px] text-cyan-400/60 bg-cyan-500/5 border-b border-cyan-500/10 font-mono">
    Gemini mode — chat only, no panel modifications
  </div>
)}
```
- Alternative: add tool use to Gemini via Google's function calling API (more complex, lower priority)

**Acceptance criteria:**
- Switching to Gemini shows the indicator
- Switching back to Claude hides it
- Users understand that commands like "mark task done" won't execute on Gemini

---

### 9. Financial Snapshot Panel

**What:** Surface the existing budgets/transactions tables with a simple monthly overview.

**Implementation:**

**New component: `FinancePanel.tsx`**
- Compact panel below the Pre-Working section
- Shows: total spent this month, budget remaining, top 3 categories by spend
- Red indicator if any category is >80% of budget
- "Add Expense" button → inline input (amount, category dropdown, description)

**New AI tools:**
```typescript
{
  name: 'add_transaction',
  description: 'Log an expense or income.',
  input_schema: {
    type: 'object',
    properties: {
      amount: { type: 'number' },
      category: { type: 'string', enum: ['food', 'rent', 'transport', 'entertainment', 'education', 'other'] },
      description: { type: 'string' },
      is_income: { type: 'boolean' }
    },
    required: ['amount', 'category', 'description']
  }
}
```

**System prompt update:** Add monthly budget summary to live context.

**Acceptance criteria:**
- Panel shows current month spending vs budget
- AI can log expenses via tool use ("spent $12 on lunch" → add_transaction)
- Over-budget categories flagged in red
- AI warns proactively when spending trends suggest budget will be exceeded

---

### 10. Skill Lesson Delivery

**What:** Generate and deliver actual lesson content from the skill tracks.

**Implementation:**
- Fix `SkillsPanel.tsx` to show the actual next uncompleted lesson title (currently hardcoded to "SOX IT Controls 101")
- Add a "Start Lesson" button that sends a special message to the AI:
  - System prompt addition: "When the user starts a skill lesson, generate a focused 10-minute lesson on [lesson title] from the [track name] track. Include: key concepts, 2-3 real-world examples, and 1 practice question. Mark the lesson complete via the tool after delivery."
- Add `complete_lesson` tool to `ai.ts`:
```typescript
{
  name: 'complete_lesson',
  description: 'Mark a skill lesson as completed.',
  input_schema: {
    type: 'object',
    properties: {
      lesson_id: { type: 'string' }
    },
    required: ['lesson_id']
  }
}
```
- System prompt: include current track progress and next lesson ID

**Acceptance criteria:**
- SkillsPanel shows correct next lesson title
- "Start Lesson" generates a structured lesson in chat
- Lesson completion updates the progress bar
- Streak increments for skills track

---

## Implementation Order

For Antigravity / Claude Code, implement in this order:

1. **Morning Auto-Briefing** — highest user impact, makes the app feel alive
2. **True Claude Streaming** — quality-of-life, makes Claude feel as responsive as Gemini
3. **Smart Task Inference** — prompt-only change, zero code risk, big UX win
4. **Dynamic Pre-Working Panel** — simple DB query + UI swap, removes hardcoded data
5. **Error Feedback in Chat** — safety net for API failures
6. **Chat History Improvements** — removes the 10-message truncation, adds model scoping
7. **Gemini Tool Use Indicator** — one JSX snippet, prevents user confusion
8. **Network Pulse System** — new panel + tool + prompt update
9. **Skill Lesson Delivery** — new tool + panel fix + prompt update
10. **Financial Snapshot Panel** — new panel + tool, lowest priority since budgets aren't urgent pre-RSM

---

## Files to Touch

| Feature | Files Modified |
|---------|---------------|
| Morning Briefing | main.ts, preload.ts, App.tsx, useAI.ts |
| Claude Streaming | ai.ts |
| Task Inference | systemPrompt.ts |
| Dynamic Pre-Work | db.ts, main.ts, preload.ts, useDB.ts, CommandCenter.tsx |
| Error Feedback | useAI.ts, ChatMessage.tsx |
| Chat History | ChatPanel.tsx, db.ts, useAI.ts, preload.ts |
| Gemini Indicator | ChatPanel.tsx |
| Network Pulse | db.ts, main.ts, preload.ts, useDB.ts, systemPrompt.ts, ai.ts, NetworkPanel.tsx (new), CommandCenter.tsx |
| Skill Lessons | ai.ts, db.ts, main.ts, preload.ts, systemPrompt.ts, SkillsPanel.tsx |
| Finance Panel | ai.ts, db.ts, main.ts, preload.ts, systemPrompt.ts, FinancePanel.tsx (new), CommandCenter.tsx |

---

## Architecture Notes for the Implementing Agent

- **IPC pattern:** All new DB functions need: export in db.ts → ipcMain.handle in main.ts → contextBridge in preload.ts → hook in useDB.ts
- **Tool pattern:** Define in TOOLS array in ai.ts → add case to executeToolCall switch → call notify() after mutation → add to system prompt TOOLS section
- **Refresh pattern:** All hooks take refreshKey. After any tool mutation, ai.ts fires `win.webContents.send('db:changed')`. App.tsx bumps refreshKey. All hooks re-fetch.
- **Countdowns have a dedicated event:** `countdowns-updated` fires separately for the CountdownPanel's independent listener
- **System prompt is in `src/lib/systemPrompt.ts`** — it builds dynamically from live data. Any new live context (contacts, finances, lessons) needs to be passed into `buildSystemPrompt()` and threaded through `useAI` → `App.tsx`
- **Don't use the beta tools namespace** — it was removed. Use `anthropic.messages.create()` or `anthropic.messages.stream()` with `tools: TOOLS` directly
- **SQLite quoting:** Use double-quoted strings with single-quoted SQL values: `db.prepare("UPDATE x SET y = datetime('now')").run()`
- **Agentic loop has a 5-round max** — don't increase this without good reason
- **SDK version is 0.97** — use the standard messages API, not any beta or legacy namespace
