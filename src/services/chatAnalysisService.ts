import type { ChatAnalysisResult } from '@/types/chatAnalysis';

const BASE = import.meta.env.VITE_API_CHAT_URL || 'https://mindcarex-chat-api.onrender.com';

async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (body.success === false) {
    throw new Error(body.error || body.detail || 'Request failed');
  }
  return (body.data ?? body) as T;
}

export const chatAnalysisService = {
  /** Upload a WhatsApp .txt export and get full analysis */
  async analyze(file: File, user = 'Overall'): Promise<ChatAnalysisResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('user', user);

    const res = await fetch(`${BASE}/api/analysis/chat/analyze`, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || err?.error || `Upload failed (${res.status})`);
    }

    return unwrap<ChatAnalysisResult>(res);
  },

  /** Send a single message for instant sentiment scoring (no file needed) */
  async realtime(message: string): Promise<{ sentiment: number; label: string }> {
    const res = await fetch(`${BASE}/api/analysis/chat/realtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return unwrap(res);
  },

  /** Fetch cached full analysis by session_id */
  async getSession(sessionId: string): Promise<ChatAnalysisResult> {
    const res = await fetch(`${BASE}/api/analysis/chat/${sessionId}`);
    return unwrap<ChatAnalysisResult>(res);
  },

  /** Fetch basic message/word/media counts */
  async getStats(sessionId: string) {
    const res = await fetch(`${BASE}/api/analysis/chat/${sessionId}/stats`);
    return unwrap(res);
  },

  /** Fetch risk data only */
  async getRisk(sessionId: string) {
    const res = await fetch(`${BASE}/api/analysis/chat/${sessionId}/risk`);
    return unwrap(res);
  },

  /** Fetch mental-health data only */
  async getMentalHealth(sessionId: string) {
    const res = await fetch(`${BASE}/api/analysis/chat/${sessionId}/mental-health`);
    return unwrap(res);
  },

  /** Fetch sentiment timeline */
  async getSentimentTimeline(sessionId: string) {
    const res = await fetch(`${BASE}/api/analysis/chat/${sessionId}/sentiment-timeline`);
    return unwrap(res);
  },

  /** List all participants in the chat */
  async getParticipants(sessionId: string): Promise<string[]> {
    const res = await fetch(`${BASE}/api/analysis/chat/${sessionId}/participants`);
    return unwrap<string[]>(res);
  },

  /** Top words for word cloud */
  async getWords(sessionId: string) {
    const res = await fetch(`${BASE}/api/analysis/chat/${sessionId}/words`);
    return unwrap(res);
  },

  /** Emoji usage breakdown */
  async getEmojis(sessionId: string) {
    const res = await fetch(`${BASE}/api/analysis/chat/${sessionId}/emojis`);
    return unwrap(res);
  },

  /** Average response time per person */
  async getResponseTime(sessionId: string) {
    const res = await fetch(`${BASE}/api/analysis/chat/${sessionId}/response-time`);
    return unwrap(res);
  },

  /** Most active senders by message count */
  async getMostActive(sessionId: string) {
    const res = await fetch(`${BASE}/api/analysis/chat/${sessionId}/most-active`);
    return unwrap(res);
  },
};
