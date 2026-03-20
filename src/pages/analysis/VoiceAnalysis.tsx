import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mic, Activity, Brain, FileText, Clock, AlertTriangle } from 'lucide-react';
import { voiceAnalysisService, type VoiceSession, type VoiceTimelinePoint } from '@/services/voiceAnalysisService';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceArea, BarChart, Bar,
} from 'recharts';

const STRESS_COLORS = { green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444' };

function getStressColor(score: number) {
  if (score < 30) return STRESS_COLORS.green;
  if (score < 50) return STRESS_COLORS.yellow;
  if (score < 72) return STRESS_COLORS.orange;
  return STRESS_COLORS.red;
}

export default function VoiceAnalysis() {
  const { sessionId: urlSessionId } = useParams();
  const [inputId, setInputId] = useState(urlSessionId || '');
  const [searchId, setSearchId] = useState(urlSessionId || '');

  const { data: session, isLoading, error, refetch } = useQuery({
    queryKey: ['voice-session-detail', searchId],
    queryFn: () => voiceAnalysisService.getSession(searchId),
    enabled: !!searchId,
  });

  const { data: timeline } = useQuery({
    queryKey: ['voice-timeline-detail', searchId],
    queryFn: () => voiceAnalysisService.getTimeline(searchId),
    enabled: !!searchId,
  });

  const { data: transcript } = useQuery({
    queryKey: ['voice-transcript-detail', searchId],
    queryFn: () => voiceAnalysisService.getTranscript(searchId),
    enabled: !!searchId,
  });

  const handleSearch = () => { if (inputId.trim()) setSearchId(inputId.trim()); };

  // Chart data
  const timelineData = (timeline || []).map((pt) => ({
    chunk: pt.chunk_index,
    stress: Math.round(pt.stress_score),
    entropy: Number(pt.entropy?.toFixed(3) || 0),
    pitch: Math.round(pt.pitch_hz || 0),
  }));

  // Acoustic features table from chunks
  const chunkFeatures = (session?.chunks || []).map((c, i) => ({
    index: i,
    ...c,
    ...c.acoustic_features,
  }));

  // Emotion per chunk for chart
  const emotionChartData = (session?.chunks || []).map((c, i) => {
    const row: any = { chunk: i };
    (c.top_emotions || []).forEach(e => { row[e.label] = Math.round(e.score * 100); });
    return row;
  });
  const allEmotions = Array.from(
    new Set((session?.chunks || []).flatMap(c => (c.top_emotions || []).map(e => e.label)))
  );
  const EMOTION_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Voice Analysis</h1>
          <p className="mt-1 text-sm text-muted-foreground">Detailed drill-down into voice stress and acoustic data.</p>
        </div>

        {/* Search */}
        {!urlSessionId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Mic className="h-5 w-5 text-primary" /> Load Session</CardTitle>
              <CardDescription>Enter a voice session ID</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input placeholder="Session ID…" value={inputId} onChange={e => setInputId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="flex-1" />
                <Button onClick={handleSearch} disabled={!inputId.trim()}>Load</Button>
              </div>
              {error && (
                <div className="mt-3 flex items-center gap-2">
                  <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Failed to load.</p>
                  <Button variant="ghost" size="sm" onClick={() => refetch()}>Retry</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isLoading && <div className="space-y-3"><Skeleton className="h-64" /><Skeleton className="h-48" /></div>}

        {session && (
          <>
            {/* Stress + Entropy dual-axis chart */}
            {timelineData.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Stress & Spectral Entropy</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <ReferenceArea y1={0} y2={29} fill={STRESS_COLORS.green} fillOpacity={0.05} />
                      <ReferenceArea y1={30} y2={49} fill={STRESS_COLORS.yellow} fillOpacity={0.05} />
                      <ReferenceArea y1={50} y2={71} fill={STRESS_COLORS.orange} fillOpacity={0.05} />
                      <ReferenceArea y1={72} y2={100} fill={STRESS_COLORS.red} fillOpacity={0.05} />
                      <XAxis dataKey="chunk" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="stress" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="entropy" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line yAxisId="stress" type="monotone" dataKey="stress" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Stress" />
                      <Line yAxisId="entropy" type="monotone" dataKey="entropy" stroke="hsl(var(--accent))" strokeWidth={1.5} dot={false} name="Entropy" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Acoustic features table */}
            {chunkFeatures.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Acoustic Features</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="p-2">Chunk</th>
                        <th className="p-2">Pitch Mean</th>
                        <th className="p-2">Pitch Std</th>
                        <th className="p-2">Entropy</th>
                        <th className="p-2">Speaking Rate</th>
                        <th className="p-2">Silence Ratio</th>
                        <th className="p-2">Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chunkFeatures.map((f, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="p-2 font-medium">{i}</td>
                          <td className="p-2">{f.pitch_mean_hz?.toFixed(1) ?? '—'}</td>
                          <td className="p-2">{f.pitch_std_hz?.toFixed(1) ?? '—'}</td>
                          <td className="p-2">{f.spectral_entropy?.toFixed(3) ?? '—'}</td>
                          <td className="p-2">{f.speaking_rate?.toFixed(2) ?? '—'}</td>
                          <td className="p-2">{f.silence_ratio?.toFixed(2) ?? '—'}</td>
                          <td className="p-2"><Badge variant="outline" className="text-[10px]">{f.mode || 'full'}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {/* Emotion timeline */}
            {emotionChartData.length > 0 && allEmotions.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" /> Emotion Timeline</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={emotionChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="chunk" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      {allEmotions.map((emo, i) => (
                        <Bar key={emo} dataKey={emo} stackId="emotions" fill={EMOTION_COLORS[i % EMOTION_COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Transcript viewer */}
            {transcript && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Transcript</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {(transcript.chunks || []).map((c, i) => {
                      const stress = timelineData[i]?.stress;
                      return (
                        <div key={i} className="flex gap-3 rounded-lg border border-border p-2.5">
                          <div className="flex shrink-0 flex-col items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            {stress !== undefined && (
                              <span className="inline-flex h-5 w-10 items-center justify-center rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: getStressColor(stress) }}>
                                {stress}
                              </span>
                            )}
                          </div>
                          <p className="text-sm">{c.transcript}</p>
                        </div>
                      );
                    })}
                    {(!transcript.chunks || transcript.chunks.length === 0) && (
                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-sm">{transcript.full_transcript || 'No transcript.'}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
