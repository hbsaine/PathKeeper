import { GoogleGenAI } from '@google/genai';
import { BrowserWindow } from 'electron';
import { getSetting, updateTask } from './db';

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = getSetting('gemini_api_key');
    if (!apiKey) throw new Error('NO_GEMINI_API_KEY');
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export function setGeminiApiKey(key: string) {
  aiClient = new GoogleGenAI({ apiKey: key });
}

interface GrillSession {
  taskId: string;
  step: number; // 1 = first question asked, waiting for first answer; 2 = second question asked, waiting for second answer
  taskTitle: string;
  taskDescription: string;
  taskDomain: string;
  history: { role: string; parts: { text: string }[] }[];
}

// In-memory active grills mapping taskId -> GrillSession
const activeGrills = new Map<string, GrillSession>();

/**
 * Initializes the interactive Mini-Grill state machine and asks the first clarifying question.
 */
export async function startPreworkGrill(taskId: string): Promise<string> {
  const client = getGeminiClient();

  // Retrieve task details from SQLite db
  const db = require('./db');
  const tasks = db.getTasks() as Array<{ id: string; title: string; description?: string; domain: string }>;
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  const taskTitle = task.title;
  const taskDesc = task.description || '';
  const taskDomain = task.domain;

  const systemInstruction = `You are a highly efficient, context-aware AI Chief of Staff. Your goal is to prepare a premium, highly tailored 'pre-work' package (e.g., an email draft, a lesson outline, a meeting agenda, or a checklist) for the following task:
Title: "${taskTitle}"
Description: "${taskDesc}"
Domain: "${taskDomain}"

To write the absolute best draft, you need to ask the user exactly 2 clarifying questions, ONE AT A TIME. 
Generate the FIRST clarifying question now. 
Make it extremely specific, action-oriented, and direct. Do not ask multiple questions. Ask only one single question. 
Do not include any greeting or conversational filler—just ask the question directly.`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Please generate the first clarifying question.',
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const question = response.text || 'Could you provide more context or goals for this task?';

    // Store in active grills session map
    activeGrills.set(taskId, {
      taskId,
      step: 1,
      taskTitle,
      taskDescription: taskDesc,
      taskDomain,
      history: [
        { role: 'user', parts: [{ text: `Generate the first clarifying question for task "${taskTitle}" (domain: ${taskDomain}).` }] },
        { role: 'model', parts: [{ text: question }] }
      ]
    });

    return question;
  } catch (error: any) {
    console.error('[Gemini error in startPreworkGrill]:', error);
    throw error;
  }
}

/**
 * Submits the user's answer and either returns the second question or generates the final pre-work.
 */
export async function submitGrillAnswer(
  taskId: string,
  answer: string,
  win: BrowserWindow
): Promise<{ completed: boolean; nextQuestion?: string }> {
  const client = getGeminiClient();
  const session = activeGrills.get(taskId);

  if (!session) {
    throw new Error('No active grill session found for this task');
  }

  // Append user's answer to the conversation history
  session.history.push({
    role: 'user',
    parts: [{ text: answer }]
  });

  try {
    if (session.step === 1) {
      // Step 1 -> Step 2: Request the second clarifying question
      const systemInstruction = `You are a highly efficient AI Chief of Staff. You are dynamically grilling the user to prepare pre-work for task "${session.taskTitle}".
You have already asked one question and received their answer.
Please ask the SECOND and final clarifying question now. 
Make it highly relevant to their previous answer, specific, and direct. Do not ask multiple questions. 
Do not include any conversational filler—just output the question.`;

      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: session.history,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const nextQuestion = response.text || 'Is there any other specific detail or tone you would like to incorporate?';

      // Store model's question in session history and advance step
      session.history.push({
        role: 'model',
        parts: [{ text: nextQuestion }]
      });
      session.step = 2;

      return { completed: false, nextQuestion };
    } else {
      // Step 2 -> Completed: Generate final prework content
      const compilePrompt = `You have completed the clarifying questions. Now, compile the absolute best "pre-work" document for the task: "${session.taskTitle}".
Use the task details and the user's answers to write highly customized, premium pre-work content.

Depending on the domain, format this as follows:
- For "network" or "rsm" (or email-related tasks): Provide a polished, drop-in-ready, professional email draft with a clear, engaging Subject line and Email Body. Include placeholders in brackets [like this] only if absolutely necessary, but try to make it as ready-to-send as possible based on the user's answers.
- For "skills" or "school": Provide a highly structured lesson summary, study checklist, key concepts overview, or reference list.
- For other domains: Provide a prioritized action checklist and preparation outline.

Style Requirements:
- Format the output in gorgeous, clean, professional Markdown.
- Keep it highly professional, industrial, and high-impact.
- Do not include conversational intro or outro phrases like "Here is your pre-work" or "Let me know if you need anything else". Start directly with the markdown content.`;

      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [...session.history, { role: 'user', parts: [{ text: compilePrompt }] }],
        config: {
          systemInstruction: `You are an expert executive assistant. Create premium pre-work in Markdown based on the user's answers.`,
          temperature: 0.3,
        },
      });

      const finalPrework = response.text || '# Pre-work Draft\nUnable to generate draft at this time.';

      // Save to SQLite DB
      updateTask(taskId, {
        ai_prepped: 1,
        ai_prep_content: finalPrework
      });

      // Clear session from memory
      activeGrills.delete(taskId);

      // Broadcast changes to React frontend
      win.webContents.send('db:changed');

      return { completed: true };
    }
  } catch (error: any) {
    console.error('[Gemini error in submitGrillAnswer]:', error);
    throw error;
  }
}

/**
 * Cancels the active grill session and frees memory.
 */
export async function cancelGrill(taskId: string): Promise<void> {
  activeGrills.delete(taskId);
}
