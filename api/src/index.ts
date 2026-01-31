import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.js';
import { ttsRouter } from './routes/tts.js';
import { transcribeRouter } from './routes/transcribe.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: true }));
app.use(express.json());

app.use((req, _res, next) => {
  const body = req.body && Object.keys(req.body).length > 0
    ? (req.path.includes('tts') ? { text: `[${(req.body?.text?.length ?? 0)} chars]` } : req.body)
    : undefined;
  const extra = req.path.includes('transcribe') ? '(multipart)' : '';
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${extra}`, body ?? '');
  next();
});

app.use('/api/chat', chatRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/transcribe', transcribeRouter);

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
