export type UserRole = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  created_at: string;
  email?: string;
  avatar?: string;
}

export interface Patient extends User {
  role: 'PATIENT';
  dateOfBirth?: string;
  primaryDoctorId?: string;
}

export interface Doctor extends User {
  role: 'DOCTOR';
  specialization: string;
  licenseNumber: string;
  availability: Availability[];
}

export interface Availability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface Schedule {
  id: string;
  doctor_id: string;
  patient_id: string;
  scheduled_time: string;
  status: SessionStatus;
  patientName?: string;
  duration?: number;
  notes?: string;
}

export interface Session {
  id: string;
  doctor_id: string;
  patient_id: string;
  start_time: string | null;
  end_time: string | null;
  status?: SessionStatus;
  notes?: string;
  summary?: string;
  duration?: number;
}

export type SessionStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export interface Message {
  id: string;
  session_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  senderRole?: UserRole;
  isRead?: boolean;
}

export type EmotionType = 'happy' | 'sad' | 'neutral' | 'angry' | 'stressed' | 'fearful' | 'surprised' | 'disgusted';

export interface EmotionMetric {
  id: string;
  session_id: string;
  user_id: string;
  emotion: EmotionType;
  confidence: number;
  captured_at: string;
}

export interface ConsentSettings {
  cameraEnabled: boolean;
  micEnabled: boolean;
  chatAnalysisEnabled: boolean;
  emotionTrackingEnabled: boolean;
}

export interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  from: string;
  to: string;
}
