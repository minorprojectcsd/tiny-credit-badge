import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, X, Sparkles } from 'lucide-react';

export interface SessionSummaryData {
  aiSummary: string;
  keyPoints: string[];
  recommendations: string;
  nextSteps: string;
}

export interface AIReportPrefill {
  summary?: string;
  keyPoints?: string[];
  recommendations?: string;
  nextSteps?: string;
  clinicalNotes?: string;
  guardianMessage?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: SessionSummaryData) => void;
  loading?: boolean;
  prefill?: AIReportPrefill | null;
  prefillLoading?: boolean;
}

export function SessionSummaryModal({ open, onClose, onSubmit, loading, prefill, prefillLoading }: Props) {
  const [summary, setSummary] = useState('');
  const [keyPoints, setKeyPoints] = useState<string[]>(['']);
  const [recommendations, setRecommendations] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [prefilled, setPrefilled] = useState(false);

  // Auto-fill when prefill data arrives
  useEffect(() => {
    if (prefill && !prefilled) {
      if (prefill.summary) setSummary(prefill.summary);
      if (prefill.keyPoints?.length) setKeyPoints(prefill.keyPoints);
      if (prefill.recommendations) setRecommendations(prefill.recommendations);
      if (prefill.nextSteps) setNextSteps(prefill.nextSteps);
      setPrefilled(true);
    }
  }, [prefill, prefilled]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setPrefilled(false);
      setSummary('');
      setKeyPoints(['']);
      setRecommendations('');
      setNextSteps('');
    }
  }, [open]);

  const addKeyPoint = () => setKeyPoints((p) => [...p, '']);
  const removeKeyPoint = (i: number) => setKeyPoints((p) => p.filter((_, idx) => idx !== i));
  const updateKeyPoint = (i: number, val: string) =>
    setKeyPoints((p) => p.map((v, idx) => (idx === i ? val : v)));

  const handleSubmit = () => {
    onSubmit({
      aiSummary: summary,
      keyPoints: keyPoints.filter((k) => k.trim()),
      recommendations,
      nextSteps,
    });
  };

  const handleSkip = () => {
    onSubmit({ aiSummary: '', keyPoints: [], recommendations: '', nextSteps: '' });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Session Summary
            {prefill && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"><Sparkles className="h-3 w-3" /> AI Pre-filled</span>}
          </DialogTitle>
          <DialogDescription>
            {prefill
              ? 'This summary was auto-generated from the session analysis. Review and edit before sending.'
              : 'Provide a summary before ending the session. This will be emailed to the patient.'}
          </DialogDescription>
        </DialogHeader>

        {prefillLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generating AI summary from session data…</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Summary</Label>
                <Textarea
                  placeholder="Brief overview of the session..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Key Points</Label>
                {keyPoints.map((kp, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder={`Point ${i + 1}`}
                      value={kp}
                      onChange={(e) => updateKeyPoint(i, e.target.value)}
                    />
                    {keyPoints.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeKeyPoint(i)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addKeyPoint}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Point
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Recommendations</Label>
                <Textarea
                  placeholder="Treatment recommendations..."
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Next Steps</Label>
                <Textarea
                  placeholder="Follow-up actions..."
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={handleSkip} disabled={loading}>
                Skip & End
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : 'Submit & End Session'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
