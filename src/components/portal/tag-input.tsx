import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

export function TagInput({
  value,
  onChange,
  placeholder,
  hint,
  id,
}: {
  value: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  hint?: string;
  id?: string;
}) {
  const [text, setText] = useState("");

  function add() {
    const item = text.trim();
    if (!item) return;
    onChange([...value, item]);
    setText("");
  }

  return (
    <div className="grid gap-2">
      <Input
        id={id}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {value.length > 0 && (
        <ul className="flex max-h-16 flex-wrap content-start gap-2 overflow-y-auto">
          {value.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-sm"
            >
              <span>{item}</span>
              <button
                type="button"
                aria-label={`Remover ${item}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
