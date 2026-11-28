import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const inputClasses = [
  "w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground",
  "placeholder:text-muted/80",
  "transition-colors",
  "focus:border-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/30",
  "disabled:cursor-not-allowed disabled:bg-surface-hover disabled:opacity-70",
].join(" ");

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextInput({
  id,
  label,
  hint,
  error,
  className = "",
  ...props
}: TextInputProps) {
  const inputId = id ?? props.name;
  const messageId = inputId ? `${inputId}-message` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        className={[inputClasses, error ? "border-error focus:ring-error/20" : "", className].join(" ")}
        aria-invalid={Boolean(error)}
        aria-describedby={messageId}
        {...props}
      />
      {error ? (
        <p id={messageId} className="text-sm font-medium text-error-text">{error}</p>
      ) : hint ? (
        <p id={messageId} className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextArea({
  id,
  label,
  hint,
  error,
  className = "",
  ...props
}: TextAreaProps) {
  const inputId = id ?? props.name;
  const messageId = inputId ? `${inputId}-message` : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      <textarea
        id={inputId}
        className={[inputClasses, "min-h-28 resize-y", error ? "border-error" : "", className].join(" ")}
        aria-invalid={Boolean(error)}
        aria-describedby={messageId}
        {...props}
      />
      {error ? (
        <p id={messageId} className="text-sm font-medium text-error-text">{error}</p>
      ) : hint ? (
        <p id={messageId} className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
