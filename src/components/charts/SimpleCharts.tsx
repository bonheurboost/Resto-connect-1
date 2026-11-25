import { useState } from 'react';
import type { ChartDatum } from '@/src/lib/domain/analytics';

interface ChartFrameProps {
  title: string;
  subtitle?: string;
  data: readonly ChartDatum[];
  emptyMessage?: string;
  valueFormatter?: (value: number) => string;
}

export function HorizontalBarChart({
  title,
  subtitle,
  data,
  emptyMessage = 'Aucune donnée réelle enregistrée pour le moment.',
  valueFormatter = (v) => String(v),
}: ChartFrameProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hasNonZero = data.some((d) => d.value > 0);
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-[var(--rc-fg)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--rc-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <span className="font-mono text-[11px] font-semibold text-[var(--rc-gold-text)] tabular-nums shrink-0">
            {data[hoveredIdx].label} : {valueFormatter(data[hoveredIdx].value)}
          </span>
        )}
      </div>

      {data.length === 0 || !hasNonZero ? (
        <div className="py-8 text-center text-xs text-[var(--rc-muted)] border border-dashed border-[var(--rc-border)] rounded-lg bg-[var(--rc-bg-subtle)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3" role="img" aria-label={title}>
          {data.map((item, idx) => {
            const pct = Math.max(4, Math.round((item.value / maxValue) * 100));
            const fill = idx % 2 === 0 ? 'var(--rc-chart-primary)' : 'var(--rc-chart-secondary)';
            return (
              <div
                key={item.label}
                className="space-y-1.5 rounded-md p-1 -mx-1 transition-colors hover:bg-[var(--rc-card-elevated)]"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-[var(--rc-fg)] truncate">{item.label}</span>
                  <span className="font-mono tabular-nums text-[var(--rc-muted)] shrink-0">
                    {valueFormatter(item.value)}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[var(--rc-chart-track)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: fill }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VerticalColumnChart({
  title,
  subtitle,
  data,
  emptyMessage = 'Aucune donnée réelle enregistrée sur cette période.',
  valueFormatter = (v) => String(v),
}: ChartFrameProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hasNonZero = data.some((d) => d.value > 0);
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-[var(--rc-fg)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--rc-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <span className="font-mono text-[11px] font-semibold text-[var(--rc-gold-text)] tabular-nums shrink-0">
            {data[hoveredIdx].label} : {valueFormatter(data[hoveredIdx].value)}
          </span>
        )}
      </div>

      {data.length === 0 || !hasNonZero ? (
        <div className="py-8 text-center text-xs text-[var(--rc-muted)] border border-dashed border-[var(--rc-border)] rounded-lg bg-[var(--rc-bg-subtle)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2" role="img" aria-label={title}>
          <svg viewBox="0 0 360 154" className="w-full h-38 overflow-visible">
            <line x1="0" y1="60" x2="360" y2="60" stroke="var(--rc-chart-grid)" strokeDasharray="3 3" strokeWidth="1" />
            <line x1="0" y1="120" x2="360" y2="120" stroke="var(--rc-chart-grid)" strokeWidth="1" />
            {data.slice(0, 8).map((item, idx, arr) => {
              const slotWidth = 360 / Math.max(1, arr.length);
              const barWidth = Math.min(36, Math.max(14, slotWidth * 0.52));
              const barHeight = item.value === 0 ? 0 : Math.max(4, (item.value / maxValue) * 96);
              const x = idx * slotWidth + (slotWidth - barWidth) / 2;
              const y = 120 - barHeight;
              const isHovered = hoveredIdx === idx;
              return (
                <g
                  key={item.label}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  {barHeight > 0 && (
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="5"
                      fill={
                        isHovered
                          ? 'var(--rc-gold-soft)'
                          : idx % 2 === 0
                            ? 'var(--rc-chart-primary)'
                            : 'var(--rc-chart-secondary)'
                      }
                    />
                  )}
                  <text
                    x={x + barWidth / 2}
                    y={barHeight > 0 ? y - 6 : 114}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--rc-fg)"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {valueFormatter(item.value)}
                  </text>
                  <text
                    x={x + barWidth / 2}
                    y="140"
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--rc-muted)"
                  >
                    {item.label.length > 10 ? `${item.label.slice(0, 9)}…` : item.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

export function TrendAreaChart({
  title,
  subtitle,
  data,
  emptyMessage = 'Aucun mouvement enregistré sur la période.',
  valueFormatter = (v) => String(v),
}: ChartFrameProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hasNonZero = data.some((d) => d.value > 0);
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="rounded-xl border border-[var(--rc-border)] bg-[var(--rc-card)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-[var(--rc-fg)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--rc-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {hoveredIdx !== null && data[hoveredIdx] && (
          <span className="font-mono text-[11px] font-semibold text-[var(--rc-gold-text)] tabular-nums shrink-0">
            {data[hoveredIdx].label} : {valueFormatter(data[hoveredIdx].value)}
          </span>
        )}
      </div>

      {data.length === 0 || !hasNonZero ? (
        <div className="py-8 text-center text-xs text-[var(--rc-muted)] border border-dashed border-[var(--rc-border)] rounded-lg bg-[var(--rc-bg-subtle)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2" role="img" aria-label={title}>
          <svg viewBox="0 0 360 154" className="w-full h-38 overflow-visible">
            <defs>
              <linearGradient id="rc-gold-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F5B800" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#F5B800" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <line x1="0" y1="60" x2="360" y2="60" stroke="var(--rc-chart-grid)" strokeDasharray="3 3" strokeWidth="1" />
            <line x1="0" y1="120" x2="360" y2="120" stroke="var(--rc-chart-grid)" strokeWidth="1" />
            {(() => {
              const points = data.map((d, idx) => {
                const x = data.length === 1 ? 180 : 20 + (idx / (data.length - 1)) * 320;
                const y = 116 - (d.value / maxValue) * 92;
                return { x, y, ...d };
              });
              const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
              const areaPath =
                points.length > 1
                  ? `M ${points[0].x},120 L ${points.map((p) => `${p.x},${p.y}`).join(' L ')} L ${points[points.length - 1].x},120 Z`
                  : '';
              return (
                <>
                  {areaPath && <path d={areaPath} fill="url(#rc-gold-area)" />}
                  {points.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="var(--rc-chart-primary)"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      points={polyline}
                    />
                  )}
                  {points.map((p, idx) => (
                    <g
                      key={p.label}
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={hoveredIdx === idx ? 6 : 4.5}
                        fill="var(--rc-gold)"
                        stroke="var(--rc-card)"
                        strokeWidth="2"
                      />
                      <text
                        x={p.x}
                        y={p.y - 10}
                        textAnchor="middle"
                        fontSize="10"
                        fill="var(--rc-fg)"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {valueFormatter(p.value)}
                      </text>
                      <text x={p.x} y="140" textAnchor="middle" fontSize="10" fill="var(--rc-muted)">
                        {p.label.length > 10 ? p.label.slice(5) : p.label}
                      </text>
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>
        </div>
      )}
    </div>
  );
}
