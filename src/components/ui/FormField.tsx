/**
 * Objetivo: campos de formulario accesibles (label asociado, mensaje de
 * error con aria-describedby) compatibles con react-hook-form vía forwardRef.
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface FieldWrapperProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  id: string;
  children: ReactNode;
}

function FieldWrapper({ label, error, hint, required, id, children }: FieldWrapperProps) {
  return (
    <div className={`field ${error ? 'field-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="required" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && (
        <small className="error-text" id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

type Common = { label: string; error?: string; hint?: string };

export const Input = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement>>(
  ({ label, error, hint, required, id, ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} id={fieldId}>
        <input ref={ref} id={fieldId} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-error` : undefined} {...rest} />
      </FieldWrapper>
    );
  },
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, Common & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ label, error, hint, required, id, rows = 3, ...rest }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} id={fieldId}>
        <textarea ref={ref} id={fieldId} rows={rows} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-error` : undefined} {...rest} />
      </FieldWrapper>
    );
  },
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<
  HTMLSelectElement,
  Common & SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string | number; label: string }>; placeholder?: string }
>(({ label, error, hint, required, id, options, placeholder, ...rest }, ref) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldWrapper label={label} error={error} hint={hint} required={required} id={fieldId}>
      <select ref={ref} id={fieldId} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-error` : undefined} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
});
Select.displayName = 'Select';
