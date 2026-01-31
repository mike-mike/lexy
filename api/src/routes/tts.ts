import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', async (req, res) => {
  try {
    const { text } = req.body;
    console.log(`[tts] input len=${text?.length ?? 0} "${(text ?? '')?.slice(0, 60)}${(text?.length ?? 0) > 60 ? '...' : ''}"`);
    if (!text || typeof text !== 'string') {
      console.log('[tts] 400: text is required');
      res.status(400).json({ error: 'text is required' });
      return;
    }

    const truncated = text.slice(0, 4096);

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: truncated,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
    });
    console.log(`[tts] 200 audio size=${buffer.length} bytes`);
    res.send(buffer);
  } catch (err) {
    console.error('[tts] error:', err);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

export { router as ttsRouter };
