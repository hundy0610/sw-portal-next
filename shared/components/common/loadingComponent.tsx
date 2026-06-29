export default function LoadingComponent() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-spacing-400">
      <div className="h-12 w-12 animate-spin rounded-full border-core-accent border-t-2 border-b-2" />
      <span className="text-content-standard-secondary text-label">잠시만 기다려 주세요...</span>
    </div>
  );
}
