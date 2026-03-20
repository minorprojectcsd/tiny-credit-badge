const BASE = import.meta.env.VITE_VOICE_API_URL || 'https://mindcarex-audio-api.onrender.com';

async function unwrap<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (body.success === false) {
    throw new Error(body.error || body.detail || 'Request failed');
  }
  return (body.data ?? body) as T;
}

export interface VoiceChunkResult {
  chunk_index?: number;
  stress_score: number;
  mental_state: string;
  mental_state_label?: string;
  color: string;
  risk_level?: string;
  top_emotions: { label: string; score: number }[];
  chunk_transcript?: string;
  transcript?: string; // legacy alias
  mode?: string;
  total_chunks?: number;
  acoustic_features?: {
    pitch_mean_hz: number;
    pitch_std_hz: number;
    spectral_entropy: number;
    speaking_rate: number;
    silence_ratio: number;
    mode: string;
  };
}

export interface VoiceSessionSummary {
  avg_stress_score: number;
  peak_stress_score: number;
  min_stress_score?: number;
  trend: string;
  dominant_label?: string;
  overall_risk_level: string;
  total_chunks?: number;
  total_duration_sec?: number;
  state_distribution: Record<string, number>;
  top_emotions: { label: string; avg_score: number }[];
  pitch_summary?: {
    mean_hz?: number;
    std_hz?: number;
    min_hz?: number;
    max_hz?: number;
    contour?: number[];
  };
  entropy_summary?: {
    mean?: number;
    max?: number;
    trend?: string;
  };
  transcript_word_count?: number;
}

export interface VoiceSession {
  session_id: string;
  status: string;
  chunks: VoiceChunkResult[];
  summary: VoiceSessionSummary | null;
}

export interface VoiceTimelinePoint {
  chunk_index: number;
  timestamp_sec?: number;
  stress_score: number;
  mental_state?: string;
  label?: string;
  color?: string;
  risk_level?: string;
  pitch_hz: number;
  entropy: number;
  transcript?: string;
}

export interface VoiceTranscript {
  full_transcript: string;
  chunks?: { index: number; transcript: string; timestamp: string }[];
}

export interface VoiceHistoryEntry {
  session_id: string;
  status: string;
  chunk_count: number;
  summary: VoiceSessionSummary | null;
  created_at: string;
  label?: string;
}

/** Unwrap timeline specifically since it's nested under data.timeline */
async function unwrapTimeline(res: Response): Promise<VoiceTimelinePoint[]> {
  const body = await res.json();
  if (body.success === false) {
    throw new Error(body.error || body.detail || 'Request failed');
  }
  const data = body.data ?? body;
  // API returns { data: { timeline: [...] } }
  const arr = data.timeline ?? data;
  return Array.isArray(arr) ? arr : [];
}

/** Unwrap transcript — full_transcript lives at data level */
async function unwrapTranscript(res: Response): Promise<VoiceTranscript> {
  const body = await res.json();
  if (body.success === false) {
    throw new Error(body.error || body.detail || 'Request failed');
  }
  const data = body.data ?? body;
  return {
    full_transcript: data.full_transcript || '',
    chunks: Array.isArray(data.chunks) ? data.chunks : undefined,
  };
}

export const voiceAnalysisService = {
  async startSession(patientId: string, label?: string): Promise<{ session_id: string }> {
    const res = await fetch(`${BASE}/api/voice/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, label: label || 'Consultation' }),
    });
    return unwrap(res);
  },

  async stopSession(sessionId?: string): Promise<VoiceSessionSummary> {
    const res = await fetch(`${BASE}/api/voice/session/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
    });
    // stop returns { data: { session_id, status, full_transcript, summary: {...} } }
    const body = await res.json();
    if (body.success === false) {
      throw new Error(body.error || body.detail || 'Request failed');
    }
    const data = body.data ?? body;
    return data.summary ?? data;
  },

  async uploadChunk(sessionId: string, audioBlob: Blob): Promise<VoiceChunkResult> {
    const form = new FormData();
    form.append('file', audioBlob, 'chunk.webm');
    const res = await fetch(`${BASE}/api/voice/${sessionId}/chunk`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || err?.error || `Chunk upload failed (${res.status})`);
    }
    return unwrap<VoiceChunkResult>(res);
  },

  getLiveWebSocketUrl(sessionId: string): string {
    const wsBase = BASE.replace('https://', 'wss://').replace('http://', 'ws://');
    return `${wsBase}/api/voice/${sessionId}/live`;
  },

  async getSession(sessionId: string): Promise<VoiceSession> {
    const res = await fetch(`${BASE}/api/voice/${sessionId}`);
    return unwrap<VoiceSession>(res);
  },

  async getTimeline(sessionId: string): Promise<VoiceTimelinePoint[]> {
    const res = await fetch(`${BASE}/api/voice/${sessionId}/timeline`);
    return unwrapTimeline(res);
  },

  async getSummary(sessionId: string): Promise<VoiceSessionSummary> {
    const res = await fetch(`${BASE}/api/voice/${sessionId}/summary`);
    return unwrap<VoiceSessionSummary>(res);
  },

  async getTranscript(sessionId: string): Promise<VoiceTranscript> {
    const res = await fetch(`${BASE}/api/voice/${sessionId}/transcript`);
    return unwrapTranscript(res);
  },

  async getPatientHistory(patientId: string): Promise<VoiceHistoryEntry[]> {
    const res = await fetch(`${BASE}/api/voice/patient/${patientId}/history`);
    return unwrap<VoiceHistoryEntry[]>(res);
  },

  async getStatus(): Promise<{ status: string; groq_stt: boolean; hf_emotion: boolean }> {
    const res = await fetch(`${BASE}/api/voice/status`);
    return unwrap(res);
  },
};
