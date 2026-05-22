# PathKeeper — Phase 3 Spec
**Date:** May 21, 2026
**Owner:** Habib Saine (@hbsaine)
**For:** Claude Code / implementation reference

---

## Phase 3 Overview

Three pillars:
1. **Focus Slot Management** — fix the swap bug, add remove/swap tools
2. **Design Overhaul** — elevate the visual identity while keeping the dark purple/gold palette and alchemy motif
3. **Dual-Agent Architecture** — give Claude and Gemini distinct identities with avatars, architect for future orchestration (Claude delegates to Gemini), and embed lightweight Agent Arena observability into the chat

---

## Feature 1: Focus Slot Management

### Problem
When a user says "swap task X for task Y," the AI has no tool to remove a task from today's focus without marking it complete. The only path is `complete_task`, which permanently marks it done. Users should be able to rotate tasks in/out of focus freely.

### Implementation

**New DB function in `db.ts`:**
```typescript
export function removeFromFocus(taskId: string, date: string) {
  // Remove the daily_focus row — task stays pending
  db.prepare('DELETE FROM daily_focus WHERE task_id = ? AND date = ?').run(taskId, date);
  // Resequence positions
  const remaining = db.prepare(
    'SELECT id FROM daily_focus WHERE date = ? ORDER BY position'
  ).all(date) as { id: string }[];
  remaining.forEach((row, i) => {
    db.prepare('UPDATE daily_focus SET position = ? WHERE id = ?').run(i + 1, row.id);
  });
}
```

**New IPC + preload + type:**
- `main.ts`: `ipcMain.handle('db:removeFromFocus', (_e, taskId, date) => db.removeFromFocus(taskId, date));`
- `preload.ts`: `removeFromFocus: (taskId: string, date: string) => ipcRenderer.invoke('db:removeFromFocus', taskId, date),`
- `types.ts`: add `removeFromFocus` to `PathkeeperAPI.db`

**New AI tool in `ai.ts`:**
```typescript
{
  name: 'remove_from_focus',
  description: "Remove a task from today's focus without completing it. The task returns to pending. Use when swapping tasks or when the user defers a task to another day.",
  input_schema: {
    type: 'object' as const,
    properties: {
      task_id: { type: 'string', description: 'The ID of the task to remove from focus' },
    },
    required: ['task_id'],
  },
}
```

**Add case to `executeToolCall`:**
```typescript
case 'remove_from_focus': {
  const today = new Date().toISOString().slice(0, 10);
  removeFromFocus(input.task_id as string, today);
  notify();
  return { success: true, message: 'Task removed from focus, slot freed' };
}
```

**System prompt update in `systemPrompt.ts`:**
Add to TOOLS section:
```
- remove_from_focus(task_id): Remove a task from today's focus WITHOUT completing it. Use this when swapping tasks — remove first, then add_task with add_to_focus: true. NEVER use complete_task as a substitute for removing a task.
```

Add to RULES section:
```
FOCUS SWAPS:
- When the user asks to swap a focus task, ALWAYS use remove_from_focus first, then add_task with add_to_focus: true.
- NEVER mark a task complete just to free up a focus slot. Completing = done. Removing = deferred.
- If the user says "I'll do X instead of Y," remove Y from focus, add X to focus.
```

**`buildToolLog` update:**
```typescript
case 'remove_from_focus':
  return `Task ${input.task_id} removed from focus (still pending).`;
```

### Acceptance Criteria
- User says "swap X for Y" → AI removes X from focus (stays pending), adds Y to focus
- Removed task does NOT show as completed in Today's Focus or anywhere else
- Focus slot count correctly decrements after removal
- The 3-slot limit still enforced after swap

---

## Feature 2: Design Overhaul

### Philosophy
PathKeeper's visual identity should feel like a **dark occult command terminal** — the alchemy circle isn't decoration, it's the signature. Think Fullmetal Alchemist transmutation circles meets a Bloomberg terminal. The purple/gold palette stays. Everything else gets elevated.

### 2A: Alchemy Circle — Make It The Hero

The current alchemy circle is at `opacity: 0.038` — nearly invisible. It should be a living, reactive background element.

**Changes to `CommandCenter.tsx`:**
- Increase base opacity from `0.038` to `0.06-0.08`
- Add a **subtle pulse** that reacts to AI activity: when the AI is processing (tool calls, streaming), the circle pulses brighter (`opacity: 0.12`) and rotation speeds up
- Add a second concentric circle layer (smaller, counter-rotating) at a different speed
- The inner circle should glow faintly gold when all 3 focus tasks are complete (streak reward)

**Implementation approach:**
- Pass `isAiActive` prop from `App.tsx` → `CommandCenter.tsx` (derived from `isLoading` in useAI)
- Use CSS custom properties + transitions for reactive opacity/speed changes
- Add a new `AlchemyBackground` wrapper component that encapsulates both circles

```tsx
// New component: AlchemyBackground.tsx
interface Props {
  isActive: boolean;    // AI is processing
  allComplete: boolean; // all focus tasks done
  children: React.ReactNode;
}

export default function AlchemyBackground({ isActive, allComplete, children }: Props) {
  return (
    <div className="relative h-full">
      {/* Outer circle — slow rotation */}
      <div
        className="absolute pointer-events-none select-none"
        style={{
          top: '50%',
          left: '50%',
          width: '720px',
          height: '720px',
          transform: 'translate(-50%, -50%)',
          color: allComplete ? '#d4a017' : '#9333ea',
          opacity: isActive ? 0.12 : 0.065,
          animation: `alchemyRotate ${isActive ? '20s' : '60s'} linear infinite`,
          transition: 'opacity 1.5s ease, color 2s ease',
        }}
      >
        <AlchemyCircle />
      </div>

      {/* Inner circle — counter-rotating, smaller */}
      <div
        className="absolute pointer-events-none select-none"
        style={{
          top: '50%',
          left: '50%',
          width: '380px',
          height: '380px',
          transform: 'translate(-50%, -50%)',
          color: allComplete ? '#d4a017' : '#9333ea',
          opacity: isActive ? 0.08 : 0.04,
          animation: `alchemyRotate ${isActive ? '12s' : '35s'} linear infinite reverse`,
          transition: 'opacity 1.5s ease, color 2s ease',
        }}
      >
        <AlchemyCircle />
      </div>

      <div className="relative h-full">{children}</div>
    </div>
  );
}
```

### 2B: Panel Refinements

**Glass morphism upgrade for `.panel`:**
```css
.panel {
  background: rgba(15, 14, 24, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(147, 51, 234, 0.12);
  border-radius: 14px;
  box-shadow:
    0 0 0 1px rgba(147, 51, 234, 0.04),
    0 4px 24px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.02);
  transition: border-color 300ms ease, box-shadow 300ms ease;
}
.panel:hover {
  border-color: rgba(147, 51, 234, 0.25);
  box-shadow:
    0 0 0 1px rgba(147, 51, 234, 0.08),
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}
```

**Countdown numbers:** Add a faint text-shadow glow to urgent countdown numbers:
```css
/* Gold glow for urgent countdowns */
.countdown-urgent {
  text-shadow: 0 0 20px rgba(212, 160, 23, 0.3), 0 0 40px rgba(212, 160, 23, 0.1);
}
```

**Header refinement:**
- Add a very subtle gradient line below the header (gold → transparent → purple)
- The "PathKeeper" logo text should be slightly larger (16px) with more letter-spacing

### 2C: Chat Panel Visual Polish

**Message bubbles:**
- Assistant messages: add a faint inner glow on the left border (gold), slightly more padding
- User messages: keep the purple right-border but add subtle rounded corners refinement
- System log blocks (`[SYSTEM]`): render in a distinct monospace card with a terminal-green accent instead of inline gold — these should feel like "agent logs" not regular messages

**Streaming indicator:**
- Replace the blinking cursor with a small animated alchemy-style glyph (rotating ◎ or pulsing ◆)

---

## Feature 3: Dual-Agent Architecture with Observability

### Vision
Claude is the **Chief of Staff** — the orchestrator with tool access, full context, and decision authority. Gemini is the **Research Analyst** — fast, cheap, good at summarization, pre-work generation, and the grill flow. Today they're toggled manually. The future: Claude delegates to Gemini behind the scenes, and the user sees the coordination happening.

### 3A: Agent Identity System

Each AI gets a persistent visual identity:

**Claude — "The Strategist"**
- Avatar: A gold transmutation circle icon (simplified alchemy glyph)
- Color accent: Gold (`#d4a017`)
- Border: Gold left-border on messages
- Badge: `CLAUDE · STRATEGIST` in gold monospace
- Role: Tool use, task management, accountability, orchestration

**Gemini — "The Analyst"**
- Avatar: A cyan crystal/prism icon
- Color accent: Cyan (`#06b6d4`)
- Border: Cyan left-border on messages
- Badge: `GEMINI · ANALYST` in cyan monospace
- Role: Research, pre-work generation, grill flow, summarization

**Implementation in `ChatMessage.tsx`:**
```tsx
interface Props {
  message: ChatMessageType;
  model?: 'claude' | 'gemini';  // new prop
}

// Avatar component
function AgentAvatar({ model }: { model: 'claude' | 'gemini' }) {
  if (model === 'gemini') {
    return (
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
        <span style={{ fontSize: '14px', color: '#06b6d4' }}>◇</span>
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(212, 160, 23, 0.1)', border: '1px solid rgba(212, 160, 23, 0.25)' }}>
      <span style={{ fontSize: '14px', color: '#d4a017' }}>◎</span>
    </div>
  );
}
```

**Message layout changes:**
- Assistant messages now include the avatar on the left
- A small model badge below the avatar: `STRATEGIST` or `ANALYST`
- The left border color matches the agent's accent color

### 3B: Agent Activity Log (Mini Agent Arena)

When Claude executes tools, the `[SYSTEM]` log lines currently render inline. Upgrade these into an **Agent Activity Feed** — a collapsible section at the top of the chat panel that shows recent agent actions in real-time.

**New component: `AgentActivityFeed.tsx`**
```
┌─ AGENT ACTIVITY ──────────────────────────────┐
│ ◎ CLAUDE  complete_task → "Pack and prep"     │
│ ◎ CLAUDE  add_task → "AKPsi network overhaul" │
│ ◇ GEMINI  grill_step_1 → generating...        │
│ ◎ CLAUDE  remove_from_focus → task deferred   │
└────────────────────────────────────────────────┘
```

**Implementation:**
- New state in `useAI.ts`: `agentActions: AgentAction[]`
- Each tool execution pushes to this array with: `{ agent: 'claude' | 'gemini', tool: string, summary: string, timestamp: string }`
- The feed sits above the chat messages in `ChatPanel.tsx`, collapsible via a toggle
- Max 8 recent actions shown, scrollable
- Each action row has the agent avatar, tool name in monospace, and result summary
- Active/in-progress actions have a pulsing dot indicator

**Why this matters for Agent Arena:**
This is the same observability pattern from Agent Arena but simplified for a single-user app. When you later add multi-agent orchestration (Claude delegating to Gemini), the feed naturally shows the coordination:
```
◎ CLAUDE  delegate → GEMINI: "Research COBIT framework"
◇ GEMINI  research_complete → 3 sources found
◎ CLAUDE  add_task → "Review COBIT summary" [from Gemini research]
```

### 3C: Architecture for Future Orchestration

Don't implement full orchestration now, but lay the groundwork:

**Agent abstraction in a new file `electron/agents.ts`:**
```typescript
export interface AgentConfig {
  id: 'claude' | 'gemini';
  name: string;
  role: string;
  color: string;
  avatar: string;
  canUseTools: boolean;
  canOrchestrate: boolean;
}

export const AGENTS: Record<string, AgentConfig> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    role: 'Strategist',
    color: '#d4a017',
    avatar: '◎',
    canUseTools: true,
    canOrchestrate: true,
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    role: 'Analyst',
    color: '#06b6d4',
    avatar: '◇',
    canUseTools: false,     // for now
    canOrchestrate: false,
  },
};

export interface AgentAction {
  id: string;
  agent: 'claude' | 'gemini';
  tool: string;
  input_summary: string;
  result_summary: string;
  timestamp: string;
  status: 'running' | 'success' | 'error';
}
```

**Chat message model update in `types.ts`:**
```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: 'claude' | 'gemini';  // NEW: which agent produced this
}
```

**DB migration for `chat_messages`:**
```sql
ALTER TABLE chat_messages ADD COLUMN model TEXT DEFAULT 'claude';
```
(This also covers Phase 2 Feature #7B — model scoping for chat history)

**Future orchestration hook point in `ai.ts`:**
Add a comment block and type signature that makes it obvious where delegation will go:
```typescript
// ── Future: Agent Orchestration ─────────────────────────────
// When Claude's system prompt includes a `delegate_to_gemini` tool,
// this function will be called to spin up a Gemini sub-task.
// The result feeds back into Claude's agentic loop as a tool_result.
//
// export async function delegateToGemini(
//   task: string,
//   context: string,
//   win: BrowserWindow
// ): Promise<{ result: string; sources?: string[] }> { ... }
```

---

## Implementation Order

1. **Focus Slot Management** — highest urgency, it's a live bug
2. **Agent Identity System (3A)** — avatars, badges, message model tagging
3. **Agent Activity Feed (3B)** — mini Agent Arena in chat
4. **Design Overhaul (2A-2C)** — alchemy circle, panels, chat polish
5. **Agent Architecture (3C)** — types, config, DB migration, future hooks

---

## Files to Touch

| Feature | Files Modified |
|---------|---------------|
| Focus Swap | db.ts, main.ts, preload.ts, types.ts, ai.ts, systemPrompt.ts |
| Agent Identity | ChatMessage.tsx, ChatPanel.tsx, types.ts, useAI.ts |
| Agent Activity Feed | AgentActivityFeed.tsx (new), ChatPanel.tsx, useAI.ts, ai.ts |
| Design Overhaul | index.css, CommandCenter.tsx, AlchemyBackground.tsx (new), CountdownPanel.tsx, ChatMessage.tsx |
| Agent Architecture | agents.ts (new), types.ts, db.ts (migration) |

---

## Design Tokens (Reference)

```
Background:     #08070d (near-black)
Surface:        #0f0e18 (panels)
Elevated:       #16142a (inputs, code blocks)
Purple accent:  #9333ea → #c084fc (light)
Gold accent:    #d4a017 → #f5d76e (light)
Cyan accent:    #06b6d4 (Gemini)
Danger:         #dc2626
Success:        #16a34a
Text primary:   #e8e4f0
Text secondary: #6b6580
Text muted:     #3d3650
```
