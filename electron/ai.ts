import Anthropic from '@anthropic-ai/sdk';
import type {
  Tool,
  ToolsBetaMessageParam,
  ToolResultBlockParam,
  ToolUseBlock,
  ToolsBetaContentBlock,
} from '@anthropic-ai/sdk/resources/beta/tools/messages';
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

const TOOLS: Tool[] = [
  {
    name: 'complete_task',
    description: 'Mark a task as done. Use when the user says they completed or finished a task.',
    input_schema: {
      type: 'object',
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
      type: 'object',
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
      type: 'object',
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
      type: 'object',
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
      type: 'object',
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
      type: 'object',
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
      type: 'object',
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

  const anthropic = getClient();

  const sdkMessages: ToolsBetaMessageParam[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  let fullText = '';

  while (true) {
    const response = await anthropic.beta.tools.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: sdkMessages,
      tools: TOOLS,
    });

    for (const block of response.content as ToolsBetaContentBlock[]) {
      if (block.type === 'text') fullText += block.text;
    }

    if (response.stop_reason !== 'tool_use') break;

    const toolResults: ToolResultBlockParam[] = [];
    for (const block of response.content as ToolsBetaContentBlock[]) {
      if (block.type === 'tool_use') {
        const toolBlock = block as ToolUseBlock;
        const result = await executeToolCall(toolBlock.name, toolBlock.input as Record<string, unknown>);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: [{ type: 'text', text: JSON.stringify(result) }],
        });
      }
    }

    sdkMessages.push({
      role: 'assistant',
      content: response.content as ToolsBetaMessageParam['content'],
    });
    sdkMessages.push({ role: 'user', content: toolResults });
  }

  if (fullText) win.webContents.send('ai:stream-chunk', fullText);
  win.webContents.send('ai:stream-done');
  return fullText;
}
