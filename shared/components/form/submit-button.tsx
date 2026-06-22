interface SubmitButtonProps {
  text: string;
  isLoading?: boolean;
}

export default function SubmitButton({ text, isLoading = false }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className="flex w-full items-center justify-center rounded-radius-400 bg-core-accent px-spacing-500 py-spacing-400 duration-100 hover:opacity-75 active:scale-95 active:opacity-50 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={isLoading}>
      <span className="whitespace-pre-wrap font-semibold text-content-inverted-primary text-heading">{text}</span>
    </button>
  );
}
