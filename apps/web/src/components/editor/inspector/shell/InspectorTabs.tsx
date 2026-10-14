import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@openreel/ui/lib/utils";
import type { InspectorTabDef, InspectorTabId } from "../clip-tabs.config";

export interface InspectorTabsProps {
  tabs: InspectorTabDef[];
  activeId: InspectorTabId;
  onSelect: (id: InspectorTabId) => void;
}

export const InspectorTabs: React.FC<InspectorTabsProps> = ({
  tabs,
  activeId,
  onSelect,
}) => {
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollState = useCallback(() => {
    const el = navScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  const scrollNav = useCallback((delta: number) => {
    const el = navScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }, []);

  const handleNavWheel = useCallback((e: React.WheelEvent) => {
    const el = navScrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  }, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    checkScrollState();
    el.addEventListener("scroll", checkScrollState, { passive: true });
    window.addEventListener("resize", checkScrollState);
    const observer = new ResizeObserver(checkScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScrollState);
      window.removeEventListener("resize", checkScrollState);
      observer.disconnect();
    };
  }, [checkScrollState, tabs]);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`[data-tab="${activeId}"]`) as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    checkScrollState();
  }, [activeId, checkScrollState]);

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + direction + tabs.length) % tabs.length];
    if (next) onSelect(next.id);
  };

  return (
    <div className="relative flex items-center border-b border-border bg-bg-1 shrink-0 select-none w-full min-h-[38px]">
      {/* Left Scroll Arrow */}
      <button
        type="button"
        onClick={() => scrollNav(-160)}
        disabled={!canScrollLeft}
        title="Scroll tabs left"
        className={cn(
          "h-full min-h-[38px] w-7 min-w-[28px] shrink-0 z-10 flex items-center justify-center transition-all border-r border-border bg-bg-1",
          canScrollLeft
            ? "text-accent bg-accent/15 hover:text-white hover:bg-accent cursor-pointer shadow-sm"
            : "text-fg-muted/20 cursor-not-allowed opacity-25",
        )}
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
      </button>

      {/* Scrollable Tabs Container */}
      <div
        ref={navScrollRef}
        role="tablist"
        aria-label="Inspector tabs"
        onWheel={handleNavWheel}
        className="flex items-center gap-0.5 px-1.5 overflow-x-auto scrollbar-none flex-1 min-w-0 scroll-smooth"
      >
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              data-tab={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-2 text-[12px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px shrink-0 cursor-pointer",
                active
                  ? "text-accent border-accent font-semibold"
                  : "text-fg-3 border-transparent hover:text-fg hover:bg-hover/50 rounded-t",
              )}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right Scroll Arrow */}
      <button
        type="button"
        onClick={() => scrollNav(160)}
        disabled={!canScrollRight}
        title="Scroll tabs right"
        className={cn(
          "h-full min-h-[38px] w-7 min-w-[28px] shrink-0 z-10 flex items-center justify-center transition-all border-l border-border bg-bg-1 relative",
          canScrollRight
            ? "text-black bg-accent hover:bg-accent/90 cursor-pointer shadow-sm"
            : "text-fg-muted/20 cursor-not-allowed opacity-25",
        )}
      >
        <ChevronRight size={16} strokeWidth={2.5} />
        {canScrollRight && (
          <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
          </span>
        )}
      </button>
    </div>
  );
};
