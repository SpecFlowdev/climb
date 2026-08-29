import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, ExternalLink, Plus, Search, Trash2 } from 'lucide-react';
import { api, type Category, type Transaction, type Wallet } from '../api';
import { useApp } from '../app-context';
import { PageHeader } from '../components/Layout';
import { categoryLabel } from '../components/TxList';
import { Card, EmptyState, Field, Modal, Money, Skeleton } from '../components/ui';
import { formatCrypto, formatDate, formatMoney, shortAddress } from '../format';
import { useApi } from '../hooks';
import { useI18n } from '../i18n';

const PAGE_SIZE = 50;

export function TransactionsPage() {
  const { t, locale } = useI18n();
  const { currency, toast } = useApp();
  // The money map links here with a category or counterparty already chosen.
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: searchParams.get('search') ?? '',
    direction: searchParams.get('direction') ?? '',
    walletId: searchParams.get('walletId') ?? '',
    categoryId: searchParams.get('categoryId') ?? '',
    asset: searchParams.get('asset') ?? '',
    hideInternal: true,
  });
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);

  const wallets = useApi<Wallet[]>('/wallets');
  const categories = useApi<Category[]>('/categories');

  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      includeInternal: filters.hideInternal ? 'false' : 'true',
    });
    if (filters.search) params.set('search', filters.search);
    if (filters.direction) params.set('direction', filters.direction);
    if (filters.walletId) params.set('walletId', filters.walletId);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.asset) params.set('asset', filters.asset);
    return params.toString();
  }, [filters, page]);

  const txs = useApi<{ total: number; items: Transaction[] }>(`/transactions?${queryString}`, [
    queryString,
  ]);

  async function setCategory(tx: Transaction, categoryId: number | null) {
    await api.patch(`/transactions/${tx.id}`, { categoryId });
    toast(t('tx.saved'), 'success');
    txs.reload();
  }

  async function removeTx(id: number) {
    await api.del(`/transactions/${id}`);
    toast(t('tx.deleted'), 'success');
    txs.reload();
  }

  const pages = Math.ceil((txs.data?.total ?? 0) / PAGE_SIZE);

  return (
    <>
      <PageHeader
        title={t('tx.title')}
        subtitle={t('tx.subtitle')}
        actions={
          <>
            <a className="btn" href="/api/transactions/export.csv">
              <Download size={15} /> {t('common.export')}
            </a>
            <button className="btn primary" onClick={() => setAdding(true)}>
              <Plus size={15} /> {t('tx.add')}
            </button>
          </>
        }
      />

      <div className="page">
        <Card title={t('tx.filters')}>
          <div className="grid cols-4" style={{ gap: 12 }}>
            <div className="field">
              <label>{t('common.search')}</label>
              <div className="row" style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 11, color: 'var(--muted)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 34 }}
                  placeholder={t('tx.searchPlaceholder')}
                  value={filters.search}
                  onChange={(event) => {
                    setPage(0);
                    setFilters({ ...filters, search: event.target.value });
                  }}
                />
              </div>
            </div>
            <Field label={t('common.wallet')}>
              <select
                className="select"
                value={filters.walletId}
                onChange={(event) => {
                  setPage(0);
                  setFilters({ ...filters, walletId: event.target.value });
                }}
              >
                <option value="">{t('common.all')}</option>
                {wallets.data?.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('common.category')}>
              <select
                className="select"
                value={filters.categoryId}
                onChange={(event) => {
                  setPage(0);
                  setFilters({ ...filters, categoryId: event.target.value });
                }}
              >
                <option value="">{t('common.all')}</option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryLabel(locale, category.name, category.name_ru)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('common.in') + ' / ' + t('common.out')}>
              <select
                className="select"
                value={filters.direction}
                onChange={(event) => {
                  setPage(0);
                  setFilters({ ...filters, direction: event.target.value });
                }}
              >
                <option value="">{t('common.all')}</option>
                <option value="in">{t('common.in')}</option>
                <option value="out">{t('common.out')}</option>
              </select>
            </Field>
          </div>
          <label className="row" style={{ marginTop: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filters.hideInternal}
              onChange={(event) => setFilters({ ...filters, hideInternal: event.target.checked })}
            />
            <span className="hint">{t('tx.hideInternal')}</span>
          </label>
        </Card>

        <Card className="pad-0">
          {txs.loading ? (
            <div style={{ padding: 18 }}>
              <Skeleton height={320} />
            </div>
          ) : (txs.data?.items.length ?? 0) === 0 ? (
            <EmptyState title={t('tx.empty')} hint={t('tx.emptyHint')} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('tx.counterparty')}</th>
                    <th>{t('common.wallet')}</th>
                    <th>{t('common.category')}</th>
                    <th style={{ textAlign: 'right' }}>{t('common.amount')}</th>
                    <th style={{ textAlign: 'right' }}>{t('common.value')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {txs.data?.items.map((tx) => (
                    <tr key={tx.id}>
                      <td className="dim">{formatDate(tx.ts, locale, true)}</td>
                      <td>
                        <div style={{ fontWeight: 550 }}>
                          {tx.note || shortAddress(tx.counterparty, 8)}
                        </div>
                        <div className="meta dim" style={{ fontSize: 12, textTransform: 'capitalize' }}>
                          {tx.chain}
                          {tx.internal ? ` · ${t('tx.internal')}` : ''}
                        </div>
                      </td>
                      <td className="dim">{tx.wallet_label ?? '—'}</td>
                      <td>
                        <select
                          className="select"
                          style={{ padding: '6px 8px', minWidth: 150 }}
                          value={tx.category_id ?? ''}
                          onChange={(event) =>
                            setCategory(tx, event.target.value ? Number(event.target.value) : null)
                          }
                        >
                          <option value="">{t('common.none')}</option>
                          {categories.data?.map((category) => (
                            <option key={category.id} value={category.id}>
                              {categoryLabel(locale, category.name, category.name_ru)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Money className={`amount ${tx.direction === 'in' ? 'pos' : 'neg'}`}>
                          {tx.direction === 'in' ? '+' : '−'}
                          {formatCrypto(Number(tx.amount), tx.asset)}
                        </Money>
                        {Number(tx.fee) > 0 && (
                          <div className="meta dim" style={{ fontSize: 11 }}>
                            {t('tx.fee')}: {formatCrypto(Number(tx.fee), tx.asset)}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Money className="amount">
                          {formatMoney(Number(tx.value_usd ?? 0), currency)}
                        </Money>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                          {tx.explorer && (
                            <a className="btn ghost icon" href={tx.explorer} target="_blank" rel="noreferrer">
                              <ExternalLink size={14} />
                            </a>
                          )}
                          <button className="btn ghost icon" onClick={() => removeTx(tx.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {pages > 1 && (
          <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
            <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
              ←
            </button>
            <span className="hint">
              {page + 1} / {pages}
            </span>
            <button className="btn" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
              →
            </button>
          </div>
        )}
      </div>

      {adding && (
        <AddTransactionModal
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            txs.reload();
            toast(t('tx.saved'), 'success');
          }}
        />
      )}
    </>
  );
}

function AddTransactionModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useI18n();
  const wallets = useApi<Wallet[]>('/wallets');
  const categories = useApi<Category[]>('/categories');
  const [form, setForm] = useState({
    walletId: '',
    direction: 'out' as 'in' | 'out',
    asset: 'USDT',
    amount: '',
    ts: new Date().toISOString().slice(0, 10),
    counterparty: '',
    note: '',
    categoryId: '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.post('/transactions', {
        walletId: form.walletId ? Number(form.walletId) : null,
        chain: 'manual',
        ts: new Date(form.ts).toISOString(),
        direction: form.direction,
        asset: form.asset,
        amount: Number(form.amount),
        fee: 0,
        counterparty: form.counterparty || undefined,
        note: form.note || undefined,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t('tx.add')}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn primary" onClick={save} disabled={saving || !form.amount}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <div className="grid cols-2" style={{ gap: 12 }}>
        <Field label={t('common.date')}>
          <input
            className="input"
            type="date"
            value={form.ts}
            onChange={(event) => setForm({ ...form, ts: event.target.value })}
          />
        </Field>
        <Field label={t('common.in') + ' / ' + t('common.out')}>
          <select
            className="select"
            value={form.direction}
            onChange={(event) =>
              setForm({ ...form, direction: event.target.value as 'in' | 'out' })
            }
          >
            <option value="in">{t('common.in')}</option>
            <option value="out">{t('common.out')}</option>
          </select>
        </Field>
        <Field label={t('common.asset')}>
          <input
            className="input"
            value={form.asset}
            onChange={(event) => setForm({ ...form, asset: event.target.value.toUpperCase() })}
          />
        </Field>
        <Field label={t('common.amount')}>
          <input
            className="input"
            type="number"
            step="any"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
          />
        </Field>
        <Field label={t('common.wallet')}>
          <select
            className="select"
            value={form.walletId}
            onChange={(event) => setForm({ ...form, walletId: event.target.value })}
          >
            <option value="">{t('common.none')}</option>
            {wallets.data?.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('common.category')}>
          <select
            className="select"
            value={form.categoryId}
            onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
          >
            <option value="">{t('common.none')}</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryLabel(locale, category.name, category.name_ru)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t('tx.counterparty')} hint={t('common.optional')}>
        <input
          className="input"
          value={form.counterparty}
          onChange={(event) => setForm({ ...form, counterparty: event.target.value })}
        />
      </Field>
      <Field label={t('common.note')} hint={t('common.optional')}>
        <input
          className="input"
          value={form.note}
          onChange={(event) => setForm({ ...form, note: event.target.value })}
        />
      </Field>
    </Modal>
  );
}
