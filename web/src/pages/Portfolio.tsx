import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Coins } from 'lucide-react';
import type { AssetsResponse, Portfolio as PortfolioData } from '../api';
import { useApp } from '../app-context';
import { Donut, TrendArea } from '../components/charts';
import { PageHeader } from '../components/Layout';
import { Card, EmptyState, Money, Progress, Skeleton, StatCard } from '../components/ui';
import { CHART_COLORS, formatCrypto, formatMoney, formatPercent } from '../format';
import { useApi } from '../hooks';
import { useI18n } from '../i18n';

export function PortfolioPage() {
  const { t } = useI18n();
  const { currency, settings } = useApp();
  const { data, loading } = useApi<AssetsResponse>('/assets');
  const breakdown = useApi<PortfolioData>('/stats/portfolio');
  const networth = useApi<Array<{ date: string; value: number }>>('/stats/networth?days=180');

  const assets = useMemo(() => {
    const list = data?.assets ?? [];
    return settings.hideSmallBalances ? list.filter((asset) => asset.value >= 1) : list;
  }, [data, settings.hideSmallBalances]);

  const slices = assets.slice(0, 10).map((asset, index) => ({
    name: asset.asset,
    value: asset.value,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const trend = (networth.data ?? []).map((point) => ({
    label: point.date.slice(5),
    value: point.value,
  }));

  const totalPnl = (data?.unrealized ?? 0) + (data?.realized ?? 0);

  return (
    <>
      <PageHeader title={t('portfolio.title')} subtitle={t('portfolio.subtitle')} />
      <div className="page">
        <div className="grid cols-4">
          <StatCard
            label={t('portfolio.total')}
            value={formatMoney(data?.total ?? 0, currency)}
            hint={`${assets.length} ${t('portfolio.assets').toLowerCase()}`}
          />
          <StatCard
            label={t('pnl.invested')}
            value={formatMoney(data?.costBasis ?? 0, currency)}
            hint={t('pnl.investedHint')}
          />
          <StatCard
            label={t('pnl.unrealized')}
            value={`${(data?.unrealized ?? 0) >= 0 ? '+' : ''}${formatMoney(data?.unrealized ?? 0, currency)}`}
            hint={
              (data?.costBasis ?? 0) > 0
                ? formatPercent(((data?.unrealized ?? 0) / (data?.costBasis ?? 1)) * 100)
                : t('pnl.unrealizedHint')
            }
            tone={(data?.unrealized ?? 0) >= 0 ? 'positive' : 'negative'}
          />
          <StatCard
            label={t('pnl.realized')}
            value={`${(data?.realized ?? 0) >= 0 ? '+' : ''}${formatMoney(data?.realized ?? 0, currency)}`}
            hint={`${t('pnl.total')}: ${totalPnl >= 0 ? '+' : ''}${formatMoney(totalPnl, currency)}`}
            tone={(data?.realized ?? 0) >= 0 ? 'positive' : 'negative'}
          />
        </div>

        <div className="grid split">
          <Card title={t('dash.netWorth')}>
            {networth.loading ? <Skeleton height={280} /> : <TrendArea data={trend} height={280} />}
          </Card>
          <Card title={t('portfolio.allocation')}>
            {loading ? (
              <Skeleton height={260} />
            ) : slices.length === 0 ? (
              <EmptyState
                icon={<Coins size={26} />}
                title={t('portfolio.empty')}
                hint={t('portfolio.emptyHint')}
                action={
                  <Link className="btn primary" to="/wallets">
                    {t('wallets.add')}
                  </Link>
                }
              />
            ) : (
              <Donut
                data={slices}
                center={
                  <>
                    <div className="label">{t('portfolio.total')}</div>
                    <Money className="value">{formatMoney(data?.total ?? 0, currency)}</Money>
                  </>
                }
              />
            )}
          </Card>
        </div>

        <Card
          title={t('portfolio.holdings')}
          action={<span className="hint">{t('pnl.method')}</span>}
          className="pad-0"
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.asset')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.amount')}</th>
                  <th style={{ textAlign: 'right' }}>{t('pnl.avgCost')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.price')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.value')}</th>
                  <th style={{ textAlign: 'right' }}>{t('pnl.unrealized')}</th>
                  <th style={{ width: 150 }}>{t('common.share')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {assets.map((asset, index) => (
                  <tr key={asset.asset}>
                    <td>
                      <Link to={`/assets/${asset.asset}`} className="row asset-link">
                        <span
                          className="chip"
                          style={{
                            background: `${CHART_COLORS[index % CHART_COLORS.length]}22`,
                            color: CHART_COLORS[index % CHART_COLORS.length],
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {asset.asset.slice(0, 3)}
                        </span>
                        <strong>{asset.asset}</strong>
                      </Link>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Money>{formatCrypto(asset.amount, asset.asset)}</Money>
                    </td>
                    <td style={{ textAlign: 'right' }} className="dim">
                      {formatMoney(asset.avgCost, currency)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {formatMoney(asset.price, currency)}
                      <div className={`meta ${(asset.change24h ?? 0) >= 0 ? 'pos' : 'neg'}`}>
                        {formatPercent(asset.change24h)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Money className="amount">{formatMoney(asset.value, currency)}</Money>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Money className={`amount ${asset.unrealized >= 0 ? 'pos' : 'neg'}`}>
                        {asset.unrealized >= 0 ? '+' : ''}
                        {formatMoney(asset.unrealized, currency)}
                      </Money>
                      <div className={`meta ${asset.unrealized >= 0 ? 'pos' : 'neg'}`}>
                        {formatPercent(asset.unrealizedPercent)}
                      </div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <Progress
                            value={asset.share ?? 0}
                            color={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        </div>
                        <span className="dim">{(asset.share ?? 0).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>
                      <Link className="btn ghost icon" to={`/assets/${asset.asset}`}>
                        <ChevronRight size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid cols-2">
          <Card title={t('portfolio.byChain')}>
            <div className="list">
              {(breakdown.data?.chains ?? []).map((chain, index) => (
                <div className="list-item" key={chain.chain}>
                  <div style={{ flex: 1 }}>
                    <div className="title" style={{ textTransform: 'capitalize' }}>
                      {chain.chain}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <Progress
                        value={chain.share}
                        color={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    </div>
                  </div>
                  <Money className="amount">{formatMoney(chain.value, currency)}</Money>
                </div>
              ))}
            </div>
          </Card>
          <Card title={t('portfolio.byWallet')}>
            <div className="list">
              {(breakdown.data?.wallets ?? []).map((wallet) => (
                <div className="list-item" key={wallet.id}>
                  <span
                    className="chip"
                    style={{ background: `${wallet.color}22`, color: wallet.color }}
                  >
                    ●
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="title">{wallet.label}</div>
                    <div className="meta" style={{ textTransform: 'capitalize' }}>
                      {wallet.chain}
                    </div>
                  </div>
                  <Money className="amount">{formatMoney(wallet.value, currency)}</Money>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
