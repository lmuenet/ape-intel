import { useEffect } from "preact/hooks";
import type { JSX } from "preact";
import { App } from "../popup/App";
import "./dashboardOverlay.css";

export interface DashboardOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  /** Injectable for tests; defaults to the real board App. */
  Board?: () => JSX.Element;
}

export function DashboardOverlay({ isOpen, onClose, Board = () => <App /> }: DashboardOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      class="ape-dash"
      role="dialog"
      aria-label="Ape Intel trending dashboard"
      aria-modal="true"
      onClick={onClose}
    >
      <div class="ape-dash__panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" class="ape-dash__close" aria-label="Close dashboard" onClick={onClose}>
          ×
        </button>
        <Board />
      </div>
    </div>
  );
}
