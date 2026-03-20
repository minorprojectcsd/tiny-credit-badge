import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { voiceAnalysisService, type VoiceHistoryEntry } from '@/services/voiceAnalysisService';
import { reportService, type ReportHistoryEntry } from '@/services/reportService';
import { AlertTriangle, Calendar, FileText, Activity, Eye } from 'lucide-react';

function getStressColor(score: number) {
  if (score < 30) return 'bg-green-500';
  if (score < 50) return 'bg-yellow-500';
  if (score < 72) return 'bg-orange-500';
  return 'bg-red-500';
}

function getRiskVariant(level: string) {
  switch (level?.toLowerCase()) {
    case 'high': return 'destructive' as const;
    case 'medium': return 'secondary' as const;
    default: return 'default' as const;
  }
}

export default function PatientHistory() {
  const { patientId } = useParams();

  const { data: sessions, isLoading, error, refetch } = useQuery({
    queryKey: ['patient-voice-history', patientId],
    queryFn: () => voiceAnalysisService.getPatientHistory(patientId!),
    enabled: !!patientId,
  });

  const { data: reports } = useQuery({
    queryKey: ['patient-report-history', patientId],
    queryFn: () => reportService.getPatientHistory(patientId!),
    enabled: !!patientId,
  });

  const reportMap = new Map<string, ReportHistoryEntry>();
  reports?.forEach((r) => reportMap.set(r.session_id, r));

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Patient History</h1>
            <p className="text-sm text-muted-foreground">All consultation sessions for patient {patientId?.slice(0, 8)}…</p>
          </div>
          {error && (
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Retry
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        )}

        {!isLoading && (!sessions || sessions.length === 0) && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">No sessions found</p>
              <p className="text-sm mt-1">Voice analysis sessions will appear here.</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {sessions?.map((session) => {
            const hasReport = reportMap.has(session.session_id);
            const avgStress = session.summary?.avg_stress_score;
            const riskLevel = session.summary?.overall_risk_level;

            return (
              <Card key={session.session_id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {new Date(session.created_at).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        {session.label && (
                          <span className="text-xs text-muted-foreground">— {session.label}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={session.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                          {session.status}
                        </Badge>
                        {avgStress !== undefined && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${getStressColor(avgStress)}`}>
                            Stress: {avgStress.toFixed(0)}
                          </span>
                        )}
                        {riskLevel && <Badge variant={getRiskVariant(riskLevel)} className="text-[10px]">{riskLevel} risk</Badge>}
                        <span className="text-[10px] text-muted-foreground">{session.chunk_count} chunks</span>
                        {hasReport && (
                          <Badge className="bg-primary/10 text-primary text-[10px] border-0">
                            <FileText className="mr-0.5 h-2.5 w-2.5" /> Report ready
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Link to={`/session/${session.session_id}/summary`}>
                      <Button variant="outline" size="sm">
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> View Summary
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
