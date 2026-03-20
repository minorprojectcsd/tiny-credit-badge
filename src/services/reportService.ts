const BASE = import.meta.env.VITE_REPORT_API_URL || 'https://mindcarex-report-api.onrender.com';

export interface ReportJson {
  session_overview?: string;
  stress_analysis?: string;
  vocal_indicators?: string;
  emotional_state?: string;
  risk_assessment?: string;
  recommendations?: string[];
  follow_up?: string;
}

export interface GeneratedReport {
  session_id: string;
  patient_id?: string;
  generated_at?: string;
  report: ReportJson;
  clinical_notes: string;
  guardian_message: string;
}

export interface ReportHistoryEntry {
  session_id: string;
  risk_assessment_preview: string;
  guardian_message_preview: string;
  created_at: string;
}

async function unwrapReport<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (body.success === false) {
    throw new Error(body.error || body.detail || 'Request failed');
  }
  return (body.data ?? body) as T;
}

export const reportService = {
  async generate(sessionId: string): Promise<GeneratedReport> {
    const res = await fetch(`${BASE}/api/report/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || err?.error || `Report generation failed (${res.status})`);
    }
    return unwrapReport<GeneratedReport>(res);
  },

  async getReport(sessionId: string): Promise<GeneratedReport> {
    const res = await fetch(`${BASE}/api/report/${sessionId}`);
    return unwrapReport<GeneratedReport>(res);
  },

  async getPatientHistory(patientId: string): Promise<ReportHistoryEntry[]> {
    const res = await fetch(`${BASE}/api/report/patient/${patientId}/history`);
    return unwrapReport<ReportHistoryEntry[]>(res);
  },
};
