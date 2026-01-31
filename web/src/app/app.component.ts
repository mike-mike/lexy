import { Component, inject, signal, effect, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatService, ChatMessage, Level } from './chat.service';

export type Phase = 'idle' | 'recording' | 'transcribing' | 'waiting' | 'playing';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private chat = inject(ChatService);

  @ViewChild('chatEnd') chatEnd?: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      this.messages().length;
      this.loading();
      setTimeout(() => this.scrollToBottom(), 0);
    });
  }

  private scrollToBottom() {
    this.chatEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }

  recording = false;
  loading = signal(false);
  level: Level = 'intermediate';
  messages = signal<ChatMessage[]>([]);
  currentSpeaking = '';
  error = '';
  status = '';

  phase = signal<Phase>('idle');
  voiceLevel = signal(0);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audio = new Audio();
  private stream: MediaStream | null = null;
  private recognition: SpeechRecognition | null = null;
  private currentMimeType = 'audio/webm';
  private cancelledRecording = false;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private volumeAnimationId = 0;

  readonly levels: { id: Level; label: string }[] = [
    { id: 'beginner', label: 'Beginner' },
    { id: 'intermediate', label: 'Intermediate' },
    { id: 'advanced', label: 'Advanced' },
  ];

  private setStatus(msg: string) {
    this.status = msg;
    console.log('[Lexy]', msg);
  }

  private startVoiceMeter(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      const dest = ctx.createMediaStreamDestination();
      source.connect(analyser);
      analyser.connect(dest);
      this.audioContext = ctx;
      this.analyser = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!this.analyser || !this.recording) return;
        this.analyser.getByteFrequencyData(data);
        const sum = data.reduce((a, b) => a + b, 0);
        const avg = Math.min(100, Math.round((sum / data.length) * 2));
        this.voiceLevel.set(avg);
        this.volumeAnimationId = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // ignore
    }
  }

  private stopVoiceMeter() {
    if (this.volumeAnimationId) {
      cancelAnimationFrame(this.volumeAnimationId);
      this.volumeAnimationId = 0;
    }
    this.voiceLevel.set(0);
    this.analyser = null;
    this.audioContext?.close();
    this.audioContext = null;
  }

  readonly keyword = 'OK GPT';

  phaseLabel(): string {
    const labels: Record<Phase, string> = {
      idle: 'Ready',
      recording: 'Recording',
      transcribing: 'Transcribing',
      waiting: 'Waiting for response',
      playing: 'Playing',
    };
    return labels[this.phase()];
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    if (e.code !== 'Space' || e.repeat) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    if (this.loading() && !this.recording) return;
    e.preventDefault();
    this.toggleMic();
  }

  async toggleMic() {
    this.error = '';
    if (this.recording) {
      this.stopRecording();
      return;
    }
    await this.startRecording();
  }

  private initKeywordRecognition(): boolean {
    const win = window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition };
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) return false;
    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.onresult = (e: SpeechRecognitionEvent) => {
      const last = e.results.length - 1;
      const transcript = (e.results[last][0]?.transcript ?? '').trim().toLowerCase();
      if (!transcript) return;
      const hasKeyword = /ok\s*gpt|okay\s*gpt/.test(transcript);
      if (hasKeyword && e.results[last].isFinal) {
        this.setStatus(`Keyword detected: "${this.keyword}"`);
        this.stopRecording();
      }
    };
    this.recognition.onerror = () => {};
    this.recognition.onend = () => {
      if (this.recording) this.recognition?.start();
    };
    return true;
  }

  private async startRecording() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.phase.set('recording');
      this.audioChunks = [];
      this.currentMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: this.currentMimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        this.recording = false;
        this.stopVoiceMeter();
        this.recognition?.stop();
        this.stream?.getTracks().forEach((t) => t.stop());
        if (this.cancelledRecording) {
          this.cancelledRecording = false;
          this.phase.set('idle');
          this.setStatus('Cancelled. Tap mic to try again.');
          return;
        }
        const blob = new Blob(this.audioChunks, { type: this.currentMimeType });
        if (blob.size > 1000) {
          this.transcribeAndSend(blob);
        } else {
          this.phase.set('idle');
          this.setStatus('Recording too short, try again');
        }
      };

      this.startVoiceMeter(this.stream);

      const useKeyword = this.initKeywordRecognition();
      if (useKeyword) this.recognition?.start();

      this.mediaRecorder.start();
      this.recording = true;
      this.setStatus(useKeyword ? `Say "${this.keyword}" to send` : 'Recording... tap again to send');
    } catch (e) {
      this.phase.set('idle');
      this.setStatus(`Mic error: ${e}`);
      this.error = 'Microphone access denied';
    }
  }

  private stopRecording(cancel = false) {
    if (cancel) this.cancelledRecording = true;
    this.mediaRecorder?.stop();
  }

  cancelRecording() {
    if (!this.recording) return;
    this.stopRecording(true);
  }

  private transcribeAndSend(blob: Blob) {
    this.loading.set(true);
    this.phase.set('transcribing');
    this.setStatus('Transcribing...');

    this.chat.transcribe(blob).subscribe({
      next: (res) => {
        let text = res.text?.trim() ?? '';
        text = text.replace(/\b(ok(ay)?\s*gpt)\b/gi, '').trim();
        if (text) {
          this.sendMessage(text);
        } else {
          this.phase.set('idle');
          this.setStatus('No speech detected');
          this.error = 'Could not hear you. Try again.';
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.phase.set('idle');
        this.setStatus(`Transcribe error: ${err?.message ?? err}`);
        this.error = 'Transcription failed';
        this.loading.set(false);
      },
    });
  }

  sendText(input: HTMLInputElement) {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    this.sendMessage(text);
  }

  repeatLastPhrase() {
    const lastAssistant = [...this.messages()].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant?.content) return;
    this.currentSpeaking = lastAssistant.content;
    this.phase.set('playing');
    this.chat.getSpeech(lastAssistant.content).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.audio.src = url;
        this.audio.onended = () => {
          this.currentSpeaking = '';
          this.phase.set('idle');
          URL.revokeObjectURL(url);
        };
        this.audio.play();
      },
    });
  }

  get lastAssistantMessage(): string | null {
    const last = [...this.messages()].reverse().find((m) => m.role === 'assistant');
    return last?.content ?? null;
  }

  private sendMessage(text: string) {
    this.setStatus(`Sending: "${text}"`);
    this.messages.update((ms) => [...ms, { role: 'user', content: text }]);
    this.loading.set(true);
    this.phase.set('waiting');

    this.chat.chat(text, this.messages().slice(0, -1), this.level).subscribe({
      next: (res) => {
        const reply = res.text;
        this.messages.update((ms) => [...ms, { role: 'assistant', content: reply }]);
        this.currentSpeaking = reply;
        this.loading.set(false);
        this.phase.set('playing');

        this.chat.getSpeech(reply).subscribe({
          next: (blob) => {
            const url = URL.createObjectURL(blob);
            this.audio.src = url;
            this.audio.onended = () => {
              this.currentSpeaking = '';
              this.phase.set('idle');
              URL.revokeObjectURL(url);
            };
            this.audio.play();
          },
        });
      },
      error: (err) => {
        this.phase.set('idle');
        this.setStatus(`Chat error: ${err?.message ?? err}`);
        this.error = 'Failed to get response';
        this.loading.set(false);
      },
    });
  }
}
