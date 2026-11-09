import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export type RowMenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
};

/**
 * Botão "⋯" com ações secundárias de uma linha (Cancelar, Excluir, Histórico…).
 * O menu usa position: fixed para não ser cortado pelo scroll das tabelas.
 */
export function RowMenu({ items, label = "Mais ações" }: { items: RowMenuItem[]; label?: string }) {
  const visible = items.filter((item) => !item.hidden);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight || 44 * visible.length + 12;
      const menuWidth = menuRef.current?.offsetWidth || 190;
      const below = rect.bottom + 6 + menuHeight <= window.innerHeight;
      setPosition({
        top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - menuHeight),
        left: Math.min(
          Math.max(8, rect.right - menuWidth),
          window.innerWidth - menuWidth - 8,
        ),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, visible.length]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!visible.length) return null;

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        className="iconButton rowMenuTrigger"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal />
      </button>
      {open ? (
        <div
          ref={menuRef}
          className="rowMenu"
          role="menu"
          style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
        >
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.danger ? "danger" : ""}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
