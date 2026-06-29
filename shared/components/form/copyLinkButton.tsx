"use client";
import { atom, useAtom } from "jotai";

const copiedAtom = atom(false);

export default function CopyLinkButton() {
  const [copied, setCopied] = useAtom(copiedAtom);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="cursor-pointer font-semibold text-core-accent text-label underline duration-100 hover:opacity-75 active:scale-95 active:opacity-50">
      {" "}
      {copied ? "복사 완료!" : "링크 복사하기"}{" "}
    </button>
  );
}
