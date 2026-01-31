import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
function getExtension(mimetype) {
    const map = {
        'audio/webm': 'webm',
        'audio/webm;codecs=opus': 'webm',
        'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
    };
    return map[mimetype] ?? 'webm';
}
router.post('/', upload.single('audio'), async (req, res) => {
    let tempPath = null;
    try {
        const file = req.file;
        if (!file?.buffer) {
            console.log('[transcribe] 400: no audio file');
            res.status(400).json({ error: 'audio file is required' });
            return;
        }
        console.log(`[transcribe] file size=${file.size} type=${file.mimetype}`);
        tempPath = path.join(process.cwd(), `temp-${Date.now()}.${getExtension(file.mimetype)}`);
        await fs.promises.writeFile(tempPath, file.buffer);
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: 'whisper-1',
            language: 'en',
        });
        const text = transcription.text?.trim() ?? '';
        console.log(`[transcribe] 200 text="${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`);
        res.json({ text });
    }
    catch (err) {
        console.error('[transcribe] error:', err);
        res.status(500).json({ error: 'Failed to transcribe' });
    }
    finally {
        if (tempPath) {
            try {
                await fs.promises.unlink(tempPath);
            }
            catch {
                // ignore
            }
        }
    }
});
export { router as transcribeRouter };
