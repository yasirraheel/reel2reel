import React, { useCallback, useEffect, useRef } from "react";

type RangeMarkerKind = "in" | "out";

interface TimelineRangeMarkerProps {
  kind: RangeMarkerKind;
  time: number;
  pixelsPerSecond: number;
  timelineRef: React.RefObject<HTMLDivElement | null>;
  minTime: number;
  maxTime: number;
  onChange: (time: number) => void;
}

const COLORS = {
  in: {
    text: "text-emerald-300",
    line: "bg-emerald-400",
    triangle: "border-t-emerald-400",
    badge: "bg-emerald-500",
  },
  out: {
    text: "text-rose-300",
    line: "bg-rose-400",
    triangle: "border-t-rose-400",
    badge: "bg-rose-500",
  },
} as const;

/** Draggable global in/out marker. It lives inside the horizontally scrolling timeline content. */
export const TimelineRangeMarker: React.FC<TimelineRangeMarkerProps> = ({
  kind,
  time,
  pixelsPerSecond,
  timelineRef,
  minTime,
  maxTime,
  onChange,
}) => {
  const draggingRef = useRef(false);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const colors = COLORS[kind];

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const timeline = timelineRef.current;
      if (!timeline) return;
      const rect = timeline.getBoundingClientRect();
      const contentX = clientX - rect.left + timeline.scrollLeft;
      const nextTime = Math.max(
        minTime,
        Math.min(maxTime, contentX / pixelsPerSecond),
      );
      onChange(nextTime);
    },
    [maxTime, minTime, onChange, pixelsPerSecond, timelineRef],
  );

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      document.body.style.userSelect = "";
    };
  }, []);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    draggingRef.current = true;
    document.body.style.userSelect = "none";
    updateFromClientX(event.clientX);

    const handleMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      updateFromClientX(moveEvent.clientX);
    };
    const handleUp = () => {
      draggingRef.current = false;
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      dragCleanupRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    dragCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      draggingRef.current = false;
    };
  };

  return (
    <div
      className="absolute top-0 bottom-0 z-[60] w-0 pointer-events-auto"
      style={{ left: `${time * pixelsPerSecond}px` }}
      onMouseDown={handleMouseDown}
      role="slider"
      aria-label={`${kind === "in" ? "In" : "Out"} point`}
      aria-valuemin={minTime}
      aria-valuemax={maxTime}
      aria-valuenow={time}
      tabIndex={0}
      title={`Drag ${kind === "in" ? "in" : "out"} point`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${colors.line}`} />
      <div
        className={`absolute left-0 top-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent ${colors.triangle}`}
      />
      <div
        className={`absolute left-1 top-1 rounded px-1 py-0.5 text-[9px] font-bold leading-none text-white shadow ${colors.badge}`}
      >
        {kind.toUpperCase()}
      </div>
      <span className={`sr-only ${colors.text}`}>
        {kind === "in" ? "In" : "Out"} point at {time.toFixed(2)} seconds
      </span>
    </div>
  );
};

