import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private http: HttpClient) {}

  chat(message: string, history: ChatMessage[], level: Level): Observable<{ text: string }> {
    return this.http.post<{ text: string }>('/api/chat', {
      message,
      history,
      level,
    });
  }

  getSpeech(text: string): Observable<Blob> {
    return this.http.post('/api/tts', { text }, { responseType: 'blob' });
  }

  transcribe(audioBlob: Blob): Observable<{ text: string }> {
    const form = new FormData();
    form.append('audio', audioBlob, 'recording.webm');
    return this.http.post<{ text: string }>('/api/transcribe', form);
  }
}
