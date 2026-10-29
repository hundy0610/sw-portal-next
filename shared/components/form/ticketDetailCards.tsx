import type React from "react";

interface TicketDetailCardProps {
  children: React.ReactNode;
  className?: string;
}

export function TicketDetailCard({ children, className }: TicketDetailCardProps) {
  const baseClasses =
    "w-full rounded-radius-400 border border-line-outline bg-components-fill-standard-primary px-spacing-500 py-spacing-400";

  return <div className={`${baseClasses} ${className}`}>{children}</div>;
}

interface TicketDetailInfoProps {
  label: string;
  value: string;
}

export function TicketDetailInfo({ label, value }: TicketDetailInfoProps) {
  return (
    <div className="flex flex-col gap-spacing-100 py-spacing-300">
      <span className="text-content-standard-tertiary text-label">{label}</span>
      <span className="text-body">{value}</span>
    </div>
  );
}
