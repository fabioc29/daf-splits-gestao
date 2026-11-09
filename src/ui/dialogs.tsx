import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";

/**
 * Diálogos no estilo do sistema, substituindo window.confirm/window.alert.
 *
 * - askConfirm(mensagem) devolve uma Promise<boolean> (true = confirmou).
 * - showAlert(mensagem) mostra um aviso com botão "Entendi".
 *
 * Basta renderizar <DialogHost /> uma única vez (feito em App.tsx).
 */

type DialogRequest = {
  id: number;
  kind: "confirm" | "alert";
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
};

type DialogOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

let nextId = 1;
let queue: DialogRequest[] = [];
const listeners = new Set<(items: DialogRequest[]) => void>();

function emit() {
  listeners.forEach((listener) => listener(queue));
}

function enqueue(request: Omit<DialogRequest, "id" | "resolve">) {
  return new Promise<boolean>((resolve) => {
    // Sem o host montado (ex.: tela de login), usa o diálogo nativo como reserva.
    if (!listeners.size) {
      if (request.kind === "confirm") resolve(window.confirm(request.message));
      else {
        window.alert(request.message);
        resolve(true);
      }
      return;
    }
    // Evita empilhar o mesmo aviso duas vezes (ex.: validação disparada em sequência).
    const duplicate = queue.find(
      (item) => item.kind === "alert" && request.kind === "alert" && item.message === request.message,
    );
    if (duplicate) {
      resolve(true);
      return;
    }
    queue = [...queue, { ...request, id: nextId++, resolve }];
    emit();
  });
}

const DESTRUCTIVE = /^(excluir|cancelar|revogar|remover|descartar|carregar o estado)/i;

export function askConfirm(message: string, options: DialogOptions = {}) {
  const danger = options.danger ?? DESTRUCTIVE.test(message.trim());
  return enqueue({
    kind: "confirm",
    message,
    title: options.title ?? (danger ? "Confirmar ação" : "Confirmar"),
    confirmLabel: options.confirmLabel ?? (danger ? "Sim, continuar" : "Confirmar"),
    cancelLabel: options.cancelLabel ?? "Voltar",
    danger,
  });
}

export function showAlert(message: string, options: DialogOptions = {}) {
  return enqueue({
    kind: "alert",
    message,
    title: options.title ?? "Atenção",
    confirmLabel: options.confirmLabel ?? "Entendi",
  }).then(() => undefined);
}

export function DialogHost() {
  const [items, setItems] = useState<DialogRequest[]>(queue);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const current = items[0];

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  function close(value: boolean) {
    if (!current) return;
    queue = queue.filter((item) => item.id !== current.id);
    current.resolve(value);
    emit();
  }

  useEffect(() => {
    if (!current) return;
    // Em ações destrutivas o foco inicial fica em "Voltar", para evitar confirmações acidentais.
    (current.danger ? cancelRef.current : confirmRef.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(current.kind === "alert");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;
  const Icon = current.kind === "alert" || !current.danger ? Info : AlertTriangle;

  return (
    <div
      className="overlay appDialogOverlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close(current.kind === "alert");
      }}
    >
      <div
        className={"systemDialog appDialog" + (current.danger ? " danger" : "")}
        role={current.kind === "alert" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={`app-dialog-title-${current.id}`}
        aria-describedby={`app-dialog-message-${current.id}`}
      >
        <div className="appDialogIcon" aria-hidden="true">
          <Icon />
        </div>
        <h2 id={`app-dialog-title-${current.id}`}>{current.title}</h2>
        <p id={`app-dialog-message-${current.id}`}>{current.message}</p>
        <footer>
          {current.kind === "confirm" ? (
            <button type="button" ref={cancelRef} onClick={() => close(false)}>
              {current.cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            ref={confirmRef}
            className={current.danger ? "dangerSolid" : "primary"}
            onClick={() => close(true)}
          >
            {current.confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
