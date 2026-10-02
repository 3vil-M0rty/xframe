import { createContext, useCallback, useContext, useRef, useState } from "react";
import ActionModal from "./ActionModal";

/**
 * The app's own dialogs instead of the browser's confirm() / prompt() /
 * alert() — same look everywhere (ActionModal).
 *
 *   const dialog = useDialog();
 *   if (!(await dialog.confirm(t("…deleteConfirm")))) return;
 *   const reason = await dialog.prompt({ title, message, required: true }); // null = cancelled
 *   await dialog.alert(message, { type: "error" });
 */
const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const open = useCallback((kind, opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setState({ kind, ...opts, value: opts.defaultValue || "" });
  }), []);

  const close = (result) => {
    const r = resolver.current;
    resolver.current = null;
    setState(null);
    r?.(result);
  };

  const norm = (x) => (typeof x === "string" ? { message: x } : x || {});
  const api = useRef({
    confirm: (opts) => open("confirm", norm(opts)),
    prompt: (opts) => open("prompt", norm(opts)),
    alert: (message, opts = {}) => open("alert", { ...norm(message), ...opts }),
  }).current;

  return (
    <DialogContext.Provider value={api}>
      {children}
      {state && (
        <ActionModal
          isOpen
          type={state.kind === "alert" ? state.type || "error" : "confirm"}
          title={state.title}
          message={state.message}
          confirmText={state.confirmText || "common.confirm"}
          input={state.kind === "prompt" ? { value: state.value, onChange: (v) => setState((s) => ({ ...s, value: v })), placeholder: state.placeholder, required: state.required, multiline: state.multiline } : null}
          onConfirm={() => close(state.kind === "prompt" ? state.value : true)}
          onClose={() => close(state.kind === "prompt" ? null : state.kind === "alert" ? true : false)}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}
