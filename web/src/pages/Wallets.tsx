import { useState } from 'react';
import { AlertTriangle, ExternalLink, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { api, type Chain, type Wallet } from '../api';
import { useApp } from '../app-context';
import { PageHeader } from '../components/Layout';
import { Card, EmptyState, Field, Modal, Money, Skeleton } from '../components/ui';
import { CHART_COLORS, formatCrypto, relativeTime, shortAddress } from '../format';
import { useApi } from '../hooks';
import { useI18n, type TranslationKey } from '../i18n';

export function WalletsPage() {
  const { t, locale } = useI18n();
  const { toast } = useApp();
  const wallets = useApi<Wallet[]>('/wallets');
  const chains = useApi<Chain[]>('/wallets/chains');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<number | 'all' | null>(null);
  const [form, setForm] = useState({ label: '', chain: 'bitcoin', address: '', color: CHART_COLORS[0] });

  async function addWallet() {
    setBusy('all');
    try {
      await api.post('/wallets', form);
      toast(t('wallets.added'), 'success');
      setOpen(false);
      setForm({ label: '', chain: 'bitcoin', address: '', color: CHART_COLORS[0] });
      wallets.reload();
    } catch (error) {
      const code = (error as { code?: string }).code ?? 'generic';
      toast(t(`error.${code}` as TranslationKey), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function syncWallet(id: number) {
    setBusy(id);
    try {
      const result = await api.post<{ imported: number; error?: string }>(`/wallets/${id}/sync`);
      toast(result.error ?? `+${result.imported}`, result.error ? 'error' : 'success');
      wallets.reload();
    } finally {
      setBusy(null);
    }
  }

  async function removeWallet(id: number) {
    if (!window.confirm(t('wallets.confirmDelete'))) return;
    await api.del(`/wallets/${id}`);
    toast(t('wallets.deleted'), 'success');
    wallets.reload();
  }

  return (
    <>
      <PageHeader
        title={t('wallets.title')}
        subtitle={t('wallets.subtitle')}
        actions={
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> {t('wallets.add')}
          </button>
        }
      />
      <div className="page">
        <div className="card row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <span className="chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <ShieldCheck size={16} />
          </span>
          <div className="stat-hint" style={{ flex: 1 }}>
            {t('wallets.safety')}
          </div>
        </div>

        {wallets.loading ? (
          <div className="grid cols-3">
            <Skeleton height={160} />
            <Skeleton height={160} />
            <Skeleton height={160} />
          </div>
        ) : (wallets.data?.length ?? 0) === 0 ? (
          <Card>
            <EmptyState
              title={t('wallets.empty')}
              hint={t('wallets.emptyHint')}
              action={
                <button className="btn primary" onClick={() => setOpen(true)}>
                  <Plus size={15} /> {t('wallets.add')}
                </button>
              }
            />
          </Card>
        ) : (
          <div className="grid cols-3">
            {wallets.data?.map((wallet) => (
              <div className="card" key={wallet.id}>
                <div className="row between">
                  <div className="row">
                    <span
                      className="chip"
                      style={{ background: `${wallet.color}22`, color: wallet.color }}
                    >
                      {wallet.chainName.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{wallet.label}</div>
                      <div className="meta dim" style={{ fontSize: 12 }}>
                        {wallet.chainName}
                      </div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <button
                      className="btn ghost icon"
                      onClick={() => syncWallet(wallet.id)}
                      disabled={busy === wallet.id}
                      title={t('wallets.syncNow')}
                    >
                      <RefreshCw size={15} className={busy === wallet.id ? 'spin' : ''} />
                    </button>
                    {wallet.explorer && (
                      <a className="btn ghost icon" href={wallet.explorer} target="_blank" rel="noreferrer">
                        <ExternalLink size={15} />
                      </a>
                    )}
                    <button className="btn ghost icon" onClick={() => removeWallet(wallet.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="hint" style={{ margin: '14px 0 10px', fontFamily: 'monospace' }}>
                  {shortAddress(wallet.address, 10)}
                </div>

                <div className="list">
                  {wallet.balances.slice(0, 4).map((balance) => (
                    <div className="list-item" key={balance.asset} style={{ padding: '7px 0' }}>
                      <span style={{ flex: 1 }} className="dim">
                        {balance.asset}
                      </span>
                      <Money className="amount">
                        {formatCrypto(Number(balance.amount), balance.asset)}
                      </Money>
                    </div>
                  ))}
                </div>

                <div className="row between" style={{ marginTop: 12 }}>
                  <span className="hint">
                    {t('wallets.lastSync')}: {relativeTime(wallet.last_sync, locale)}
                  </span>
                  <span className="badge">{wallet.tx_count} tx</span>
                </div>

                {wallet.sync_error && (
                  <div className="row" style={{ marginTop: 10, color: 'var(--danger)', fontSize: 12 }}>
                    <AlertTriangle size={14} /> {wallet.sync_error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <Modal
          title={t('wallets.add')}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn primary"
                onClick={addWallet}
                disabled={busy === 'all' || !form.label || !form.address}
              >
                {busy === 'all' ? t('common.loading') : t('common.add')}
              </button>
            </>
          }
        >
          <Field label={t('wallets.label')}>
            <input
              className="input"
              value={form.label}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              placeholder="Main BTC vault"
            />
          </Field>
          <Field label={t('common.chain')}>
            <select
              className="select"
              value={form.chain}
              onChange={(event) => setForm({ ...form, chain: event.target.value })}
            >
              {chains.data?.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name} · {chain.nativeAsset}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('wallets.address')} hint={t('wallets.safety')}>
            <input
              className="input"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              placeholder="bc1q… / 0x… / T…"
              style={{ fontFamily: 'monospace' }}
            />
          </Field>
          <Field label={t('wallets.color')}>
            <div className="pill-row">
              {CHART_COLORS.map((color) => (
                <button
                  key={color}
                  className="btn icon"
                  onClick={() => setForm({ ...form, color })}
                  style={{
                    background: color,
                    borderColor: form.color === color ? 'var(--text)' : 'transparent',
                    width: 30,
                    height: 30,
                  }}
                  aria-label={color}
                />
              ))}
            </div>
          </Field>
        </Modal>
      )}
    </>
  );
}
