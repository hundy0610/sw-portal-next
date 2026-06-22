import { TriangleAlert } from "lucide-react";

interface ErrorComponentProps {
  errorMessage: string;
}

export default function ErrorComponent({ errorMessage }: ErrorComponentProps) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-spacing-400">
      <TriangleAlert className="text-core-status-negative" size={48} />
      <span className="text-center text-content-standard-secondary text-label">
        문제가 발생했어요!
        <br />
        {errorMessage}
      </span>
    </div>
  );
}
