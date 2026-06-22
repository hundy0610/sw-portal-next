import type React from "react";

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function Container({ children, className = "" }: ContainerProps) {
  const baseClasses = "flex flex-col items-center justify-start gap-spacing-700 px-spacing-400 py-spacing-700";

  return <div className={`${baseClasses} ${className}`}>{children}</div>;
}
