import { useState } from 'react';
import { Database, Globe, Palette, ShieldAlert } from 'lucide-react';
import { api, type Status } from '../api';
import { useApp } from '../app-context';
import { PageHeader } from '../components/Layout';
import { Card, Field, Modal } from '../components/ui';
import { relativeTime } from '../format';
import { useApi } from '../hooks';
import { LOCALES, useI18n, type LocaleCode } from '../i18n';

export function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { settings, update, toast } = useApp();
  const status = useApi<Status>('/settings/status');
  const [wiping, setWiping] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  async function wipe() {
    await api.post('/settings/wipe', { confirm: 'DELETE' });
    setWiping(false);
    setConfirmText('');
    toast(t('settings.wiped'), 'success');
    status.reload();
  }

  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="page">
        <div className="grid cols-2">
          <Card
            title={
              <span className="row" style={{ gap: 8 }}>
                <Palette size={14} /> {t('settings.appearance')}
              </span>
            }
          >
            <div className="grid" style={{ gap: 14 }}>
              <Field label={t('settings.theme')}>
                <div className="pill-row">
                  {(['dark', 'light'] as const).map((theme) => (
                    <button
                      key={theme}
                      className={`pill ${settings.theme === theme ? 'active' : ''}`}
                      onClick={() => update({ theme })}
                    >
                      {theme === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={t('settings.language')}>
                <div className="pill-row">
                  {(Object.keys(LOCALES) as LocaleCode[]).map((code) => (
                    <button
                      key={code}
                      className={`pill ${locale === code ? 'active' : ''}`}
                      onClick={() => setLocale(code)}
                    >
                      {LOCALES[code].flag} {LOCALES[code].name}
                    </button>
                  ))}
                </div>
              </Field>

              <label className="row between" style={{ cursor: 'pointer' }}>
                <span>
                  <div>{t('settings.privacy')}</div>
                  <div className="hint">{t('settings.privacyHint')}</div>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.privacyMode)}
                  onChange={(event) => update({ privacyMode: event.target.checked })}
                />
              </label>

              <label className="row between" style={{ cursor: 'pointer' }}>
                <span>
                  <div>{t('settings.hideSmall')}</div>
                  <div className="hint">{t('settings.hideSmallHint')}</div>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.hideSmallBalances)}
                  onChange={(event) => update({ hideSmallBalances: event.target.checked })}
                />
              </label>
            </div>
          </Card>

          <Card
            title={
              <span className="row" style={{ gap: 8 }}>
                <Database size={14} /> {t('settings.status')}
              </span>
            }
          >
            <div className="list">
              <div className="list-item">
                <span style={{ flex: 1 }} className="dim">
                  {t('settings.version')}
                </span>
                <strong>{status.data?.version ?? '—'}</strong>
              </div>
              <div className="list-item">
                <span style={{ flex: 1 }} className="dim">
                  {t('nav.wallets')}
                </span>
                <strong>{status.data?.wallets ?? 0}</strong>
              </div>
              <div className="list-item">
                <span style={{ flex: 1 }} className="dim">
                  {t('nav.transactions')}
                </span>
                <strong>{status.data?.transactions ?? 0}</strong>
              </div>
              <div className="list-item">
                <span style={{ flex: 1 }} className="dim">
                  {t('wallets.lastSync')}
                </span>
                <strong>{relativeTime(status.data?.lastSync ?? null, locale)}</strong>
              </div>
              <div className="list-item">
                <span style={{ flex: 1 }} className="dim">
                  {t('settings.syncInterval')}
                </span>
                <strong>
                  {t('settings.minutes', { n: status.data?.syncIntervalMinutes ?? 0 })}
                </strong>
              </div>
              <div className="list-item">
                <span style={{ flex: 1 }} className="dim">
                  {t('common.value')}
                </span>
                <strong>{(status.data?.baseCurrency ?? 'usd').toUpperCase()}</strong>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid cols-2">
          <Card
            title={
              <span className="row" style={{ gap: 8 }}>
                <Globe size={14} /> {t('settings.about')}
              </span>
            }
          >
            <p className="stat-hint" style={{ margin: 0 }}>
              {t('settings.aboutText')}
            </p>
          </Card>

          <Card
            title={
              <span className="row" style={{ gap: 8 }}>
                <ShieldAlert size={14} /> {t('settings.data')}
              </span>
            }
          >
            <p className="stat-hint" style={{ marginTop: 0 }}>
              {t('settings.wipeHint')}
            </p>
            <button className="btn danger" onClick={() => setWiping(true)}>
              {t('settings.wipe')}
            </button>
          </Card>
        </div>
      </div>

      {wiping && (
        <Modal
          title={t('settings.wipe')}
          onClose={() => setWiping(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setWiping(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn danger" onClick={wipe} disabled={confirmText !== 'DELETE'}>
                {t('common.confirm')}
              </button>
            </>
          }
        >
          <Field label={t('settings.wipeConfirm')}>
            <input
              className="input"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="DELETE"
            />
          </Field>
        </Modal>
      )}
    </>
  );
}
