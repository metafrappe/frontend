/**
 * `@ant-design/x` mock for unit tests.
 *
 * Why: Vitest loads this package in Node. The package imports the
 * `antd/es/version` folder and Node ESM rejects it. The permanent fix is
 * the `test.server.deps.inline` setting in `vite.config.ts`. That setting
 * belongs to the `foundation` task. The real package is tested in browser tests.
 */
import type { ReactNode } from 'react';

export function XProvider({ children }: { children: ReactNode }) {
  return children;
}

interface SenderProps {
  value?: string;
  placeholder?: string;
  className?: string;
  onChange?: (v: string) => void;
  onSubmit?: (v: string) => void;
}

export function Sender({ value, placeholder, className, onChange, onSubmit }: SenderProps) {
  return (
    <div className={className}>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit?.(value ?? '');
          }
        }}
      />
    </div>
  );
}

interface PromptsProps {
  items?: { key: string; label?: ReactNode }[];
  onItemClick?: (info: { data: { key: string; label?: ReactNode } }) => void;
}

export function Prompts({ items = [], onItemClick }: PromptsProps) {
  return (
    <div>
      {items.map((it) => (
        <button key={it.key} type="button" onClick={() => onItemClick?.({ data: it })}>
          {it.label}
        </button>
      ))}
    </div>
  );
}
