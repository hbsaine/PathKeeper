import Anthropic from '@anthropic-ai/sdk';
import type {
  Tool,
  ToolsBetaMessageParam,
  ToolResultBlockParam,
  ToolUseBlock,
  ToolsBetaContentBlock,
} from '@anthropic-ai/sdk/resources/beta/tools/messages';
import { BrowserWindow } from 'electron';
import { getSetting, addTask, updateTask, completeTaskById, addToFocus, addContact, addCountdown } from './db';

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
];

async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  win: BrowserWindow
): Promise<unknown> {
  const today = new Date().toISOString().slice(0, 10);

  switch (name) {
    case 'complete_task': {
      completeTaskById(input.task_id as string);
      win.webContents.send('db:changed');
      return { success: true };
    }
    case 'add_task': {
      const taskId = addTask({
        title: input.title as string,
        domain: input.domain as string,
        due_date: input.due_date as string | undefined,
      });
      const addedToFocus = input.add_to_focus ? addToFocus(taskId, today) : false;
      win.webContents.send('db:changed');
      return { success: true, task_id: taskId, added_to_focus: addedToFocus };
    }
    case 'update_task': {
      const updates: Record<string, unknown> = {};
      if (input.title) updates.title = input.title;
      if (input.domain) updates.domain = input.domain;
      updateTask(input.task_id as string, updates);
      win.webContents.send('db:changed');
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
      win.webContents.send('db:changed');
      return { success: true, contact_id: id };
    }
    case 'add_countdown': {
      const id = addCountdown(input.title as string, input.event_date as string);
      win.webContents.send('db:changed');
      return { success: true, countdown_id: id };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function sendMessage(
  win: BrowserWindow,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
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
        const result = await executeToolCall(toolBlock.name, toolBlock.input as Record<string, unknown>, win);
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
