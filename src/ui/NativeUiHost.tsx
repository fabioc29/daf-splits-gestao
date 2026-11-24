import { useEffect, useState } from "react";

/**
 * Substitui dois elementos nativos do navegador por versões do sistema:
 * 1. a dica amarela/cinza do atributo `title` → balão de dica do sistema;
 * 2. o balão de validação do formulário ("Preencha este campo") → aviso do sistema.
 * É montado uma única vez (em main.tsx) e vale para todas as telas.
 */

type Bubble = { text: string; top: number; left: number; placement: "top" | "bottom"; kind: "tip" | "error" };

function placeNear(element: Element, text: string, kind: Bubble["kind"]): Bubble {
  const rect = element.getBoundingClientRect();
  const placement: Bubble["placement"] = kind === "error" || rect.top < 56 ? "bottom" : "top";
  return {
    text,
    kind,
    placement,
    left: Math.min(Math.max(12, rect.left + rect.width / 2), window.innerWidth - 12),
    top: placement === "top" ? rect.top - 8 : rect.bottom + 8,
  };
}

function validationText(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const validity = field.validity;
  if (validity.customError && field.validationMessage) return field.validationMessage;
  const isChoice = field.classList.contains("sysRequiredProxy") || field instanceof HTMLSelectElement;
  if (validity.valueMissing) return isChoice ? "Selecione uma opção." : "Preencha este campo.";
  if (validity.typeMismatch) {
    if (field.type === "email") return "Informe um e-mail válido.";
    if (field.type === "url") return "Informe um endereço válido.";
    return "Valor em formato inválido.";
  }
  if (validity.patternMismatch) return field.getAttribute("data-pattern-message") || "Use apenas números (ex.: 12,50).";
  if (validity.rangeUnderflow) return `O valor mínimo é ${(field as HTMLInputElement).min}.`;
  if (validity.rangeOverflow) return `O valor máximo é ${(field as HTMLInputElement).max}.`;
  if (validity.stepMismatch) return "Valor fora do intervalo permitido.";
  if (validity.tooShort) return `Use pelo menos ${(field as HTMLInputElement).minLength} caracteres.`;
  if (validity.tooLong) return `Use no máximo ${(field as HTMLInputElement).maxLength} caracteres.`;
  if (validity.badInput) return "Valor inválido.";
  return field.validationMessage || "Verifique este campo.";
}

export function NativeUiHost() {
  const [tip, setTip] = useState<Bubble | null>(null);
  const [error, setError] = useState<Bubble | null>(null);

  // Dicas (title)
  useEffect(() => {
    let timer = 0;
    let current: Element | null = null;

    const adopt = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      const element = target.closest("[title], [data-sys-tip]");
      if (!element) return null;
      const title = element.getAttribute("title");
      if (title !== null) {
        // Remove o title para o navegador não mostrar a dica nativa.
        element.removeAttribute("title");
        if (title.trim()) element.setAttribute("data-sys-tip", title);
        if (!element.getAttribute("aria-label") && title.trim() && !element.textContent?.trim()) {
          element.setAttribute("aria-label", title);
        }
      }
      return element.getAttribute("data-sys-tip") ? element : null;
    };

    const show = (element: Element, delay: number) => {
      window.clearTimeout(timer);
      current = element;
      timer = window.setTimeout(() => {
        if (current !== element || !element.isConnected) return;
        setTip(placeNear(element, element.getAttribute("data-sys-tip") || "", "tip"));
      }, delay);
    };
    const hide = () => {
      window.clearTimeout(timer);
      current = null;
      setTip(null);
    };

    const onOver = (event: Event) => {
      const element = adopt(event.target);
      if (element && element !== current) show(element, 380);
      else if (!element && current) hide();
    };
    const onFocus = (event: Event) => {
      const element = adopt(event.target);
      if (element && (event.target as Element).matches?.(":focus-visible")) show(element, 200);
    };

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", hide, true);
    document.addEventListener("pointerdown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", hide, true);
      document.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);

  // Validação de formulários
  useEffect(() => {
    let shownAt = 0;
    let hideTimer = 0;

    const onInvalid = (event: Event) => {
      const field = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!field || !("validity" in field)) return;
      event.preventDefault(); // impede o balão nativo do navegador
      const now = Date.now();
      if (now - shownAt < 120) return; // só o primeiro campo inválido de cada envio
      shownAt = now;

      const wrapper = field.classList.contains("sysRequiredProxy")
        ? field.closest(".sysSelect, .sysDate") || field.parentElement || field
        : field;
      const focusTarget =
        (wrapper !== field && wrapper.querySelector<HTMLElement>("button, input:not(.sysRequiredProxy):not([type=hidden])")) ||
        field;
      wrapper.classList.add("sysInvalid");
      window.setTimeout(() => wrapper.classList.remove("sysInvalid"), 2600);
      (wrapper as HTMLElement).scrollIntoView?.({ block: "center", behavior: "smooth" });
      window.setTimeout(() => {
        (focusTarget as HTMLElement).focus?.({ preventScroll: true });
        setError(placeNear(wrapper, validationText(field), "error"));
      }, 220);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setError(null), 3800);
    };
    const clear = () => setError(null);

    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", clear, true);
    document.addEventListener("pointerdown", clear, true);
    window.addEventListener("resize", clear);
    return () => {
      window.clearTimeout(hideTimer);
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", clear, true);
      document.removeEventListener("pointerdown", clear, true);
      window.removeEventListener("resize", clear);
    };
  }, []);

  return (
    <>
      {tip ? (
        <div
          className={"sysTooltip " + tip.placement}
          role="tooltip"
          style={{ top: tip.top, left: tip.left }}
        >
          {tip.text}
        </div>
      ) : null}
      {error ? (
        <div className={"sysTooltip sysFieldError " + error.placement} role="alert" style={{ top: error.top, left: error.left }}>
          {error.text}
        </div>
      ) : null}
    </>
  );
}
