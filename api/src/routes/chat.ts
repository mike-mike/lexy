import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TEACHING_PROMPT = `Your goal is to teach the user English through natural conversation. You speak as a native American English speaker.

CORRECTIONS & FEEDBACK:
- Fix the user's mistakes and suggest more natural phrases when it genuinely helps — but don't correct every word. Focus on errors that affect meaning or sound noticeably non-native.
- When you correct something, briefly show the better version and move the conversation forward. Don't lecture.

REINFORCEMENT:
- Reuse common phrases and expressions in your replies when they fit the context.
- Naturally recycle phrases the user got wrong earlier (once you've corrected them) so they can hear and practice the correct form again.

Keep replies brief (1-3 sentences). Always respond in English.`;

export const LEVEL_PROMPTS: Record<string, string> = {
  beginner:
    'Use very simple English: basic vocabulary, short sentences (5-10 words), present tense. Avoid idioms and complex grammar. Ideal for A1-A2 learners. Corrections should be minimal and gentle.',
  intermediate:
    'Use everyday American English: common vocabulary, clear sentences. Some idioms and phrasal verbs are OK. Present and past tenses. Ideal for B1-B2 learners.',
  advanced:
    'Use natural American English: full vocabulary, varied sentence structure, idioms, colloquialisms, and nuance. Speak as to a fluent speaker.',
};

router.post('/', async (req, res) => {
  try {
    const { message, history = [], level = 'intermediate' } = req.body;
    console.log(`[chat] message="${message?.slice(0, 80)}${(message?.length ?? 0) > 80 ? '...' : ''}" level=${level} historyLen=${history?.length ?? 0}`);
    if (!message || typeof message !== 'string') {
      console.log('[chat] 400: message is required');
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const systemPrompt =
      TEACHING_PROMPT + '\n\n' + (LEVEL_PROMPTS[level] ?? LEVEL_PROMPTS.intermediate);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant' | 'system',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 250,
    });

    const text = completion.choices[0]?.message?.content ?? '';
    console.log(`[chat] 200 response="${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`);
    res.json({ text });
  } catch (err) {
    console.error('[chat] error:', err);
    res.status(500).json({ error: 'Failed to get response' });
  }
});

export { router as chatRouter };
