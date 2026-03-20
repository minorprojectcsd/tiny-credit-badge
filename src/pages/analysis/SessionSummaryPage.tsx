import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { voiceAnalysisService } from '@/services/voiceAnalysisService';
import { reportService } from '@/services/reportService';
import { toast } from '@/hooks/use-toast';
import {
  Activity, AlertTriangle, Brain, ChevronDown, Clock, FileText,
  Heart, Mail, Shield, TrendingUp, CheckCircle,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, ReferenceLine, ReferenceArea,
} from 'recharts';
import { useState } from 'react';

const STRESS_COLORS = { green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444' };

function getStressColor(score: number) {
  if (score < 30) return STRESS_COLORS.green;
  if (score < 50) return STRESS_COLORS.yellow;
  if (score < 72) return STRESS_COLORS.orange;
  return STRESS_COLORS.red;
}

function getRiskBadge(level: string) {
  switch (level?.toLowerCase()) {
    case 'high': return <Badge className="bg-red-500 text-white">High Risk</Badge>;
    case 'medium': return <Badge className="bg-orange-500 text-white">Medium Risk</Badge>;
    default: return <Badge className="bg-green-500 text-white">Low Risk</Badge>;
  }
}

export default function SessionSummaryPage() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const voiceSessionId = searchParams.get('voiceSessionId') || sessionId;
  const [approved, setApproved] = useState(false);

  const { data: summary, isLoading: loadingSummary, error: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ['voice-summary', voiceSessionId],
    queryFn: () => voiceAnalysisService.getSummary(voiceSessionId!),
    enabled: !!voiceSessionId,
  });

  const { data: transcript, isLoading: loadingTranscript } = useQuery({
    queryKey: ['voice-transcript', voiceSessionId],
    queryFn: () => voiceAnalysisService.getTranscript(voiceSessionId!),
    enabled: !!voiceSessionId,
  });

  const { data: timeline } = useQuery({
    queryKey: ['voice-timeline', voiceSessionId],
    queryFn: () => voiceAnalysisService.getTimeline(voiceSessionId!),
    enabled: !!voiceSessionId,
  });

  const { data: report, isLoading: loadingReport, error: reportError, refetch: refetchReport } = useQuery({
    queryKey: ['report', voiceSessionId],
    queryFn: () => reportService.getReport(voiceSessionId!),
    enabled: !!voiceSessionId,
  });

  const isLoading = loadingSummary || loadingReport;
  const hasError = summaryError || reportError;

  // Chart data
  const timelineData = Array.isArray(timeline) ? timeline.map((pt) => ({
    chunk: pt.chunk_index,
    stress: Math.round(pt.stress_score),
    color: getStressColor(pt.stress_score),
  })) : [];

  const stateData = summary?.state_distribution
    ? Object.entries(summary.state_distribution).map(([name, value]) => ({
        name: name.replace(/_/g, ' '),
        value: value,
      }))
    : [];

  const emotionData = Array.isArray(summary?.top_emotions)
    ? summary.top_emotions.map((e) => ({
        name: e.label,
        score: Math.round(e.avg_score * 100),
      }))
    : [];

  const pitchData = (summary?.pitch_summary?.contour || []).map((v: number, i: number) => ({
    idx: i,
    pitch: Math.round(v),
  }));

  const PIE_COLORS = [STRESS_COLORS.green, STRESS_COLORS.yellow, STRESS_COLORS.orange, STRESS_COLORS.red];

  const rj = report?.report || {};

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Session Summary</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Session: {sessionId?.slice(0, 12)}…</p>
          </div>
          {hasError && (
            <Button variant="outline" size="sm" onClick={() => { refetchSummary(); refetchReport(); }}>
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Retry
            </Button>
          )}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
        )}

        {!isLoading && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Activity className="h-4 w-4" />
                    <span className="text-xs">Avg Stress</span>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: getStressColor(summary?.avg_stress_score || 0) }}>
                    {summary?.avg_stress_score?.toFixed(1) ?? '—'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">Peak Stress</span>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: getStressColor(summary?.peak_stress_score || 0) }}>
                    {summary?.peak_stress_score?.toFixed(1) ?? '—'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Shield className="h-4 w-4" />
                    <span className="text-xs">Risk Level</span>
                  </div>
                  {summary ? getRiskBadge(summary.overall_risk_level) : <span className="text-lg">—</span>}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">Duration</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {summary?.total_duration_sec
                      ? `${Math.floor(summary.total_duration_sec / 60)}m`
                      : `${timelineData.length * 7}s`}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Stress timeline */}
            {timelineData.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Stress Timeline</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <ReferenceArea y1={0} y2={29} fill={STRESS_COLORS.green} fillOpacity={0.06} />
                      <ReferenceArea y1={30} y2={49} fill={STRESS_COLORS.yellow} fillOpacity={0.06} />
                      <ReferenceArea y1={50} y2={71} fill={STRESS_COLORS.orange} fillOpacity={0.06} />
                      <ReferenceArea y1={72} y2={100} fill={STRESS_COLORS.red} fillOpacity={0.06} />
                      <XAxis dataKey="chunk" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="stress" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Pitch + State + Emotions row */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Pitch contour */}
              {pitchData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Pitch Contour</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={120}>
                      <LineChart data={pitchData}>
                        <Line type="monotone" dataKey="pitch" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                        <Tooltip />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* State distribution */}
              {stateData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Brain className="h-3.5 w-3.5" /> Mental States</CardTitle></CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={stateData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3}>
                          {stateData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Top emotions */}
              {emotionData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" /> Top Emotions</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={emotionData} layout="vertical">
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Transcript */}
            {transcript && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Full Transcript</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {transcript.chunks && transcript.chunks.length > 0 ? (
                      transcript.chunks.map((c, i) => (
                        <div key={i} className="flex gap-3 rounded-lg border border-border p-2.5 text-sm">
                          <div className="flex shrink-0 flex-col items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            {timelineData[i] && (
                              <span
                                className="inline-flex h-5 w-10 items-center justify-center rounded-full text-[10px] font-medium text-white"
                                style={{ backgroundColor: getStressColor(timelineData[i].stress) }}
                              >
                                {timelineData[i].stress}
                              </span>
                            )}
                          </div>
                          <p className="text-sm">{c.transcript}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-sm whitespace-pre-wrap">{transcript.full_transcript || 'No transcript.'}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AI Report */}
            {report && (
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> AI Clinical Report
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Guardian message */}
                  {report.guardian_message && (
                    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Guardian Message</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{report.guardian_message}</p>
                    </div>
                  )}

                  {/* Clinical notes */}
                  {report.clinical_notes && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-sm font-medium hover:bg-muted/50">
                        Clinical Notes
                        <ChevronDown className="h-4 w-4 transition-transform" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 rounded-lg bg-muted p-4">
                          <p className="text-sm whitespace-pre-wrap">{report.clinical_notes}</p>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Structured report sections */}
                  {Object.entries(rj).filter(([_, v]) => v).map(([key, value]) => (
                    <Collapsible key={key}>
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border p-3 text-sm font-medium capitalize hover:bg-muted/50">
                        {key.replace(/_/g, ' ')}
                        <ChevronDown className="h-4 w-4" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 rounded-lg bg-muted p-4">
                          {Array.isArray(value) ? (
                            <ul className="list-disc pl-4 space-y-1 text-sm">
                              {(value as string[]).map((item, i) => <li key={i}>{item}</li>)}
                            </ul>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{String(value)}</p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}

                  {/* Approve button */}
                  <div className="pt-2">
                    <Button
                      onClick={() => {
                        setApproved(true);
                        toast({ title: 'Approved', description: 'Report marked for sending to guardian.' });
                      }}
                      disabled={approved}
                      className="w-full sm:w-auto"
                    >
                      {approved ? (
                        <><CheckCircle className="mr-2 h-4 w-4" /> Approved & Sent</>
                      ) : (
                        <><Mail className="mr-2 h-4 w-4" /> Approve & Send to Guardian</>
                      )}
                    </Button>
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
