import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Move,
  ArrowDownToLine,
  ExternalLink,
  GripHorizontal,
  Maximize2,
  Minimize2,
} from "lucide-react";

export interface FloatingPanelProps {
  id: string;
  title: string;
  icon?: React.ElementType;
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  isDetached: boolean;
  onDetach: () => void;
  onRedock: () => void;
  children: React.ReactNode;
}

export const FloatingPanel: React.FC<FloatingPanelProps> = ({
  id,
  title,
  icon: Icon,
  initialX = 80,
  initialY = 70,
  initialWidth = 560,
  initialHeight = 620,
  isDetached,
  onDetach,
  onRedock,
  children,
}) => {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevBounds, setPrevBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const popoutWindowRef = useRef<Window | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, startLeft: 0, startTop: 0 });
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, startW: 0, startH: 0 });

  // Handle Dragging
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (isMaximized) return;
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startLeft: position.x,
      startTop: position.y,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "move";
  };

  // Handle Resizing
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMaximized) return;
    isResizingRef.current = true;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startW: size.width,
      startH: size.height,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "nwse-resize";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        const newX = Math.max(10, Math.min(window.innerWidth - size.width - 10, dragStartRef.current.startLeft + dx));
        const newY = Math.max(40, Math.min(window.innerHeight - 80, dragStartRef.current.startTop + dy));
        setPosition({ x: newX, y: newY });
      } else if (isResizingRef.current) {
        const dw = e.clientX - resizeStartRef.current.x;
        const dh = e.clientY - resizeStartRef.current.y;
        const newW = Math.max(340, Math.min(window.innerWidth - position.x - 20, resizeStartRef.current.startW + dw));
        const newH = Math.max(260, Math.min(window.innerHeight - position.y - 20, resizeStartRef.current.startH + dh));
        setSize({ width: newW, height: newH });
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current || isResizingRef.current) {
        isDraggingRef.current = false;
        isResizingRef.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [position.x, position.y, size.width]);

  // Pop out to a true second browser window (Multi-Screen)
  const handlePopOut = useCallback(() => {
    const w = Math.min(window.screen.availWidth * 0.75, 1100);
    const h = Math.min(window.screen.availHeight * 0.8, 800);
    const left = (window.screen.availWidth - w) / 2;
    const top = (window.screen.availHeight - h) / 2;

    const externalWindow = window.open(
      "",
      `_openreel_panel_${id}`,
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
    );

    if (!externalWindow) {
      alert("Popout window was blocked by your browser. Please allow popups for CineWorm Reel2Reel to use multi-monitor view.");
      return;
    }

    externalWindow.document.title = `${title} — CineWorm Reel2Reel Multi-Screen`;

    // Clone all style elements and stylesheets
    document.querySelectorAll("style, link[rel='stylesheet']").forEach((node) => {
      externalWindow.document.head.appendChild(node.cloneNode(true));
    });

    externalWindow.document.body.className = document.body.className;
    externalWindow.document.body.style.margin = "0";
    externalWindow.document.body.style.padding = "0";
    externalWindow.document.body.style.overflow = "hidden";
    externalWindow.document.body.style.height = "100vh";
    externalWindow.document.body.style.background = "#0f1218";

    const container = externalWindow.document.createElement("div");
    container.id = "popout-container";
    container.style.height = "100%";
    container.style.width = "100%";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    externalWindow.document.body.appendChild(container);

    popoutWindowRef.current = externalWindow;
    setIsPoppedOut(true);

    externalWindow.addEventListener("beforeunload", () => {
      setIsPoppedOut(false);
      popoutWindowRef.current = null;
    });
  }, [id, title]);

  const handleClosePopOut = useCallback(() => {
    if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
      popoutWindowRef.current.close();
    }
    setIsPoppedOut(false);
    popoutWindowRef.current = null;
  }, []);

  // Maximize / Restore floating panel
  const toggleMaximize = () => {
    if (isMaximized) {
      if (prevBounds) {
        setPosition({ x: prevBounds.x, y: prevBounds.y });
        setSize({ width: prevBounds.width, height: prevBounds.height });
      }
      setIsMaximized(false);
    } else {
      setPrevBounds({ x: position.x, y: position.y, width: size.width, height: size.height });
      setPosition({ x: 20, y: 50 });
      setSize({ width: window.innerWidth - 40, height: window.innerHeight - 70 });
      setIsMaximized(true);
    }
  };

  // If popped out into a separate browser window (Multi-Screen)
  if (isPoppedOut && popoutWindowRef.current) {
    const popoutContainer = popoutWindowRef.current.document.getElementById("popout-container");
    if (popoutContainer) {
      return (
        <>
          {/* Main window placeholder */}
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-bg-1/80 border border-dashed border-accent/40 rounded-xl m-1 select-none">
            <span className="w-14 h-14 rounded-2xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center mb-3 shadow-lg shadow-accent/10">
              {Icon ? <Icon size={26} /> : <ExternalLink size={26} />}
            </span>
            <h4 className="text-sm font-bold text-fg mb-1">{title} on External Monitor</h4>
            <p className="text-xs text-fg-muted mb-4 max-w-xs leading-relaxed">
              This panel is running in a dedicated window on your second screen.
            </p>
            <button
              type="button"
              onClick={handleClosePopOut}
              className="px-4 py-2 rounded-xl bg-accent text-accent-fg font-bold text-xs hover:bg-accent-strong transition-all flex items-center gap-1.5 shadow-md shadow-accent/20 cursor-pointer"
            >
              <ArrowDownToLine size={15} />
              <span>Re-dock Panel</span>
            </button>
          </div>

          {/* Render in popped-out window */}
          {createPortal(
            <div className="flex flex-col h-full w-full bg-bg text-fg overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-background-secondary border-b border-border select-none shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-accent/20 text-accent flex items-center justify-center">
                    {Icon ? <Icon size={16} /> : <Move size={16} />}
                  </span>
                  <span className="text-xs font-bold text-fg">{title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-semibold">
                    Multi-Screen Mode
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClosePopOut}
                  className="px-2.5 py-1 rounded-lg bg-accent text-accent-fg text-xs font-bold hover:bg-accent-strong transition-all flex items-center gap-1 cursor-pointer"
                >
                  <ArrowDownToLine size={13} />
                  <span>Re-dock to Main Window</span>
                </button>
              </div>
              <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                {children}
              </div>
            </div>,
            popoutContainer
          )}
        </>
      );
    }
  }

  // If detached in-viewport as a floating window
  if (isDetached) {
    return (
      <>
        {/* Placeholder in grid */}
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-bg-1/60 border border-dashed border-border/80 rounded-xl m-1 select-none">
          <span className="w-12 h-12 rounded-2xl bg-accent/15 text-accent border border-accent/25 flex items-center justify-center mb-3 shadow-md shadow-accent/10">
            {Icon ? <Icon size={22} /> : <Move size={22} />}
          </span>
          <h4 className="text-sm font-bold text-fg mb-1">{title} is Floating</h4>
          <p className="text-xs text-fg-muted mb-4 max-w-xs leading-relaxed">
            Drag the window anywhere on your screen, pop it out to a second monitor, or click below to re-dock.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRedock}
              className="px-3.5 py-2 rounded-xl bg-accent text-accent-fg font-bold text-xs hover:bg-accent-strong transition-all flex items-center gap-1.5 shadow-md shadow-accent/20 cursor-pointer"
            >
              <ArrowDownToLine size={14} />
              <span>Re-dock to Grid</span>
            </button>
            <button
              type="button"
              onClick={handlePopOut}
              title="Pop out to separate window (ideal for 2nd screen)"
              className="px-3 py-2 rounded-xl bg-background-elevated hover:bg-hover border border-border text-fg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink size={13} />
              <span>2nd Screen</span>
            </button>
          </div>
        </div>

        {/* Floating draggable window */}
        <div
          style={{
            position: "fixed",
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
            zIndex: 9999,
          }}
          className="flex flex-col rounded-2xl border-2 border-accent/60 bg-bg-1 shadow-2xl shadow-black/80 overflow-hidden ring-4 ring-black/40"
        >
          {/* Draggable Title Bar */}
          <div
            onMouseDown={handleMouseDownHeader}
            className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-background-secondary via-bg-1 to-background-secondary border-b border-border/80 select-none cursor-move shrink-0"
          >
            <div className="flex items-center gap-2">
              <GripHorizontal size={16} className="text-fg-muted" />
              {Icon && <Icon size={16} className="text-accent" />}
              <span className="text-xs font-bold text-fg tracking-tight">{title}</span>
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-bold">
                Floating
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePopOut}
                title="Pop out to separate browser window for second screen"
                className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-hover transition-colors"
              >
                <ExternalLink size={14} />
              </button>

              <button
                type="button"
                onClick={toggleMaximize}
                title={isMaximized ? "Restore Size" : "Maximize"}
                className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-hover transition-colors"
              >
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              <button
                type="button"
                onClick={onRedock}
                title="Re-dock to Grid"
                className="px-2 py-1 rounded-lg bg-accent text-accent-fg text-xs font-bold hover:bg-accent-strong transition-all flex items-center gap-1 shadow-sm"
              >
                <ArrowDownToLine size={13} />
                <span>Re-dock</span>
              </button>
            </div>
          </div>

          {/* Floating Content Body */}
          <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-bg-1">
            {children}
          </div>

          {/* Bottom-right corner resize handle */}
          {!isMaximized && (
            <div
              onMouseDown={handleMouseDownResize}
              title="Drag to resize panel"
              className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize z-50 flex items-center justify-center group"
            >
              <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-accent/70 group-hover:border-accent rounded-br-sm" />
            </div>
          )}
        </div>
      </>
    );
  }

  // Default Docked in Grid: render with standard header detach icon
  return (
    <div className="w-full h-full flex flex-col min-w-0 min-h-0 relative group/docked">
      {/* Top right quick detach button */}
      <div className="absolute top-2 right-2 z-30 opacity-0 group-hover/docked:opacity-100 transition-opacity flex items-center gap-1 bg-background-elevated/90 backdrop-blur border border-border/80 rounded-lg p-0.5 shadow-md">
        <button
          type="button"
          onClick={onDetach}
          title={`Detach ${title} into a floating movable window`}
          className="p-1.5 rounded-md text-fg-muted hover:text-accent hover:bg-hover transition-all flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
        >
          <Move size={13} />
          <span>Detach</span>
        </button>
        <button
          type="button"
          onClick={handlePopOut}
          title={`Pop out ${title} to second screen window`}
          className="p-1.5 rounded-md text-fg-muted hover:text-accent hover:bg-hover transition-all cursor-pointer"
        >
          <ExternalLink size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
};
