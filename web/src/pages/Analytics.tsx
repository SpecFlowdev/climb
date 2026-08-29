import { useMemo, useState } from 'react';
import type { AssetStat, CashflowPoint, CategoryStat, SummaryResponse } from '../api';
import { useApp } from '../app-context';
import { CashflowBars, Donut, NetLine } from '../components/charts';
import { PageHeader } from '../components/Layout';
import { PeriodPicker, type PeriodState } from '../components/PeriodPicker';
import { categoryLabel } from '../components/TxList';
import { Card, EmptyState, Money, Progress, Skeleton, StatCard } from '../components/ui';
import { CHART_COLORS, formatMoney } from '../format';
import { useApi } from '../hooks';
import { useI18n, type TranslationKey } from '../i18n';

export function AnalyticsPage() {
  const { t, locale } = useI18n();
  const { currency } = useApp();
  const now = new Date();
  const [period, setPeriod] = useState<PeriodState>({ year: now.getFullYear(), month: null });

  const suffix = `year=${period.year}&month=${period.month ?? 'all'}`;
  const cashflow = useApi<CashflowPoint[]>(`/stats/cashflow?year=${period.year}`, [period.year]);
  const income = useApi<CategoryStat[]>(`/stats/categories?direction=in&${suffix}`, [suffix]);
  const expense = useApi<CategoryStat[]>(`/stats/categories?direction=out&${suffix}`, [suffix]);
  const assets = useApi<AssetStat[]>(`/stats/assets?${suffix}`, [suffix]);
  const summary = useApi<SummaryResponse>(`/stats/summary?${suffix}`, [suffix]);

  const months = useMemo(
    () =>
      (cashflow.data ?? []).map((point) => ({
        label: t(`month.${point.month}` as TranslationKey),
        income: point.income,
        expense: point.expense,
        net: point.net,
      })),
    [cashflow.data, t],
  );

  const active = months.filter((month) => month.income || month.expense);
  const avgExpense = active.length
    ? active.reduce((sum, month) => sum + month.expense, 0) / active.length
    : 0;
  const best = active.reduce<typeof active[number] | null>(
    (top, month) => (!top || month.net > top.net ? month : top),
    null,
  );
  const worst = active.reduce<typeof active[number] | null>(
    (low, month) => (!low || month.net < low.net ? month : low),
    null,
  );

  const toSlices = (rows: CategoryStat[] | null) =>
    (rows ?? []).slice(0, 9).map((row, index) => ({
      name: categoryLabel(locale, row.name, row.name_ru),
      value: Number(row.total),
      color: row.color ?? CHART_COLORS[index % CHART_COLORS.length],
    }));

  const maxTurnover = Math.max(
    1,
    ...(assets.data ?? []).map((asset) => Number(asset.income) + Number(asset.expense)),
  );

  return (
    <>
      <PageHeader title={t('analytics.title')} subtitle={t('analytics.subtitle')} />
      <div className="page">
        <PeriodPicker value={period} onChange={setPeriod} />

        <div className="grid cols-4">
          <StatCard
            label={t('analytics.avgMonth')}
            value={formatMoney(avgExpense, currency)}
            hint={t('common.expense')}
          />
          <StatCard
            label={t('analytics.bestMonth')}
            value={best ? formatMoney(best.net, currency) : '—'}
            hint={best?.label ?? '—'}
            tone="positive"
          />
          <StatCard
            label={t('analytics.worstMonth')}
            value={worst ? formatMoney(worst.net, currency) : '—'}
            hint={worst?.label ?? '—'}
            tone="negative"
          />
          <StatCard
            label={t('analytics.txCount')}
            value={String(summary.data?.current.transactions ?? 0)}
            hint={t('dash.subtitle')}
          />
        </div>

        <Card title={t('analytics.cashflow')}>
          {cashflow.loading ? (
            <Skeleton height={280} />
          ) : (
            <CashflowBars
              data={months}
              incomeLabel={t('common.income')}
              expenseLabel={t('common.expense')}
            />
          )}
        </Card>

        <div className="grid split">
          <Card title={t('analytics.netFlow')}>
            <NetLine data={months} label={t('dash.balance')} />
          </Card>
          <Card title={t('analytics.byAsset')}>
            {(assets.data?.length ?? 0) === 0 ? (
              <EmptyState title={t('dash.empty')} hint={t('dash.emptyHint')} />
            ) : (
              <div className="list">
                {assets.data?.slice(0, 8).map((asset, index) => (
                  <div className="list-item" key={asset.asset}>
                    <div style={{ flex: 1 }}>
                      <div className="row between">
                        <strong>{asset.asset}</strong>
                        <span className="hint">{asset.count} tx</span>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <Progress
                          value={
                            ((Number(asset.income) + Number(asset.expense)) / maxTurnover) * 100
                          }
                          color={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                      <div>
                        <Money className="amount pos">
                          +{formatMoney(Number(asset.income), currency)}
                        </Money>
                      </div>
                      <div className="meta neg">
                        <Money>−{formatMoney(Number(asset.expense), currency)}</Money>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="grid cols-2">
          <Card title={t('analytics.incomeStructure')}>
            {toSlices(income.data).length === 0 ? (
              <EmptyState title={t('dash.empty')} />
            ) : (
              <Donut data={toSlices(income.data)} />
            )}
          </Card>
          <Card title={t('analytics.expenseStructure')}>
            {toSlices(expense.data).length === 0 ? (
              <EmptyState title={t('dash.empty')} />
            ) : (
              <Donut data={toSlices(expense.data)} />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
