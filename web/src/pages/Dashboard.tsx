import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, RefreshCw, Wallet } from 'lucide-react';
import {
  api,
  type AssetsResponse,
  type Budget,
  type CategoryStat,
  type Goal,
  type SummaryResponse,
  type Transaction,
} from '../api';
import { useApp } from '../app-context';
import { Donut, TrendArea } from '../components/charts';
import { PageHeader } from '../components/Layout';
import { PeriodPicker, type PeriodState } from '../components/PeriodPicker';
import { categoryLabel, TxRow } from '../components/TxList';
import { Card, EmptyState, Money, Progress, Skeleton, StatCard, Trend } from '../components/ui';
import { CHART_COLORS, formatMoney, formatPercent } from '../format';
import { useApi } from '../hooks';
import { useI18n } from '../i18n';

export function Dashboard() {
  const { t, locale } = useI18n();
  const { currency, toast } = useApp();
  const now = new Date();
  const [period, setPeriod] = useState<PeriodState>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [syncing, setSyncing] = useState(false);

  const suffix = `year=${period.year}&month=${period.month ?? 'all'}`;
  const summary = useApi<SummaryResponse>(`/stats/summary?${suffix}`, [suffix]);
  const categories = useApi<CategoryStat[]>(`/stats/categories?direction=out&${suffix}`, [suffix]);
  const recent = useApi<{ items: Transaction[] }>('/transactions?limit=7&includeInternal=false');
  const networth = useApi<Array<{ date: string; value: number }>>('/stats/networth?days=90');
  const portfolio = useApi<AssetsResponse>('/assets');
  const budgets = useApi<Budget[]>(`/planning/budgets?year=${period.year}&month=${period.month ?? 1}`, [
    period.year,
    period.month,
  ]);
  const goals = useApi<Goal[]>('/planning/goals');

  const current = summary.data?.current;
  const previous = summary.data?.previous;

  const delta = (a?: number, b?: number) => {
    if (!a || !b) return 0;
    return ((a - b) / Math.abs(b)) * 100;
  };

  const slices = useMemo(
    () =>
      (categories.data ?? []).slice(0, 9).map((row, index) => ({
        name: categoryLabel(locale, row.name, row.name_ru),
        value: Number(row.total),
        color: row.color ?? CHART_COLORS[index % CHART_COLORS.length],
      })),
    [categories.data, locale],
  );

  const totalExpense = slices.reduce((sum, slice) => sum + slice.value, 0);

  const trend = useMemo(
    () =>
      (networth.data ?? []).map((point) => ({
        label: point.date.slice(5),
        value: point.value,
      })),
    [networth.data],
  );

  async function syncAll() {
    setSyncing(true);
    try {
      await api.post('/wallets/sync');
      toast(t('common.sync'), 'success');
      summary.reload();
      categories.reload();
      recent.reload();
      portfolio.reload();
      networth.reload();
    } catch {
      toast(t('error.generic'), 'error');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('dash.title')}
        subtitle={t('dash.subtitle')}
        actions={
          <button className="btn" onClick={syncAll} disabled={syncing}>
            <RefreshCw size={15} className={syncing ? 'spin' : ''} />
            {syncing ? t('common.syncing') : t('common.sync')}
          </button>
        }
      />

      <div className="page">
        <PeriodPicker value={period} onChange={setPeriod} />

        <div className="grid cols-4">
          <StatCard
            label={t('dash.income')}
            value={formatMoney(current?.income ?? 0, currency)}
            hint={t('dash.incomeHint')}
            tone="positive"
            trend={<Trend value={delta(current?.income, previous?.income)} />}
          />
          <StatCard
            label={t('dash.expense')}
            value={formatMoney(current?.expense ?? 0, currency)}
            hint={t('dash.expenseHint')}
            tone="negative"
            trend={<Trend value={delta(current?.expense, previous?.expense)} />}
          />
          <StatCard
            label={t('dash.balance')}
            value={`${(current?.net ?? 0) >= 0 ? '+' : ''}${formatMoney(current?.net ?? 0, currency)}`}
            hint={t('dash.balanceHint')}
            tone={(current?.net ?? 0) >= 0 ? 'positive' : 'negative'}
          />
          <StatCard
            label={t('dash.savings')}
            value={formatPercent(current?.savingsRate ?? 0, 0)}
            hint={t('dash.savingsHint')}
            tone={(current?.savingsRate ?? 0) >= 0 ? 'positive' : 'negative'}
          />
        </div>

        <div className="grid split">
          <Card title={t('dash.byCategory')}>
            {categories.loading ? (
              <Skeleton height={260} />
            ) : slices.length === 0 ? (
              <EmptyState title={t('dash.empty')} hint={t('dash.emptyHint')} />
            ) : (
              <div className="grid cols-2" style={{ alignItems: 'center' }}>
                <Donut
                  data={slices}
                  center={
                    <>
                      <div className="label">{t('common.total')}</div>
                      <Money className="value">{formatMoney(totalExpense, currency)}</Money>
                    </>
                  }
                />
                <div className="list">
                  {slices.map((slice) => (
                    <div className="list-item" key={slice.name}>
                      <span
                        className="chip"
                        style={{ background: `${slice.color}22`, color: slice.color, width: 28, height: 28 }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: slice.color,
                            display: 'block',
                          }}
                        />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="title" style={{ fontSize: 13 }}>
                          {slice.name}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <Progress
                            value={totalExpense ? (slice.value / totalExpense) * 100 : 0}
                            color={slice.color}
                          />
                        </div>
                      </div>
                      <Money className="amount">{formatMoney(slice.value, currency)}</Money>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card
            title={t('dash.recent')}
            action={
              <Link className="btn ghost" to="/transactions">
                {t('dash.allTx')}
              </Link>
            }
          >
            {recent.loading ? (
              <Skeleton height={260} />
            ) : (recent.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                icon={<Wallet size={26} />}
                title={t('dash.empty')}
                hint={t('dash.emptyHint')}
                action={
                  <Link className="btn primary" to="/wallets">
                    {t('wallets.add')}
                  </Link>
                }
              />
            ) : (
              <div className="list">
                {recent.data?.items.map((tx) => <TxRow key={tx.id} tx={tx} />)}
              </div>
            )}
          </Card>
        </div>

        <div className="grid split-rev">
          <Card title={t('dash.topAssets')}>
            {(portfolio.data?.assets.length ?? 0) === 0 ? (
              <EmptyState title={t('portfolio.empty')} hint={t('portfolio.emptyHint')} />
            ) : (
              <div className="list">
                {portfolio.data?.assets.slice(0, 6).map((asset) => (
                  <Link className="list-item" key={asset.asset} to={`/assets/${asset.asset}`}>
                    <span className="chip" style={{ background: 'var(--panel-3)' }}>
                      {asset.asset.slice(0, 3)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div className="title">{asset.asset}</div>
                      <div className="meta">{(asset.share ?? 0).toFixed(1)}%</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <Money className="amount">{formatMoney(asset.value, currency)}</Money>
                      <div className={`meta ${asset.unrealized >= 0 ? 'pos' : 'neg'}`}>
                        {asset.unrealized >= 0 ? '+' : ''}
                        {formatMoney(asset.unrealized, currency)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card title={t('dash.netWorth')}>
            {networth.loading ? <Skeleton height={240} /> : <TrendArea data={trend} />}
          </Card>
        </div>

        <div className="grid split">
          <Card
            title={t('budget.title')}
            action={
              <Link className="btn ghost" to="/budgets">
                {t('common.all')}
              </Link>
            }
          >
            {(budgets.data?.length ?? 0) === 0 ? (
              <EmptyState
                title={t('budget.empty')}
                hint={t('budget.emptyHint')}
                action={
                  <Link className="btn primary" to="/budgets">
                    {t('budget.add')}
                  </Link>
                }
              />
            ) : (
              <div className="list">
                {budgets.data?.slice(0, 5).map((budget) => (
                  <div className="list-item" key={budget.id}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row between">
                        <span className="title" style={{ fontSize: 13 }}>
                          {categoryLabel(locale, budget.categoryName, budget.categoryNameRu)}
                        </span>
                        <span className="hint">
                          <Money>{formatMoney(budget.spent, currency)}</Money> /{' '}
                          <Money>{formatMoney(budget.amount, currency)}</Money>
                        </span>
                      </div>
                      <div style={{ marginTop: 7 }}>
                        <Progress
                          value={budget.usedPercent}
                          color={
                            budget.status === 'over'
                              ? 'var(--danger)'
                              : budget.status === 'warning'
                                ? 'var(--warn)'
                                : 'var(--accent)'
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title={t('goal.title')}
            action={
              <Link className="btn ghost" to="/goals">
                {t('common.all')}
              </Link>
            }
          >
            {(goals.data?.length ?? 0) === 0 ? (
              <EmptyState
                title={t('goal.empty')}
                hint={t('goal.emptyHint')}
                action={
                  <Link className="btn primary" to="/goals">
                    {t('goal.add')}
                  </Link>
                }
              />
            ) : (
              <div className="list">
                {goals.data?.slice(0, 4).map((goal) => (
                  <div className="list-item" key={goal.id}>
                    <span
                      className="chip"
                      style={{ background: `${goal.color}22`, color: goal.color }}
                    >
                      <Flag size={15} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row between">
                        <span className="title" style={{ fontSize: 13 }}>
                          {goal.title}
                        </span>
                        <span className="hint">{goal.progressPercent.toFixed(0)}%</span>
                      </div>
                      <div style={{ marginTop: 7 }}>
                        <Progress value={goal.progressPercent} color={goal.color} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
