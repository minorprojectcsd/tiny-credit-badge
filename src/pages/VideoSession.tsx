import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, User, MessageSquare, X } from 'lucide-react';
import { SessionSummaryModal, SessionSummaryData, AIReportPrefill } from '@/components/session/SessionSummaryModal';
import { sessionService, SessionDetails, getParticipantName } from '@/services/sessionService';
import { useIsMobile } from '@/hooks/use-mobile';
import { voiceAnalysisService, type VoiceChunkResult, type VoiceSessionSummary } from '@/services/voiceAnalysisService';
import { cameraService } from '@/services/cameraService';
import { reportService } from '@/services/reportService';
import { StressOverlay } from '@/components/video/StressOverlay';
import { toast } from '@/hooks/use-toast';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://mindcarex-backend.onrender.com';

export default function VideoSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const userId = localStorage.getItem('userId');
  const userRole = localStorage.getItem('role');
  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('mindcarex_auth_user')
    ? JSON.parse(localStorage.getItem('mindcarex_auth_user')!).name
    : 'You';

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const stompClientRef = useRef<Client | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice analysis refs
  const voiceSessionIdRef = useRef<string | null>(null);
  const voiceWsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldUploadVoiceChunksRef = useRef(false);

  // Camera analysis refs
  const cameraSessionIdRef = useRef<string | null>(null);
  const cameraWsRef = useRef<WebSocket | null>(null);
  const cameraIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('new');
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [endingSession, setEndingSession] = useState(false);
  const [chatOpen, setChatOpen] = useState(!isMobile);
  const [unreadCount, setUnreadCount] = useState(0);

  // Stream ready state — triggers analysis start
  const [streamReady, setStreamReady] = useState(false);

  // Module status tracking
  const [voiceActive, setVoiceActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  // Live analysis state
  const [latestChunk, setLatestChunk] = useState<VoiceChunkResult | null>(null);
  const [stressHistory, setStressHistory] = useState<number[]>([]);
  const [faceEmotion, setFaceEmotion] = useState<string | null>(null);

  // AI report prefill for summary modal
  const [reportPrefill, setReportPrefill] = useState<AIReportPrefill | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);

  const remoteName = sessionDetails
    ? userRole === 'DOCTOR'
      ? getParticipantName(sessionDetails.appointment.patient)
      : getParticipantName(sessionDetails.appointment.doctor)
    : 'Participant';

  const localName = sessionDetails
    ? userRole === 'DOCTOR'
      ? getParticipantName(sessionDetails.appointment.doctor)
      : getParticipantName(sessionDetails.appointment.patient)
    : userName;

  const buildFallbackPrefill = useCallback((summary: VoiceSessionSummary): AIReportPrefill => {
    const dominantState = Object.entries(summary.state_distribution || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topEmotion = summary.top_emotions?.[0]?.label;
    const durationMinutes = summary.total_duration_sec ? Math.max(1, Math.round(summary.total_duration_sec / 60)) : null;
    const formattedState = dominantState?.replace(/_/g, ' ');

    const keyPoints = [
      typeof summary.avg_stress_score === 'number' ? `Average stress score: ${summary.avg_stress_score.toFixed(1)}` : null,
      typeof summary.peak_stress_score === 'number' ? `Peak stress score: ${summary.peak_stress_score.toFixed(1)}` : null,
      summary.trend ? `Stress trend: ${summary.trend}` : null,
      summary.overall_risk_level ? `Risk level: ${summary.overall_risk_level}` : null,
      formattedState ? `Dominant mental state: ${formattedState}` : null,
      topEmotion ? `Top detected emotion: ${topEmotion}` : null,
      durationMinutes ? `Session duration: ${durationMinutes} minute${durationMinutes > 1 ? 's' : ''}` : null,
    ].filter(Boolean) as string[];

    return {
      summary: [
        'Session analysis completed.',
        typeof summary.avg_stress_score === 'number' ? `Average stress was ${summary.avg_stress_score.toFixed(1)}` : null,
        typeof summary.peak_stress_score === 'number' ? `with a peak of ${summary.peak_stress_score.toFixed(1)}` : null,
        summary.overall_risk_level ? `Risk level was assessed as ${summary.overall_risk_level}.` : null,
      ].filter(Boolean).join(' '),
      keyPoints,
      recommendations: summary.overall_risk_level?.toLowerCase() === 'high'
        ? 'Review the session carefully, monitor for escalation, and plan a closer follow-up.'
        : summary.overall_risk_level?.toLowerCase() === 'medium'
          ? 'Review the stress pattern and consider a structured follow-up based on the findings.'
          : 'Continue monitoring progress and reinforce the current care plan as appropriate.',
      nextSteps: summary.trend
        ? `Review the ${summary.trend.toLowerCase()} stress trend and confirm the next follow-up action with the patient.`
        : 'Review the findings and confirm the next follow-up action with the patient.',
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0 && !chatOpen) {
      setUnreadCount(prev => prev + 1);
    }
  }, [messages.length, chatOpen]);

  // Fetch session details
  useEffect(() => {
    if (!sessionId) return;
    sessionService.getSession(sessionId)
      .then(setSessionDetails)
      .catch((e) => console.log('Could not fetch session details:', e));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    initConnection();
    return () => cleanup();
  }, [sessionId]);

  useEffect(() => {
    const resume = () => remoteVideoRef.current?.play().catch(() => {});
    document.addEventListener('click', resume, { once: true });
    return () => document.removeEventListener('click', resume);
  }, []);

  // ─── Voice Analysis: start session + WebSocket + audio capture ───
  const startVoiceAnalysis = useCallback(async () => {
    try {
      const patientId = sessionDetails?.appointment?.patient?.id || userId || 'unknown';
      const { session_id } = await voiceAnalysisService.startSession(patientId, `Session ${sessionId}`);
      voiceSessionIdRef.current = session_id;
      shouldUploadVoiceChunksRef.current = true;
      setVoiceActive(true);
      toast({ title: 'Voice analysis started', description: `Session: ${session_id.slice(0, 8)}…` });

      // Connect WebSocket for live updates
      const wsUrl = voiceAnalysisService.getLiveWebSocketUrl(session_id);
      const ws = new WebSocket(wsUrl);
      let pingInterval: ReturnType<typeof setInterval>;

      ws.onopen = () => {
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping');
        }, 30000);
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.event === 'chunk_result' || data.stress_score !== undefined) {
            const chunk = (data.data || data) as VoiceChunkResult;
            setLatestChunk(chunk);
            setStressHistory(prev => [...prev, Math.round(chunk.stress_score)]);
          }
        } catch {
          // ignore pong
        }
      };
      ws.onclose = () => clearInterval(pingInterval);
      voiceWsRef.current = ws;

      // Start audio capture every 7s
      startAudioCapture(session_id);
    } catch (e: any) {
      console.error('Voice analysis start failed:', e);
      setVoiceActive(false);
      toast({ title: 'Voice analysis error', description: e.message, variant: 'destructive' });
    }
  }, [sessionDetails, sessionId, userId]);

  const startAudioCapture = (voiceSid: string) => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const audioStream = new MediaStream(stream.getAudioTracks());
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/wav';

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(audioStream, { mimeType });
    } catch {
      recorder = new MediaRecorder(audioStream);
    }
    mediaRecorderRef.current = recorder;

    let chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      if (!shouldUploadVoiceChunksRef.current || voiceSessionIdRef.current !== voiceSid || chunks.length === 0) {
        chunks = [];
        return;
      }

      const blob = new Blob(chunks, { type: mimeType });
      chunks = [];
      try {
        const result = await voiceAnalysisService.uploadChunk(voiceSid, blob);
        setLatestChunk(result);
        setStressHistory(prev => [...prev, Math.round(result.stress_score)]);
      } catch (e) {
        console.error('Chunk upload error:', e);
      }
    };

    recorder.start();
    audioChunkIntervalRef.current = setInterval(() => {
      if (recorder.state === 'recording') {
        recorder.stop();
        voiceRestartTimeoutRef.current = setTimeout(() => {
          if (voiceSessionIdRef.current === voiceSid && shouldUploadVoiceChunksRef.current) {
            recorder.start();
          }
        }, 100);
      }
    }, 7000);
  };

  // ─── Camera Analysis: capture frame every 7s ───
  const startCameraAnalysis = useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await cameraService.startSession(sessionId);
      const camSid = result.camera_session_id || (result as any).session_id;
      if (!camSid) {
        console.error('Camera session ID not returned:', result);
        return;
      }
      cameraSessionIdRef.current = camSid;
      setCameraActive(true);

      // Camera WS for live face updates
      const wsUrl = cameraService.getLiveWebSocketUrl(camSid);
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.dominant_emotion || data.data?.dominant_emotion) {
            setFaceEmotion((data.data || data).dominant_emotion);
          }
        } catch {
          // ignore
        }
      };
      cameraWsRef.current = ws;

      // Capture frames every 7s
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      cameraIntervalRef.current = setInterval(() => {
        captureAndSendFrame(camSid);
      }, 7000);
    } catch (e: any) {
      console.error('Camera analysis start failed:', e);
      setCameraActive(false);
    }
  }, [sessionId]);

  const captureAndSendFrame = async (camSid: string) => {
    const video = localVideoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        const result = await cameraService.uploadFrame(camSid, blob);
        setFaceEmotion(result.dominant_emotion);
      } catch (e) {
        console.error('Frame upload error:', e);
      }
    }, 'image/jpeg', 0.7);
  };

  // Start analysis once we have stream + session details (doctor only)
  useEffect(() => {
    if (streamReady && sessionDetails && userRole === 'DOCTOR') {
      startVoiceAnalysis();
      startCameraAnalysis();
    }
  }, [streamReady, sessionDetails, startVoiceAnalysis, startCameraAnalysis, userRole]);

  const initConnection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setStreamReady(true);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
            urls: [
              'turn:openrelay.metered.ca:80?transport=tcp',
              'turn:openrelay.metered.ca:443?transport=tcp',
              'turns:openrelay.metered.ca:443?transport=tcp',
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
      });

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.ontrack = (event) => {
        if (!remoteVideoRef.current) return;
        let rs = remoteVideoRef.current.srcObject as MediaStream | null;
        if (!rs) {
          rs = new MediaStream();
          remoteVideoRef.current.srcObject = rs;
        }
        rs.addTrack(event.track);
        setHasRemoteVideo(true);
        setTimeout(() => remoteVideoRef.current?.play().catch(() => {}), 500);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) sendSignal({ type: 'ice', candidate: event.candidate.toJSON(), from: userId });
      };

      pc.oniceconnectionstatechange = () => console.log('[WebRTC] ICE:', pc.iceConnectionState);
      pc.onconnectionstatechange = () => setConnectionState(pc.connectionState);

      peerConnectionRef.current = pc;
      connectWebSocket();
    } catch (error) {
      console.error('[WebRTC] Failed to get media:', error);
      toast({ title: 'Camera/Mic Error', description: 'Cannot access camera/microphone. Please allow permissions.', variant: 'destructive' });
    }
  };

  const connectWebSocket = () => {
    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE}/ws`),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setIsConnected(true);
        client.subscribe(`/topic/chat/${sessionId}`, (msg) => {
          setMessages((prev) => [...prev, JSON.parse(msg.body)]);
        });
        client.subscribe(`/topic/signal/${sessionId}`, (msg) => {
          const signal = JSON.parse(msg.body);
          if (signal.from === userId) return;
          handleSignal(signal);
        });
        if (userRole === 'DOCTOR') setTimeout(createOffer, 1000);
      },
      onDisconnect: () => setIsConnected(false),
    });
    client.activate();
    stompClientRef.current = client;
  };

  const createOffer = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      sendSignal({ type: 'offer', sdp: offer.sdp, from: userId });
    } catch (e) {
      console.error('[WebRTC] Offer error:', e);
    }
  };

  const handleSignal = async (signal: any) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(c);
        pendingCandidatesRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: 'answer', sdp: answer.sdp, from: userId });
      } else if (signal.type === 'answer') {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
          for (const c of pendingCandidatesRef.current) await pc.addIceCandidate(c);
          pendingCandidatesRef.current = [];
        }
      } else if (signal.type === 'ice' && signal.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
        else pendingCandidatesRef.current.push(signal.candidate);
      }
    } catch (error) {
      console.error('[WebRTC] Signal error:', error);
    }
  };

  const sendSignal = (signal: any) => {
    if (!stompClientRef.current?.connected) return;
    stompClientRef.current.publish({
      destination: `/app/signal/${sessionId}`,
      body: JSON.stringify(signal),
    });
  };

  const toggleMute = () => {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setIsMuted(!t.enabled);
    }
  };

  const toggleVideo = () => {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (t) {
      t.enabled = !t.enabled;
      setIsVideoOff(!t.enabled);
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !stompClientRef.current?.connected) return;
    stompClientRef.current.publish({
      destination: `/app/chat/${sessionId}`,
      body: JSON.stringify({ sessionId, senderId: userId, senderRole: userRole, message: messageText.trim() }),
    });
    setMessageText('');
  };

  const cleanup = () => {
    // Stop media
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerConnectionRef.current?.close();
    stompClientRef.current?.deactivate();

    // Stop voice analysis
    shouldUploadVoiceChunksRef.current = false;
    if (audioChunkIntervalRef.current) clearInterval(audioChunkIntervalRef.current);
    if (voiceRestartTimeoutRef.current) clearTimeout(voiceRestartTimeoutRef.current);
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    voiceWsRef.current?.close();

    // Stop camera analysis
    if (cameraIntervalRef.current) clearInterval(cameraIntervalRef.current);
    cameraWsRef.current?.close();
  };

  // End session: stop analysis → generate report → show auto-filled summary
  const handleEndClick = async () => {
    if (userRole === 'DOCTOR') {
      setPrefillLoading(true);
      setShowSummaryModal(true);

      let prefill: AIReportPrefill | null = null;
      const currentVoiceSessionId = voiceSessionIdRef.current;

      if (currentVoiceSessionId) {
        try {
          shouldUploadVoiceChunksRef.current = false;
          if (audioChunkIntervalRef.current) clearInterval(audioChunkIntervalRef.current);
          if (voiceRestartTimeoutRef.current) clearTimeout(voiceRestartTimeoutRef.current);
          if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
          voiceWsRef.current?.close();

          const stopSummary = await voiceAnalysisService.stopSession(currentVoiceSessionId);
          prefill = buildFallbackPrefill(stopSummary);
          setVoiceActive(false);
          toast({ title: 'Voice analysis completed' });

          try {
            const report = await reportService.generate(currentVoiceSessionId);
            toast({ title: 'AI Report generated' });

            const rj = report.report || {};
            prefill = {
              summary: rj.session_overview || report.clinical_notes || prefill.summary || '',
              keyPoints: [
                rj.stress_analysis,
                rj.vocal_indicators,
                rj.emotional_state,
                ...(prefill.keyPoints || []),
              ].filter((value, index, array) => Boolean(value) && array.indexOf(value) === index) as string[],
              recommendations: Array.isArray(rj.recommendations)
                ? rj.recommendations.join('\n• ')
                : rj.recommendations || prefill.recommendations || '',
              nextSteps: rj.follow_up || prefill.nextSteps || '',
              clinicalNotes: report.clinical_notes || '',
              guardianMessage: report.guardian_message || '',
            };
          } catch (e: any) {
            console.error('Report gen error:', e);
            toast({ title: 'AI report failed', description: 'Voice summary was prefilled instead.', variant: 'destructive' });
          }
        } catch (e: any) {
          console.error('Voice stop error:', e);
          toast({ title: 'Could not stop voice session', description: e.message, variant: 'destructive' });
        }
      }

      setReportPrefill(prefill);
      setPrefillLoading(false);
    } else {
      handleEndSession();
    }
  };

  const handleEndSession = async (summaryData?: SessionSummaryData) => {
    setEndingSession(true);
    const finalVoiceSessionId = voiceSessionIdRef.current;

    try {
      if (userRole === 'DOCTOR') {
        try {
          const body = summaryData?.aiSummary ? summaryData : undefined;
          await fetch(`${API_BASE}/api/sessions/${sessionId}/end`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
          });
        } catch (e) {
          console.log('Could not end session:', e);
        }
      }
    } finally {
      cleanup();
      if (finalVoiceSessionId) {
        navigate(`/session/${sessionId}/summary?voiceSessionId=${finalVoiceSessionId}`);
      } else {
        navigate('/dashboard');
      }
    }
  };

  const handleOpenChat = () => {
    setChatOpen(true);
    setUnreadCount(0);
  };

  // ─── Module status indicator ───
  const ModuleStatus = () => (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${voiceActive ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${voiceActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
        Voice
      </span>
      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${cameraActive ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${cameraActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
        Camera
      </span>
      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${isConnected ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
        Chat
      </span>
    </div>
  );

  const ChatPanel = (
    <div className={
      isMobile
        ? 'fixed inset-0 z-50 flex flex-col bg-background'
        : 'flex h-full w-80 flex-col border-l border-border bg-background'
    }>
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-semibold">Session Chat</h2>
        {isMobile && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChatOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No messages yet</p>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${msg.senderId === userId ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {msg.senderId !== userId && (
                <p className="mb-0.5 text-[10px] font-medium opacity-70">{msg.senderName || msg.senderRole}</p>
              )}
              <p className="text-xs sm:text-sm break-words">{msg.message}</p>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-border p-2.5">
        <Input
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          disabled={!isConnected}
          className="flex-1 text-sm h-9"
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSendMessage} disabled={!messageText.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm font-semibold sm:text-base truncate">Video Session</h1>
          <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${isConnected ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="hidden sm:inline">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </span>
          {userRole === 'DOCTOR' && (
            <div className="hidden sm:flex">
              <ModuleStatus />
            </div>
          )}
        </div>
        <Button variant="destructive" size="sm" className="shrink-0 text-xs" onClick={handleEndClick}>
          <PhoneOff className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline">{userRole === 'DOCTOR' ? 'End Session' : 'Leave'}</span>
          <span className="sm:hidden">End</span>
        </Button>
      </header>

      {userRole === 'DOCTOR' && (
        <div className="flex sm:hidden items-center justify-center gap-1 border-b border-border py-1">
          <ModuleStatus />
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex flex-1 items-center justify-center bg-foreground/5">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />

          {/* Remote name overlay */}
          <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-lg bg-background/70 px-2 py-1 backdrop-blur-sm sm:left-3 sm:top-3 sm:px-3 sm:py-1.5">
            <User className="h-3 w-3 text-primary sm:h-3.5 sm:w-3.5" />
            <span className="text-[10px] font-medium text-foreground sm:text-xs">{remoteName}</span>
            {hasRemoteVideo && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse sm:h-2 sm:w-2" />}
          </div>

          {/* Stress Overlay — doctor only, top-right */}
          {userRole === 'DOCTOR' && (
            <div className="absolute right-2 top-2 sm:right-3 sm:top-3 z-10">
              <StressOverlay
                latestChunk={latestChunk}
                stressHistory={stressHistory}
                faceEmotion={faceEmotion}
              />
            </div>
          )}

          {!hasRemoteVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-muted sm:mb-3 sm:h-20 sm:w-20">
                  <User className="h-8 w-8 text-muted-foreground sm:h-10 sm:w-10" />
                </div>
                <p className="text-sm font-medium">{remoteName}</p>
                <p className="text-xs text-muted-foreground mt-1">Waiting to connect…</p>
              </div>
            </div>
          )}

          {/* Local video PIP */}
          <div className="absolute bottom-16 right-2 h-20 w-28 overflow-hidden rounded-xl border-2 border-border shadow-lg sm:bottom-20 sm:right-3 sm:h-28 sm:w-36 md:h-32 md:w-44">
            <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover" />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <VideoOff className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="absolute bottom-0.5 left-0.5 rounded bg-background/70 px-1 py-0.5 text-[9px] font-medium text-foreground backdrop-blur-sm sm:text-[10px]">
              {localName.split(' ')[0]} (You)
            </div>
          </div>

          {/* Controls bar */}
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-foreground/60 px-3 py-1.5 backdrop-blur-md sm:gap-2.5 sm:px-4 sm:py-2">
            <Button variant="ghost" size="icon" className={`h-9 w-9 rounded-full text-background hover:bg-background/20 sm:h-10 sm:w-10 ${isMuted ? 'bg-destructive/80' : ''}`} onClick={toggleMute}>
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className={`h-9 w-9 rounded-full text-background hover:bg-background/20 sm:h-10 sm:w-10 ${isVideoOff ? 'bg-destructive/80' : ''}`} onClick={toggleVideo}>
              {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`relative h-9 w-9 rounded-full text-background hover:bg-background/20 sm:h-10 sm:w-10 ${chatOpen && !isMobile ? 'bg-primary/40' : ''}`}
              onClick={() => chatOpen ? setChatOpen(false) : handleOpenChat()}
            >
              <MessageSquare className="h-4 w-4" />
              {unreadCount > 0 && !chatOpen && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
            <Button variant="destructive" size="icon" className="h-9 w-9 rounded-full sm:h-10 sm:w-10" onClick={handleEndClick}>
              <PhoneOff className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!isMobile && chatOpen && ChatPanel}
      </div>

      {isMobile && chatOpen && ChatPanel}

      <SessionSummaryModal
        open={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        onSubmit={(data) => handleEndSession(data)}
        loading={endingSession}
        prefill={reportPrefill}
        prefillLoading={prefillLoading}
      />
    </div>
  );
}
