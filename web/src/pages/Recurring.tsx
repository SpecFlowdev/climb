import { CalendarClock, RotateCw } from 'lucide-react';
import type { Recurring } from '../api';
import { useApp } from '../app-context';
import { PageHeader } from '../components/Layout';
import { Card, EmptyState, Money, Skeleton, StatCard } from '../components/ui';
import { formatDateTime, formatMoney, shortAddress } from '../format';
import { useApi } from '../hooks';
import { useI18n } from '../i18n';

export function RecurringPage() {
  const { t, locale } = useI18n();
  const { currency } = useApp();
  const recurring = useApi<Recurring[]>('/planning/recurring');
  const list = recurring.data ?? [];
  const monthlyTotal = list.reduce((sum, item) => sum + item.monthlyEstimate, 0);

  return (
    <>
      <PageHeader title={t('recurring.title')} subtitle={t('recurring.subtitle')} />
      <div className="page">
        <div className="grid cols-3">
          <StatCard
            label={t('recurring.totalMonthly')}
            value={formatMoney(monthlyTotal, currency)}
            hint={t('recurring.totalMonthlyHint')}
          />
          <StatCard
            label={t('recurring.title')}
            value={String(list.length)}
            hint={t('recurring.detected')}
          />
          <StatCard
            label={t('recurring.next')}
            value={
              list.length > 0
                ? formatDateTime(
                    [...list].sort(
                      (a, b) =>
                        new Date(a.nextExpected).getTime() - new Date(b.nextExpected).getTime(),
                    )[0].nextExpected,
                    locale,
                  )
                : '—'
            }
            hint={list[0]?.counterparty ? shortAddress(list[0].counterparty, 14) : '—'}
          />
        </div>

        <Card className="pad-0">
          {recurring.loading ? (
            <div style={{ padding: 18 }}>
              <Skeleton height={220} />
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={<RotateCw size={26} />}
              title={t('recurring.empty')}
              hint={t('recurring.emptyHint')}
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('tx.counterparty')}</th>
                    <th>{t('common.category')}</th>
                    <th>{t('recurring.title')}</th>
                    <th>{t('recurring.next')}</th>
                    <th style={{ textAlign: 'right' }}>{t('common.amount')}</th>
                    <th style={{ textAlign: 'right' }}>{t('recurring.monthly')}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((item) => (
                    <tr key={`${item.counterparty}-${item.asset}`}>
                      <td>
                        <div className="row">
                          <span
                            className="chip"
                            style={{
                              background: `${item.categoryColor ?? 'var(--muted)'}22`,
                              color: item.categoryColor ?? 'var(--muted)',
                            }}
                          >
                            <CalendarClock size={15} />
                          </span>
                          <div>
                            <div style={{ fontWeight: 550 }}>
                              {shortAddress(item.counterparty, 18)}
                            </div>
                            <div className="meta dim" style={{ fontSize: 12 }}>
                              {item.asset} · {t('recurring.occurrences', { n: item.occurrences })}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="dim">{item.categoryName ?? '—'}</td>
                      <td>
                        <span className="badge">
                          {t('recurring.every', { n: item.intervalDays })}
                        </span>
                      </td>
                      <td className="dim">{formatDateTime(item.nextExpected, locale)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Money className="amount">
                          {formatMoney(item.averageValue, currency)}
                        </Money>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Money className="amount">
                          {formatMoney(item.monthlyEstimate, currency)}
                        </Money>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
