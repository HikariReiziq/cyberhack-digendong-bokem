/**
 * Gemini AI Direct Call Utility
 *
 * Provides a lightweight frontend-to-Gemini interface for:
 * - Floor plan image-only analysis
 * - OCR data extraction
 * - Chatbot conversations
 * - AI recommendations
 * - Quality control inspections
 *
 * Uses task-specific model fallback chains for optimal performance per use case.
 */

// --- Types ---

export type AITaskType = 'floor-plan' | 'ocr' | 'chatbot' | 'qc';

export interface ModelConfig {
  taskType: AITaskType;
  models: string[];
}

const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

const DEFAULT_MODEL_CONFIG: ModelConfig[] = [
  { taskType: 'floor-plan', models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'] },
  { taskType: 'ocr',        models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'] },
  { taskType: 'chatbot',    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'] },
  { taskType: 'qc',         models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'] },
];

// --- Interfaces ---

export interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }>;
  }>;
  generationConfig?: {
    responseMimeType?: string;
  };
}

export interface GeminiResponse {
  candidates?: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
  error?: { message: string; code: number };
}

// --- Internal helpers ---

function getConfigForTask(taskType: AITaskType): ModelConfig {
  const config = DEFAULT_MODEL_CONFIG.find((c) => c.taskType === taskType);
  if (!config) {
    // Fallback to chatbot config if task type not found
    return DEFAULT_MODEL_CONFIG.find((c) => c.taskType === 'chatbot')!;
  }
  return config;
}

async function callModel(
  model: string,
  prompt: string,
  imageBase64?: string,
  mimeType: string = 'image/png',
  taskType?: AITaskType
): Promise<string> {
  let apiKey = '';
  if (typeof window !== 'undefined') {
    apiKey = localStorage.getItem('aromasys_gemini_api_key') || '';
  }
  if (!apiKey) {
    apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  }

  if (!apiKey) {
    throw new Error(
      'NEXT_PUBLIC_GEMINI_API_KEY is not configured. Please set it in your environment variables or in Settings.'
    );
  }

  const parts: Array<{
    text?: string;
    inlineData?: { mimeType: string; data: string };
  }> = [{ text: prompt }];

  if (imageBase64) {
    // Strip data URL prefix if present (e.g., "data:image/png;base64,")
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    parts.push({
      inlineData: { mimeType, data: base64Data },
    });
  }

  const requestBody: GeminiRequest = {
    contents: [{ parts }],
  };

  if (taskType && ['floor-plan', 'ocr', 'qc'].includes(taskType)) {
    requestBody.generationConfig = {
      responseMimeType: 'application/json',
    };
  }

  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    const errorMessage =
      errorData?.error?.message ?? `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(`Gemini ${model} failed: ${errorMessage}`);
  }

  const data: GeminiResponse = await res.json();

  if (data.error) {
    throw new Error(`Gemini ${model} error: ${data.error.message}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (text === undefined || text === null) {
    throw new Error(`Gemini ${model} returned no content in response`);
  }

  return text;
}

// --- Public API ---

/**
 * Call AI with a text prompt and optional base64 image.
 * Uses task-specific model fallback chains for optimal reliability.
 *
 * @param prompt - The text prompt to send
 * @param taskType - The AI task type determining which model chain to use
 * @param imageBase64 - Optional base64-encoded image data (without data URL prefix)
 * @param mimeType - MIME type of the image (defaults to 'image/png')
 * @returns The text response from the AI model
 */
export async function callAI(
  prompt: string,
  taskType: AITaskType,
  imageBase64?: string,
  mimeType: string = 'image/png'
): Promise<string> {
  const config = getConfigForTask(taskType);
  let lastError: Error | null = null;

  for (const model of config.models) {
    try {
      return await callModel(model, prompt, imageBase64, mimeType, taskType);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next model in fallback chain
    }
  }

  throw new Error(
    `All Gemini models failed for task "${taskType}". Last error: ${lastError?.message ?? 'Unknown error'}`
  );
}

/**
 * Call Gemini AI with a text prompt and optional base64 image.
 * Backward-compatible wrapper that uses the 'chatbot' task type.
 *
 * @param prompt - The text prompt to send
 * @param imageBase64 - Optional base64-encoded image data (without data URL prefix)
 * @param mimeType - MIME type of the image (defaults to 'image/png')
 * @returns The text response from Gemini
 */
export async function callGemini(
  prompt: string,
  imageBase64?: string,
  mimeType: string = 'image/png'
): Promise<string> {
  return callAI(prompt, 'chatbot', imageBase64, mimeType);
}
