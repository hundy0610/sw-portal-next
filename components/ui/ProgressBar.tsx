"use client";

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: number;
}

export function ProgressBar({ value, color = "#0052CC", height = 6 }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  const autoColor =
    pct >= 90 ? "#DE350B" : pct >= 75 ? "#FF991F" : color;

  return (
    <div
      className="prog-track"
      style={{ height }}
      title={`${pct}%`}
    >
      <div
        className="prog-fill"
        style={{ width: `${pct}%`, background: autoColor, height }}
      />
    </div>
  );
}
