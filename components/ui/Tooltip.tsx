"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

const SHOW_DELAY_MS = 500;
const VIEWPORT_PADDING = 8;

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({ top: rect.bottom + 6, left: rect.left });
      setVisible(true);
    }, SHOW_DELAY_MS);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // 화면 가장자리에서 잘리지 않도록 위치 보정
  useLayoutEffect(() => {
    if (!visible) return;
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = triggerRect.left;
    if (left + tooltipRect.width > window.innerWidth - VIEWPORT_PADDING) {
      left = window.innerWidth - VIEWPORT_PADDING - tooltipRect.width;
    }
    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;

    let top = triggerRect.bottom + 6;
    if (top + tooltipRect.height > window.innerHeight - VIEWPORT_PADDING) {
      top = triggerRect.top - tooltipRect.height - 6;
    }

    setCoords({ top, left });
  }, [visible]);

  if (!content) return <>{children}</>;

  return (
    <span ref={triggerRef} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <span
          ref={tooltipRef}
          className="fixed z-50 max-w-xs whitespace-pre-wrap break-words rounded-lg bg-gray-900 text-white text-xs leading-relaxed px-3 py-2 shadow-lg pointer-events-none"
          style={{ top: coords.top, left: coords.left }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
