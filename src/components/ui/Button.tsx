/** Objetivo: botón base del design system con variantes y estado de carga. */
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  size?: 'sm' | 'md';
}

export function Button({ variant = 'primary', loading = false, size = 'md', disabled, children, className = '', ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading}
      {...rest}
    >
      {loading && <span className="spinner spinner-inline" aria-hidden="true" />}
      {children}
    </button>
  );
}
