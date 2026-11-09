import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type InputHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Search } from "lucide-react";

/**
 * Controles do próprio sistema DAF, no lugar dos elementos nativos do navegador:
 * - SysSelect   → mantém o <select>, mas com a lista suspensa do sistema (com busca)
 * - DateInput   → substitui <input type="date"> (calendário próprio)
 * - ComboInput  → substitui <input list> + <datalist> (sugestões)
 * - ColorInput  → substitui <input type="color"> (seletor de cor)
 *
 * Todos aceitam o mesmo formato de onChange usado no código (event.target.value)
 * e, quando recebem `name`, gravam o valor num <input type="hidden"> para que
 * os formulários lidos com FormData continuem funcionando.
 */

export type SysChangeEvent = {
  target: { value: string; name?: string };
  currentTarget: { value: string; name?: string };
};

function changeEvent(value: string, name?: string): SysChangeEvent {
  return { target: { value, name }, currentTarget: { value, name } };
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/* ------------------------------------------------------------------ */
/* Posicionamento de camadas flutuantes (listas, calendário, cores)    */
/* ------------------------------------------------------------------ */

type FloatingPosition = { top: number; left: number; width: number; maxHeight: number };

function useFloating(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  floatRef: RefObject<HTMLElement | null>,
  options: { minWidth?: number; matchWidth?: boolean; preferredHeight?: number } = {},
  deps: unknown[] = [],
) {
  const { minWidth = 0, matchWidth = true, preferredHeight = 300 } = options;
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const floating = floatRef.current;
      const naturalHeight = floating?.scrollHeight || preferredHeight;
      const width = matchWidth
        ? Math.max(rect.width, minWidth)
        : Math.max(floating?.offsetWidth || 0, minWidth);
      const spaceBelow = window.innerHeight - rect.bottom - 10;
      const spaceAbove = rect.top - 10;
      const below = spaceBelow >= Math.min(naturalHeight, preferredHeight) || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(140, (below ? spaceBelow : spaceAbove) - 6);
      const height = Math.min(naturalHeight, maxHeight);
      setPosition({
        top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height),
        left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8)),
        width,
        maxHeight,
      });
    };
    place();
    const frame = window.requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ...deps]);

  return position;
}

function useOutsideClose(
  open: boolean,
  refs: RefObject<HTMLElement | null>[],
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      close();
    };
    document.addEventListener("mousedown", onPointer, true);
    document.addEventListener("touchstart", onPointer, true);
    return () => {
      document.removeEventListener("mousedown", onPointer, true);
      document.removeEventListener("touchstart", onPointer, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/** Camada flutuante renderizada no <body>, sem deixar cliques "vazarem" para modais por baixo. */
function FloatingLayer({
  open,
  position,
  floatRef,
  className,
  children,
  role,
  style,
  onKeyDown,
}: {
  open: boolean;
  position: FloatingPosition | null;
  floatRef: RefObject<HTMLDivElement | null>;
  className: string;
  children: ReactNode;
  role?: string;
  style?: CSSProperties;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
}) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={floatRef}
      className={"sysFloating " + className}
      role={role}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{
        ...(position
          ? { top: position.top, left: position.left, minWidth: position.width, maxHeight: position.maxHeight }
          : { top: -9999, left: -9999, visibility: "hidden" }),
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* SysSelect                                                           */
/* ------------------------------------------------------------------ */

type SelectOption = { value: string; label: string; disabled: boolean; group?: string };

function readOptions(select: HTMLSelectElement): SelectOption[] {
  return Array.from(select.options).map((option) => ({
    value: option.value,
    label: option.label || option.text,
    disabled: option.disabled,
    group: option.parentElement instanceof HTMLOptGroupElement ? option.parentElement.label : undefined,
  }));
}

/**
 * Mantém o <select> real (estilos, formulários e validação continuam iguais),
 * mas troca a lista suspensa do navegador pela lista do sistema.
 */
export function SysSelect({
  searchable,
  className = "",
  onMouseDown,
  onKeyDown,
  ...selectProps
}: SelectHTMLAttributes<HTMLSelectElement> & { searchable?: boolean }) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [current, setCurrent] = useState("");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const showSearch = searchable ?? options.length > 8;

  const visible = useMemo(() => {
    const term = normalizeText(query);
    return options.filter(
      (option) =>
        !(option.disabled && option.value === "") &&
        (!term || normalizeText(option.label).includes(term)),
    );
  }, [options, query]);

  const position = useFloating(open, selectRef, floatRef, { minWidth: 180 }, [visible.length]);
  useOutsideClose(open, [selectRef, floatRef], () => setOpen(false));

  function openMenu() {
    const select = selectRef.current;
    if (!select || select.disabled) return;
    const list = readOptions(select);
    setOptions(list);
    setCurrent(select.value);
    setQuery("");
    const usable = list.filter((option) => !(option.disabled && option.value === ""));
    setActiveIndex(usable.findIndex((option) => option.value === select.value));
    setOpen(true);
  }

  function toggle() {
    if (open) setOpen(false);
    else openMenu();
  }

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      if (showSearch) searchRef.current?.focus();
      else floatRef.current?.focus();
      listRef.current
        ?.querySelector<HTMLElement>('[aria-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function choose(option: SelectOption) {
    if (option.disabled) return;
    const select = selectRef.current;
    setOpen(false);
    if (!select) return;
    select.focus();
    if (select.value === option.value) return;
    // Altera o <select> real e dispara o "change" de verdade:
    // o onChange do React recebe o mesmo evento de antes.
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function move(step: number) {
    if (!visible.length) return;
    let next = activeIndex;
    for (let tries = 0; tries < visible.length; tries += 1) {
      next = (next + step + visible.length) % visible.length;
      if (!visible[next].disabled) break;
    }
    setActiveIndex(next);
  }

  function onListKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = visible[activeIndex];
      if (option) choose(option);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      selectRef.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (!showSearch && event.key.length === 1) {
      const letter = normalizeText(event.key);
      const index = visible.findIndex(
        (option) => !option.disabled && normalizeText(option.label).startsWith(letter),
      );
      if (index >= 0) setActiveIndex(index);
    }
  }

  let lastGroup: string | undefined;

  return (
    <>
      <select
        {...selectProps}
        ref={selectRef}
        className={(className + " sysNativeSelect" + (open ? " sysOpen" : "")).trim()}
        onMouseDown={(event) => {
          onMouseDown?.(event);
          if (event.button !== 0) return;
          event.preventDefault(); // não abre a lista do navegador
          selectRef.current?.focus();
          toggle();
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const touch = event.changedTouches[0];
          if (start && touch && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10) return;
          event.preventDefault(); // impede o seletor nativo do celular
          toggle();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (
            event.key === "ArrowDown" ||
            event.key === "ArrowUp" ||
            event.key === "Enter" ||
            event.key === " " ||
            event.key === "F4"
          ) {
            event.preventDefault();
            openMenu();
          }
        }}
      />
      <FloatingLayer
        open={open}
        position={position}
        floatRef={floatRef}
        className="sysSelectMenu"
        onKeyDown={onListKey}
      >
        {showSearch ? (
          <label className="sysSelectSearch">
            <Search aria-hidden="true" />
            <input
              ref={searchRef}
              value={query}
              placeholder="Buscar..."
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
            />
          </label>
        ) : null}
        <div className="sysSelectList" role="listbox" ref={listRef} aria-label={selectProps["aria-label"]}>
          {visible.map((option, index) => {
            const header = option.group && option.group !== lastGroup ? option.group : null;
            lastGroup = option.group;
            return (
              <Fragment key={option.value + "-" + index}>
                {header ? <div className="sysSelectGroup">{header}</div> : null}
                <button
                  type="button"
                  role="option"
                  data-index={index}
                  aria-selected={option.value === current}
                  disabled={option.disabled}
                  className={index === activeIndex ? "active" : ""}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {option.value === current ? <Check aria-hidden="true" /> : null}
                </button>
              </Fragment>
            );
          })}
          {!visible.length ? <p className="sysSelectEmpty">Nenhuma opção encontrada.</p> : null}
        </div>
      </FloatingLayer>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* DateInput                                                           */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}
function isoToBr(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}
function brToIso(text: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}
function maskDate(text: string) {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
function localTodayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export type DateInputProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (event: SysChangeEvent) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  id?: string;
  placeholder?: string;
  "aria-label"?: string;
};

export function DateInput({
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  min,
  max,
  className = "",
  id,
  placeholder = "dd/mm/aaaa",
  "aria-label": ariaLabel,
}: DateInputProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue || "");
  const current = controlled ? value || "" : inner;
  const [text, setText] = useState(isoToBr(current));
  const [open, setOpen] = useState(false);
  const initialView = current || localTodayIso();
  const [view, setView] = useState({ year: Number(initialView.slice(0, 4)), month: Number(initialView.slice(5, 7)) - 1 });
  const wrapRef = useRef<HTMLSpanElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(isoToBr(current));
  }, [current]);

  useEffect(() => {
    if (!open) return;
    const base = current || localTodayIso();
    setView({ year: Number(base.slice(0, 4)), month: Number(base.slice(5, 7)) - 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const position = useFloating(open, wrapRef, floatRef, { minWidth: 272, matchWidth: false, preferredHeight: 330 });
  useOutsideClose(open, [wrapRef, floatRef], () => setOpen(false));

  function commit(iso: string) {
    if (!controlled) setInner(iso);
    setText(isoToBr(iso));
    if (iso !== current) onChange?.(changeEvent(iso, name));
  }

  function outOfRange(iso: string) {
    return Boolean((min && iso < min) || (max && iso > max));
  }

  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let index = 0; index < firstDay; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(`${view.year}-${pad(view.month + 1)}-${pad(day)}`);
  while (cells.length % 7) cells.push(null);
  const todayIso = localTodayIso();

  function shiftMonth(step: number) {
    setView((currentView) => {
      const date = new Date(currentView.year, currentView.month + step, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  return (
    <span ref={wrapRef} className={"sysDate " + className + (open ? " open" : "") + (disabled ? " disabled" : "")}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        required={required}
        value={text}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          const masked = maskDate(event.target.value);
          setText(masked);
          if (!masked) {
            commit("");
            return;
          }
          const iso = brToIso(masked);
          if (iso && !outOfRange(iso)) {
            commit(iso);
            setView({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 });
          }
        }}
        onBlur={() => {
          // Texto incompleto volta para a última data válida.
          window.setTimeout(() => {
            if (!brToIso(text)) setText(isoToBr(current));
          }, 0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            setOpen(false);
          } else if (event.key === "Tab") {
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        className="sysDateButton"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Abrir calendário"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <CalendarDays aria-hidden="true" />
      </button>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <FloatingLayer open={open} position={position} floatRef={floatRef} className="sysCalendar" role="dialog">
        <header>
          <button type="button" aria-label="Mês anterior" onClick={() => shiftMonth(-1)}>
            <ChevronLeft />
          </button>
          <strong>
            {MONTHS[view.month]} {view.year}
          </strong>
          <button type="button" aria-label="Próximo mês" onClick={() => shiftMonth(1)}>
            <ChevronRight />
          </button>
        </header>
        <div className="sysCalendarGrid">
          {WEEKDAYS.map((weekday, index) => (
            <span key={index} className="sysCalendarWeekday">
              {weekday}
            </span>
          ))}
          {cells.map((iso, index) =>
            iso ? (
              <button
                type="button"
                key={iso}
                disabled={outOfRange(iso)}
                className={
                  (iso === current ? "selected " : "") + (iso === todayIso ? "today" : "")
                }
                onClick={() => {
                  commit(iso);
                  setOpen(false);
                }}
              >
                {Number(iso.slice(8, 10))}
              </button>
            ) : (
              <span key={"empty-" + index} />
            ),
          )}
        </div>
        <footer>
          <button
            type="button"
            onClick={() => {
              commit("");
              setOpen(false);
            }}
          >
            Limpar
          </button>
          <button
            type="button"
            className="primary"
            disabled={outOfRange(todayIso)}
            onClick={() => {
              commit(todayIso);
              setOpen(false);
            }}
          >
            Hoje
          </button>
        </footer>
      </FloatingLayer>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* ComboInput (substitui <datalist>)                                   */
/* ------------------------------------------------------------------ */

type ComboInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "list" | "onChange"> & {
  options: string[];
  onChange?: (event: SysChangeEvent | ChangeEvent<HTMLInputElement>) => void;
};

export function ComboInput({ options, onChange, className = "", ...inputProps }: ComboInputProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const controlled = inputProps.value !== undefined;
  const typed = controlled ? String(inputProps.value ?? "") : term;

  const matches = useMemo(() => {
    const search = normalizeText(typed);
    const unique = Array.from(new Set(options.filter(Boolean)));
    return (search ? unique.filter((option) => normalizeText(option).includes(search)) : unique).slice(0, 80);
  }, [options, typed]);

  const showList = open && matches.length > 0 && !(matches.length === 1 && matches[0] === typed);
  const position = useFloating(showList, inputRef, floatRef, { preferredHeight: 260 }, [matches.length]);
  useOutsideClose(showList, [inputRef, floatRef], () => setOpen(false));

  function pick(option: string) {
    if (inputRef.current && !controlled) inputRef.current.value = option;
    setTerm(option);
    setOpen(false);
    onChange?.(changeEvent(option, inputProps.name));
  }

  return (
    <>
      <input
        {...inputProps}
        ref={inputRef}
        autoComplete="off"
        className={"sysCombo " + className}
        onFocus={(event) => {
          setTerm(event.currentTarget.value);
          setOpen(true);
          inputProps.onFocus?.(event);
        }}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
          onChange?.(event);
        }}
        onKeyDown={(event) => {
          if (showList && event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(matches.length - 1, index + 1));
          } else if (showList && event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(0, index - 1));
          } else if (showList && event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            pick(matches[activeIndex]);
          } else if (event.key === "Escape" && showList) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === "Tab") {
            setOpen(false);
          }
          inputProps.onKeyDown?.(event);
        }}
      />
      <FloatingLayer open={showList} position={position} floatRef={floatRef} className="sysSelectMenu sysComboMenu">
        <div className="sysSelectList" role="listbox">
          {matches.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={option === typed}
              key={option}
              className={index === activeIndex ? "active" : ""}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
            >
              <span>{option}</span>
            </button>
          ))}
        </div>
      </FloatingLayer>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* ColorInput                                                          */
/* ------------------------------------------------------------------ */

const COLOR_PRESETS = [
  "#d5aa3d", "#b8902c", "#f2b84b", "#f08a4b", "#ef6670", "#d76de8",
  "#8b5cf6", "#7186ff", "#4ba3ff", "#54c7d4", "#32bf8a", "#76c85a",
  "#ffffff", "#e7eaf0", "#a8b0bd", "#6b7280", "#1d2433", "#050505",
];

function hexToRgb(hex: string) {
  const clean = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!clean) return null;
  const value = parseInt(clean[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((part) => Math.round(part).toString(16).padStart(2, "0")).join("");
}
function rgbToHsv(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const maxValue = Math.max(red, green, blue);
  const minValue = Math.min(red, green, blue);
  const delta = maxValue - minValue;
  let hue = 0;
  if (delta) {
    if (maxValue === red) hue = ((green - blue) / delta) % 6;
    else if (maxValue === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
  }
  return { h: (hue * 60 + 360) % 360, s: maxValue ? delta / maxValue : 0, v: maxValue };
}
function hsvToHex(h: number, s: number, v: number) {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - chroma;
  const [r, g, b] =
    h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function ColorInput({
  value,
  onChange,
  "aria-label": ariaLabel,
  className = "",
}: {
  value: string;
  onChange?: (event: SysChangeEvent) => void;
  "aria-label"?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const rgb = hexToRgb(value) || { r: 0, g: 0, b: 0 };
  const hsvFromValue = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const [hsv, setHsvState] = useState(hsvFromValue);
  const hsvRef = useRef(hsvFromValue);
  const setHsv = (next: { h: number; s: number; v: number }) => {
    hsvRef.current = next;
    setHsvState(next);
  };
  const [hexDraft, setHexDraft] = useState(value);
  const position = useFloating(open, triggerRef, floatRef, { minWidth: 248, matchWidth: false, preferredHeight: 330 });
  useOutsideClose(open, [triggerRef, floatRef], () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    setHsv(hsvFromValue);
    setHexDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function emit(next: string) {
    setHexDraft(next);
    if (next.toLowerCase() !== String(value).toLowerCase()) onChange?.(changeEvent(next));
  }

  function drag(
    ref: RefObject<HTMLDivElement | null>,
    handler: (x: number, y: number) => void,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const element = ref.current;
    if (!element) return;
    const update = (clientX: number, clientY: number) => {
      const rect = element.getBoundingClientRect();
      handler(
        Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
        Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
      );
    };
    update(event.clientX, event.clientY);
    const onMove = (moveEvent: PointerEvent) => update(moveEvent.clientX, moveEvent.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={"sysColorTrigger " + className}
        aria-label={ariaLabel || "Selecionar cor"}
        style={{ ["--swatch" as string]: value }}
        onClick={() => setOpen((current) => !current)}
      />
      <FloatingLayer open={open} position={position} floatRef={floatRef} className="sysColorPicker" role="dialog">
        <div
          ref={areaRef}
          className="sysColorArea"
          style={{ background: `hsl(${hsv.h} 100% 50%)` }}
          onPointerDown={(event) =>
            drag(areaRef, (x, y) => {
              const next = { ...hsvRef.current, s: x, v: 1 - y };
              setHsv(next);
              emit(hsvToHex(next.h, next.s, next.v));
            }, event)
          }
        >
          <i style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
        </div>
        <div
          ref={hueRef}
          className="sysColorHue"
          onPointerDown={(event) =>
            drag(hueRef, (x) => {
              const next = { ...hsvRef.current, h: Math.min(359.9, x * 360) };
              setHsv(next);
              emit(hsvToHex(next.h, next.s, next.v));
            }, event)
          }
        >
          <i style={{ left: `${(hsv.h / 360) * 100}%` }} />
        </div>
        <div className="sysColorPresets">
          {COLOR_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset}
              aria-label={preset}
              style={{ background: preset }}
              className={preset.toLowerCase() === String(value).toLowerCase() ? "selected" : ""}
              onClick={() => {
                const parsed = hexToRgb(preset)!;
                setHsv(rgbToHsv(parsed.r, parsed.g, parsed.b));
                emit(preset);
              }}
            />
          ))}
        </div>
        <label className="sysColorHex">
          <span>HEX</span>
          <input
            value={hexDraft}
            maxLength={7}
            onChange={(event) => {
              const next = event.target.value.startsWith("#") ? event.target.value : "#" + event.target.value;
              setHexDraft(next);
              const parsed = hexToRgb(next);
              if (parsed) {
                setHsv(rgbToHsv(parsed.r, parsed.g, parsed.b));
                emit(next.toLowerCase());
              }
            }}
          />
        </label>
      </FloatingLayer>
    </>
  );
}
