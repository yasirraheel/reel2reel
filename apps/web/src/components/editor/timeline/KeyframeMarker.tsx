import React, { useCallback, useState, useEffect, useRef } from "react";
import type { Keyframe } from "@openreel/core";
import { X } from "lucide-react";

interface ContextMenuState {
  x: number;
  y: number;
}

interface KeyframeMarkerProps {
  keyframe: Keyframe;
  xPosition: number;
  color: string;
  isSelected: boolean;
  onSelect: (addToSelection: boolean) => void;
  onMove: (deltaPixels: number) => void;
  onDelete: () => void;
}

export const KeyframeMarker: React.FC<KeyframeMarkerProps> = ({
  keyframe,
  xPosition,
  color,
  isSelected,
  onSelect,
  onMove,
  onDelete,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [hasMoved, setHasMoved] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const addToSelection = e.shiftKey || e.metaKey || e.ctrlKey;
      onSelect(addToSelection);

      setIsDragging(true);
      setHasMoved(false);
      setDragStartX(e.clientX);
    },
    [onSelect]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStartX;
      if (Math.abs(deltaX) > 2) {
        setHasMoved(true);
        onMove(deltaX);
        setDragStartX(e.clientX);
      }
    },
    [isDragging, dragStartX, onMove]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Right-click: show a small context menu instead of instant delete
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    []
  );

  // Double-click: CapCut-style quick delete
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!hasMoved) {
        onDelete();
      }
    },
    [hasMoved, onDelete]
  );

  // Dismiss context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [contextMenu]);

  return (
    <>
      <div
        ref={markerRef}
        className={`absolute top-1/2 -translate-y-1/2 cursor-pointer transition-transform group/kf ${
          isDragging ? "scale-125 z-50" : "hover:scale-110"
        }`}
        style={{
          left: xPosition,
          transform: `translate(-50%, -50%) rotate(45deg) ${isDragging ? "scale(1.25)" : ""}`,
          zIndex: isSelected ? 40 : 20,
        }}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        title="Click to select • Double-click to delete • Right-click for options"
      >
        <div
          className={`w-2.5 h-2.5 rounded-sm transition-all ${
            isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-background-secondary" : ""
          }`}
          style={{
            backgroundColor: color,
            boxShadow: isSelected ? `0 0 8px ${color}` : "none",
          }}
        />
      </div>

      {/* Floating delete button shown when selected */}
      {isSelected && (
        <div
          className="absolute z-50 flex flex-col items-center gap-0.5 pointer-events-auto"
          style={{
            left: xPosition,
            top: 0,
            transform: "translate(-50%, -100%) translateY(-4px)",
          }}
        >
          {/* Time label */}
          <span className="text-[8px] text-text-muted bg-background-secondary/90 px-1.5 py-0.5 rounded whitespace-nowrap border border-border/50 shadow-sm">
            {keyframe.time.toFixed(2)}s
          </span>
          {/* Delete button */}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="w-4 h-4 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-md transition-colors border border-red-600/50"
            title="Delete keyframe"
          >
            <X size={8} className="text-white" />
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[9999] min-w-[140px] bg-background-secondary border border-border rounded-lg shadow-2xl overflow-hidden py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="px-3 py-1 text-[9px] text-text-muted uppercase tracking-wider font-medium border-b border-border mb-1">
            Keyframe • {keyframe.time.toFixed(2)}s
          </div>
          <button
            className="w-full px-3 py-1.5 text-left text-[11px] text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setContextMenu(null);
              onDelete();
            }}
          >
            <X size={11} />
            Delete Keyframe
          </button>
        </div>
      )}
    </>
  );
};

export default KeyframeMarker;
