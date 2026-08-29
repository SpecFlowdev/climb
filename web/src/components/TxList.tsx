import { ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import type { Transaction } from '../api';
import { useApp } from '../app-context';
import { formatCrypto, formatDate, formatMoney, shortAddress } from '../format';
import { useI18n } from '../i18n';
import { Money } from './ui';

export function categoryLabel(
  locale: string,
  name: string | null,
  nameRu: string | null,
): string {
  if (locale === 'ru' && nameRu) return nameRu;
  return name ?? '—';
}

export function TxRow({ tx, onClick }: { tx: Transaction; onClick?: () => void }) {
  const { locale } = useI18n();
  const { currency } = useApp();
  const incoming = tx.direction === 'in';
  const color = tx.category_color ?? (incoming ? 'var(--accent)' : 'var(--danger)');

  return (
    <div className="list-item" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <span className="chip" style={{ background: `${color}22`, color }}>
        {incoming ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="title" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tx.note || categoryLabel(locale, tx.category_name, tx.category_name_ru)}
        </div>
        <div className="meta">
          {formatDate(tx.ts, locale)} · {tx.wallet_label ?? tx.chain} ·{' '}
          {shortAddress(tx.counterparty)}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <Money className={`amount ${incoming ? 'pos' : 'neg'}`}>
          {incoming ? '+' : '−'}
          {formatMoney(Math.abs(Number(tx.value_usd ?? 0)), currency)}
        </Money>
        <div className="meta">{formatCrypto(Number(tx.amount), tx.asset)}</div>
      </div>
      {tx.explorer && (
        <a
          className="btn ghost icon"
          href={tx.explorer}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}
