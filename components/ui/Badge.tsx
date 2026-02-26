"use client";

type BadgeVariant = "approved" | "banned" | "conditional" | "active" | "neutral" | "default";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  approved:    "bg-green-50 text-green-800",
  banned:      "bg-red-50 text-red-700",
  conditional: "bg-yellow-50 text-yellow-800",
  active:      "bg-blue-50 text-blue-800",
  neutral:     "bg-blue-50 text-blue-800",
  default:     "bg-gray-100 text-gray-700",
};

const LABEL_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  approved:    { label: "승인",   variant: "approved" },
  banned:      { label: "금지",   variant: "banned" },
  conditional: { label: "조건부", variant: "conditional" },
  "구독 중":   { label: "구독 중", variant: "approved" },
  "구독 해지": { label: "해지",   variant: "banned" },
  "접수":      { label: "접수",   variant: "default" },
  "처리중":    { label: "처리중", variant: "active" },
  "완료":      { label: "완료",   variant: "approved" },
  "높음":      { label: "높음",   variant: "banned" },
  "중간":      { label: "중간",   variant: "conditional" },
  "낮음":      { label: "낮음",   variant: "default" },
};

interface BadgeProps {
  value: string;
  children?: React.ReactNode;
}

export function Badge({ value, children }: BadgeProps) {
  const mapped = LABEL_MAP[value];
  const variant = mapped?.variant ?? "default";
  const label = children ?? mapped?.label ?? value;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${VARIANT_STYLES[variant]}`}
    >
      {label}
    </span>
  );
}
