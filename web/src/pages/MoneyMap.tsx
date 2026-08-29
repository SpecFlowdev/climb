import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network } from 'lucide-react';
import type { MoneyMap as MoneyMapData } from '../api';
import { useApp } from '../app-context';
import { PageHeader } from '../components/Layout';
import { MoneyMapChart } from '../components/MoneyMapChart';
import { PeriodPicker, type PeriodState } from '../components/PeriodPicker';
import { categoryLabel } from '../components/TxList';
import { Card, EmptyState, Money, Progress, Skeleton, StatCard } from '../components/ui';
import { formatMoney } from '../format';
import { useApi } from '../hooks';
import { useI18n } from '../i18n';

export function MoneyMapPage() {
  const { t, locale } = useI18n();
  const { currency } = useApp();
  const navigate = useNavigate();
  const now = new Date();
  const [period, setPeriod] = useState<PeriodState>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [direction, setDirection] = useState<'out' | 'in'>('out');

  const suffix = `year=${period.year}&month=${period.month ?? 'all'}&direction=${direction}`;
  const { data, loading } = useApi<MoneyMapData>(`/stats/map?${suffix}`, [suffix]);

  const labelFor = useMemo(
    () => (branch: MoneyMapData['branches'][number]) =>
      categoryLabel(locale, branch.label, branch.labelRu),
    [locale],
  );

  const format = (value: number) => formatMoney(value, currency);
  const biggest = data?.branches[0];
  const flows = (data?.branches ?? []).reduce(
    (sum, branch) => sum + branch.children.length,
    0,
  );

  return (
    <>
      <PageHeader
        title={t('map.title')}
        subtitle={t('map.subtitle')}
        actions={
          <div className="pill-row">
            <button
              className={`pill ${direction === 'out' ? 'active' : ''}`}
              onClick={() => setDirection('out')}
            >
              {t('common.expense')}
            </button>
            <button
              className={`pill ${direction === 'in' ? 'active' : ''}`}
              onClick={() => setDirection('in')}
            >
              {t('common.income')}
            </button>
          </div>
        }
      />

      <div className="page">
        <PeriodPicker value={period} onChange={setPeriod} />

        <div className="grid cols-4">
          <StatCard
            label={direction === 'out' ? t('map.spent') : t('map.earned')}
            value={format(data?.total ?? 0)}
            hint={`${data?.transactions ?? 0} ${t('analytics.txCount').toLowerCase()}`}
            tone={direction === 'out' ? 'negative' : 'positive'}
          />
          <StatCard
            label={t('map.branches')}
            value={String(data?.branches.length ?? 0)}
            hint={t('map.legend')}
          />
          <StatCard label={t('map.flows')} value={String(flows)} hint={t('map.hint')} />
          <StatCard
            label={t('map.biggest')}
            value={biggest ? format(biggest.value) : '—'}
            hint={biggest ? `${labelFor(biggest)} · ${biggest.share.toFixed(0)}% ${t('map.of')}` : '—'}
          />
        </div>

        <div className="grid split">
          <Card title={t('map.title')} action={<span className="hint">{t('map.hint')}</span>}>
            {loading ? (
              <Skeleton height={520} />
            ) : (data?.branches.length ?? 0) === 0 ? (
              <EmptyState
                icon={<Network size={26} />}
                title={t('map.empty')}
                hint={t('map.emptyHint')}
              />
            ) : (
              <MoneyMapChart
                data={data!}
                labelFor={labelFor}
                formatValue={format}
                centerLabel={direction === 'out' ? t('map.spent') : t('map.earned')}
                onSelectBranch={(branch) => {
                  const params = new URLSearchParams({ direction });
                  if (branch.categoryId) params.set('categoryId', String(branch.categoryId));
                  navigate(`/transactions?${params.toString()}`);
                }}
                onSelectLeaf={(leaf) =>
                  navigate(`/transactions?search=${encodeURIComponent(leaf.label)}`)
                }
              />
            )}
          </Card>

          <Card title={t('map.legend')}>
            {loading ? (
              <Skeleton height={420} />
            ) : (
              <div className="list">
                {data?.branches.map((branch) => (
                  <div className="list-item" key={branch.id}>
                    <span
                      className="chip"
                      style={{ background: `${branch.color}22`, color: branch.color }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: branch.color,
                          display: 'block',
                        }}
                      />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row between">
                        <span className="title" style={{ fontSize: 13 }}>
                          {labelFor(branch)}
                        </span>
                        <Money className="amount">{format(branch.value)}</Money>
                      </div>
                      <div style={{ margin: '7px 0 5px' }}>
                        <Progress value={branch.share} color={branch.color} />
                      </div>
                      <div className="meta">
                        {branch.share.toFixed(1)}% · {branch.count} tx ·{' '}
                        {branch.children
                          .slice(0, 2)
                          .map((leaf) => leaf.label)
                          .join(', ')}
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
