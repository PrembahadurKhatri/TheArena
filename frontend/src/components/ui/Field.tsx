import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const fieldClasses =
  "w-full rounded-xl border border-border bg-base-2 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-ink-faint/50 focus:border-accent focus:bg-base focus:ring-4 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-50";

interface WrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}

export function FieldWrap({ label, hint, error, required, children, htmlFor }: WrapperProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink-muted">
          {label} {required && <span className="text-accent">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="text-xs text-ink-faint">{hint}</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className = "", id, required, ...rest },
  ref
) {
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <input
        ref={ref}
        id={id}
        required={required}
        className={`${fieldClasses} ${error ? "border-danger/50" : ""} ${className}`}
        {...rest}
      />
    </FieldWrap>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className = "", id, required, ...rest },
  ref
) {
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <textarea
        ref={ref}
        id={id}
        required={required}
        className={`${fieldClasses} min-h-[120px] resize-y ${error ? "border-danger/50" : ""} ${className}`}
        {...rest}
      />
    </FieldWrap>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className = "", id, required, children, ...rest },
  ref
) {
  return (
    <FieldWrap label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <select
        ref={ref}
        id={id}
        required={required}
        className={`${fieldClasses} appearance-none ${error ? "border-danger/50" : ""} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldWrap>
  );
});
