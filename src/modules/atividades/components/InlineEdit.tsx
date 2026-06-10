import { useEffect, useRef, useState } from "react";

// Click-to-edit reusável (assinatura Trello): clicar no texto → input no mesmo
// lugar, foco imediato; Enter/blur salva (otimista no caller), Esc cancela.
// Modo controlado opcional (editing/onEditingChange) p/ disparar de fora
// (atalho `e`, botão ✎). stopPropagation evita iniciar drag/abrir detalhe.
export default function InlineEdit({
  value,
  onSave,
  editing: controlledEditing,
  onEditingChange,
  textStyle,
  inputStyle,
  placeholder,
  ariaLabel,
  multiline,
}: {
  value: string;
  onSave: (next: string) => void;
  editing?: boolean;
  onEditingChange?: (v: boolean) => void;
  textStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  placeholder?: string;
  ariaLabel?: string;
  multiline?: boolean;
}) {
  const [internalEditing, setInternalEditing] = useState(false);
  const isControlled = controlledEditing !== undefined;
  const isEditing = isControlled ? controlledEditing : internalEditing;
  const setEditing = (v: boolean) => {
    if (isControlled) onEditingChange?.(v);
    else setInternalEditing(v);
  };
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      const el = ref.current;
      if (el) {
        el.focus();
        el.select?.();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const commit = () => {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== value) onSave(v);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  if (isEditing) {
    const common = {
      ref,
      value: draft,
      "aria-label": ariaLabel,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          commit();
        } else if (e.key === "Enter" && multiline && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        }
      },
      style: inputStyle,
    };
    return multiline ? <textarea rows={2} {...common} /> : <input {...common} />;
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      onPointerDown={(e) => e.stopPropagation()}
      title="Clique para editar"
      style={{ cursor: "text", ...textStyle }}
    >
      {value || <span style={{ opacity: 0.5 }}>{placeholder}</span>}
    </span>
  );
}
