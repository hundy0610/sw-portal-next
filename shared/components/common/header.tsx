interface HeaderProps {
  title: string;
  highlighted: string;
}

export default function Header({ title, highlighted }: HeaderProps) {
  return (
    <span className="font-semibold text-display">
      {title}{" "}
      <span className="bg-gradient-to-r from-core-accent to-solid-red bg-clip-text text-title text-transparent md:text-display">
        {highlighted}.
      </span>
    </span>
  );
}
