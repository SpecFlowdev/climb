import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '../app-context';

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-title">
          <h3>{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Money({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { privacy } = useApp();
  return <span className={`${className} ${privacy ? 'blurred' : ''}`.trim()}>{children}</span>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'positive' | 'negative';
  trend?: ReactNode;
}) {
  const toneClass = tone === 'positive' ? 'pos' : tone === 'negative' ? 'neg' : '';
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${toneClass}`}>
        <Money>{value}</Money>
      </div>
      <div className="row between">
        <span className="stat-hint">{hint}</span>
        {trend}
      </div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="close">
            <X size={16} />
          </button>
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon}
      <h4>{title}</h4>
      {hint && <span>{hint}</span>}
      {action}
    </div>
  );
}

export function Skeleton({ height = 120 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} />;
}

export function Toasts() {
  const { toasts } = useApp();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-host">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export function Progress({ value, color }: { value: number; color: string }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, background: color }} />
    </div>
  );
}

export function Trend({ value }: { value: number }) {
  const tone = value > 0 ? 'green' : value < 0 ? 'red' : '';
  return (
    <span className={`badge ${tone}`}>
      {value > 0 ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}
