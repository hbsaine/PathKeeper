import Anthropic from '@anthropic-ai/sdk';
import { BrowserWindow } from 'electron';
import { getSetting, addTask, updateTask, completeTaskById, addToFocus, addContact, addCountdown, deleteCountdown, updateCountdown } from './db';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = getSetting('anthropic_api_key');
    if (!apiKey) throw new Error('NO_API_KEY');
    client = new Anthropic({ apiKey });
  }
  return client;
}

export function setApiKey(key: string) {
  client = new Anthropic({ apiKey: key });
}

// Standard messages API tool definitions (no beta namespace)
const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'complete_task',
    description: 'Mark a task as done. Use when the user says they completed or finished a task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'The ID of the task to mark complete' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'add_task',
    description: "Create a new task and optionally add it to today's daily focus (max 3 focus slots).",
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title' },
        domain: {
          type: 'string',
          enum: ['rsm', 'akpsi', 'school', 'finance', 'network', 'skills', 'personal'],
          description: 'Which life domain this belongs to',
        },
        due_date: { type: 'string', description: 'Optional ISO date YYYY-MM-DD' },
        add_to_focus: { type: 'boolean', description: "Add to today's focus panel if a slot is open" },
      },
      required: ['title', 'domain'],
    },
  },
  {
    name: 'update_task',
    description: "Update a task's title or domain.",
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string' },
        title: { type: 'string' },
        domain: { type: 'string' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'add_contact',
    description: 'Add a new person to the network panel.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        role: { type: 'string' },
        company: { type: 'string' },
        relationship: {
          type: 'string',
          enum: ['rsm', 'akpsi', 'mentor', 'recruiter', 'friend', 'alumni', 'school'],
        },
        importance: { type: 'number', description: '1-5, 5 being most important' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_countdown',
    description: 'Add a countdown event (deadline, meeting, or milestone) to the countdown panel.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Event name' },
        event_date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
      },
      required: ['title', 'event_date'],
    },
  },
  {
    name: 'update_countdown',
    description: 'Update a countdown event (title or date).',
    input_schema: {
      type: 'object' as const,
      properties: {
        countdown_id: { type: 'string', description: 'The ID of the countdown to update' },
        title: { type: 'string', description: 'New title (optional)' },
        event_date: { type: 'string', description: 'New ISO date (optional)' },
      },
      required: ['countdown_id'],
    },
  },
  {
    name: 'delete_countdown',
    description: 'Delete a countdown event from the countdown panel. Use when the user requests to remove or delete a countdown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        countdown_id: { type: 'string', description: 'The ID of the countdown to delete' },
      },
      required: ['countdown_id'],
    },
  },
];

async function executeToolCall(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const today = new Date().toISOString().slice(0, 10);
  const win = BrowserWindow.getAllWindows()[0];
  const notify = () => { if (win) win.webContents.send('db:changed'); };
  const notifyCountdowns = () => { if (win) win.webContents.send('countdowns-updated'); };

  switch (name) {
    case 'complete_task': {
      completeTaskById(input.task_id as string);
      notify();
      return { success: true };
    }
    case 'add_task': {
      const taskId = addTask({
        title: input.title as string,
        domain: input.domain as string,
        due_date: input.due_date as string | undefined,
      });
      const addedToFocus = input.add_to_focus ? addToFocus(taskId, today) : false;
      notify();
      return { success: true, task_id: taskId, added_to_focus: addedToFocus };
    }
    case 'update_task': {
      const updates: Record<string, unknown> = {};
      if (input.title) updates.title = input.title;
      if (input.domain) updates.domain = input.domain;
      updateTask(input.task_id as string, updates);
      notify();
      return { success: true };
    }
    case 'add_contact': {
      const id = addContact({
        name: input.name,
        role: input.role,
        company: input.company,
        relationship: input.relationship,
        importance: input.importance ?? 3,
      });
      notify();
      return { success: true, contact_id: id };
    }
    case 'add_countdown': {
      const id = addCountdown(input.title as string, input.event_date as string);
      notify();
      notifyCountdowns();
      return { success: true, countdown_id: id };
    }
    case 'update_countdown': {
      updateCountdown(input.countdown_id as string, {
        title: input.title as string | undefined,
        event_date: input.event_date as string | undefined,
      });
      notify();
      notifyCountdowns();
      return { success: true };
    }
    case 'delete_countdown': {
      deleteCountdown(input.countdown_id as string);
      notify();
      notifyCountdowns();
      return { success: true };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function sendMessage(
  win: BrowserWindow,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  model: 'claude' | 'gemini' = 'claude'
): Promise<string> {
  // ── Gemini path (streaming, no tools) ────────────────────────────
  if (model === 'gemini') {
    const { getGeminiClient } = require('./gemini');
    const geminiClient = getGeminiClient();

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    try {
      const responseStream = await geminiClient.models.generateContentStream({
        model: 'gemini-3.5-flash',
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
        }
      });

      let fullText = '';
      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        if (text) {
          fullText += text;
          win.webContents.send('ai:stream-chunk', text);
        }
      }
      win.webContents.send('ai:stream-done');
      return fullText;
    } catch (err) {
      console.error('[Gemini error in sendMessage]:', err);
      win.webContents.send('ai:stream-done');
      throw err;
    }
  }

  // ── Claude path (streaming + tool use agentic loop) ──────────────
  const anthropic = getClient();

  // Build the messages array for the API — supports both string and ContentBlock[]
  const sdkMessages: Anthropic.Messages.MessageParam[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  let fullText = '';
  const toolSystemLogs: string[] = [];
  const MAX_TOOL_ROUNDS = 5;
  let round = 0;

  // Agentic loop: keep going until the model stops using tools
  while (round < MAX_TOOL_ROUNDS) {
    round++;
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: sdkMessages,
      tools: TOOLS,
    });

    // Collect text blocks and stream them incrementally
    for (const block of response.content) {
      if (block.type === 'text') {
        fullText += block.text;
        win.webContents.send('ai:stream-chunk', block.text);
      }
    }

    // If the model didn't request tool use, we're done
    if (response.stop_reason !== 'tool_use') break;

    // Process tool calls
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        let result: unknown;
        try {
          result = await executeToolCall(block.name, block.input as Record<string, unknown>);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Tool error] ${block.name}:`, errMsg);
          result = { error: errMsg };
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
        // Build system log line for the chat
        const logLine = buildToolLog(block.name, block.input as Record<string, unknown>, result);
        if (logLine) {
          toolSystemLogs.push(logLine);
          // Stream the system log immediately so user sees it
          win.webContents.send('ai:stream-chunk', `\n[SYSTEM] ${logLine}\n`);
          fullText += `\n[SYSTEM] ${logLine}\n`;
        }
      }
    }

    // Append the assistant's response (with tool_use blocks) and tool results
    sdkMessages.push({
      role: 'assistant',
      content: response.content,
    });
    sdkMessages.push({
      role: 'user',
      content: toolResults,
    });
  }

  // Notify UI to refresh AFTER the entire agentic loop completes
  // This ensures all tool mutations are done before the UI re-fetches
  if (toolSystemLogs.length > 0) {
    win.webContents.send('db:changed');
    win.webContents.send('countdowns-updated');
  }

  win.webContents.send('ai:stream-done');
  return fullText;
}

// Build a human-readable log line for tool executions
function buildToolLog(name: string, input: Record<string, unknown>, result: unknown): string | null {
  const r = result as Record<string, unknown>;
  if (!r.success) return `Tool ${name} failed: ${JSON.stringify(r)}`;

  switch (name) {
    case 'complete_task':
      return `Task ${input.task_id} marked complete.`;
    case 'add_task':
      return `Task added: "${input.title}" (${input.domain})${r.added_to_focus ? ' — added to focus' : ''}.`;
    case 'update_task':
      return `Task ${input.task_id} updated.`;
    case 'add_contact':
      return `Contact added: "${input.name}".`;
    case 'add_countdown':
      return `Countdown added: "${input.title}" on ${input.event_date}.`;
    case 'update_countdown':
      return `Countdown ${input.countdown_id} updated.`;
    case 'delete_countdown':
      return `Countdown ${input.countdown_id} deleted.`;
    default:
      return null;
  }
}
