import Link from "next/link";

interface MenuButtonProps {
  title: string;
  description: string;
  href: string;
}

export default function MenuButton({ title, description, href }: MenuButtonProps) {
  return (
    <Link
      href={href}
      className="flex w-full cursor-pointer flex-col items-start justify-center gap-spacing-50 rounded-radius-400 border border-line-outline bg-components-fill-standard-primary px-spacing-500 py-spacing-400 duration-100 hover:opacity-75 active:scale-95 active:opacity-50">
      <span className="font-semibold text-heading">{title}</span>
      <span className="text-content-standard-secondary text-label">{description}</span>
    </Link>
  );
}
