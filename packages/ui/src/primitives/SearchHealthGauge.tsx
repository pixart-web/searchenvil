import { cn } from "../lib/cn";

export interface SearchHealthGaugeProps {
  score: number;
  size?: number;
  className?: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return "#36B978"; // success
  if (score >= 50) return "#E3A72F"; // warning
  return "#E65353"; // danger
}

/** A restrained circular progress ring for the 0-100 Search Health score — see docs/SCORING.md. */
export function SearchHealthGauge({ score, size = 120, className }: SearchHealthGaugeProps): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const strokeWidth = size * 0.09;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color = scoreColor(clamped);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Search Health score: ${clamped} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-forge-800"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-semibold text-steel-100">{clamped}</span>
        <span className="text-xs text-steel-500">/ 100</span>
      </div>
    </div>
  );
}
