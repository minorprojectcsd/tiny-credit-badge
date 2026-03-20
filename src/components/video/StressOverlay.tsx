import { useMemo } from 'react';
import type { VoiceChunkResult } from '@/services/voiceAnalysisService';

interface Props {
  latestChunk: VoiceChunkResult | null;
  stressHistory: number[];
  faceEmotion?: string | null;
}

function getStressColor(score: number): string {
  if (score < 30) return '#22c55e';
  if (score < 50) return '#eab308';
  if (score < 72) return '#f97316';
  return '#ef4444';
}

function getStressLabel(score: number): string {
  if (score < 30) return 'Calm';
  if (score < 50) return 'Mild Stress';
  if (score < 72) return 'Moderate Stress';
  return 'High Stress';
}

function getStressBgClass(score: number): string {
  if (score < 30) return 'bg-green-500/15 border-green-500/30';
  if (score < 50) return 'bg-yellow-500/15 border-yellow-500/30';
  if (score < 72) return 'bg-orange-500/15 border-orange-500/30';
  return 'bg-red-500/15 border-red-500/30';
}

function Sparkline({ data }: { data: number[] }) {
  const points = data.slice(-8);
  if (points.length < 2) return null;
  const w = 120, h = 32;
  const max = 100;
  const pathData = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className="mt-1">
      <path d={pathData} fill="none" stroke={getStressColor(points[points.length - 1])} strokeWidth="2" />
      {points.map((v, i) => (
        <circle
          key={i}
          cx={(i / (points.length - 1)) * w}
          cy={h - (v / max) * h}
          r="2"
          fill={getStressColor(v)}
        />
      ))}
    </svg>
  );
}

export function StressOverlay({ latestChunk, stressHistory, faceEmotion }: Props) {
  const score = latestChunk?.stress_score ?? 0;
  const scorePercent = Math.round(score);
  const label = getStressLabel(score);
  const bgClass = getStressBgClass(score);
  const topEmotions = useMemo(() => (latestChunk?.top_emotions ?? []).slice(0, 2), [latestChunk]);

  return (
    <div className={`rounded-xl border p-3 backdrop-blur-md ${bgClass} w-56 space-y-2`}>
      {/* Score + label */}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold text-white"
          style={{ backgroundColor: getStressColor(score) }}
        >
          {label}
        </span>
        <span className="text-lg font-bold" style={{ color: getStressColor(score) }}>
          {scorePercent}<span className="text-xs font-normal text-muted-foreground">/100</span>
        </span>
      </div>

      {/* Mental state */}
      <p className="text-xs text-muted-foreground capitalize">
        {latestChunk?.mental_state?.replace(/_/g, ' ') || 'Waiting…'}
      </p>

      {/* Face emotion badge */}
      {faceEmotion && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Face:</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize">
            {faceEmotion}
          </span>
        </div>
      )}

      {/* Top emotions */}
      {topEmotions.length > 0 && (
        <div className="space-y-1">
          {topEmotions.map((e) => (
          <div key={e.label} className="flex items-center gap-2">
              <span className="w-14 truncate text-[10px] capitalize text-muted-foreground">{e.label}</span>
              <div className="h-1.5 flex-1 rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(e.score * 100, 100)}%`,
                    backgroundColor: getStressColor(score),
                  }}
                />
              </div>
              <span className="w-8 text-right text-[10px] font-medium">{Math.round(e.score * 100)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Sparkline */}
      <Sparkline data={stressHistory} />

      {/* Transcript line */}
      {latestChunk?.transcript && (
        <p className="line-clamp-2 text-[10px] italic text-muted-foreground">
          "{latestChunk.transcript}"
        </p>
      )}
    </div>
  );
}
