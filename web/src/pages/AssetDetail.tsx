import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, type AssetDetail as AssetDetailData } from '../api';
import { useApp } from '../app-context';
import { TrendArea } from '../components/charts';
import { PageHeader } from '../components/Layout';
import { TxRow } from '../components/TxList';
import { Card, EmptyState, Money, Progress, Skeleton, StatCard } from '../components/ui';
import { CHART_COLORS, formatCrypto, formatDate, formatMoney, formatPercent } from '../format';
import { useApi } from '../hooks';
import { useI18n } from '../i18n';

export function AssetDetailPage() {
  const { symbol = '' } = useParams();
  const { t, locale } = useI18n();
  const { currency } = useApp();
  const asset = symbol.toUpperCase();
  const { data, loading, error } = useApi<AssetDetailData>(`/assets/${asset}`, [asset]);
  const [chart, setChart] = useState<Array<{ t: number; p: number }> | null>(null);

  useEffect(() => {
    setChart(null);
    api
      .get<{ points: Array<{ t: number; p: number }> }>(`/market/chart?asset=${asset}&days=90`)
      .then((response) => setChart(response.points))
      .catch(() => setChart([]));
  }, [asset]);

  const chartData = useMemo(
    () =>
      (chart ?? []).map((point) => ({
        label: new Date(point.t).toISOString().slice(5, 10),
        value: point.p,
      })),
    [chart],
  );

  if (loading) {
    return (
      <>
        <PageHeader title={asset} />
        <div className="page">
          <Skeleton height={400} />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title={asset} />
        <div className="page">
          <Card>
            <EmptyState title={t('asset.noData')} hint={t('dash.emptyHint')} />
          </Card>
        </div>
      </>
    );
  }

  const p = data.position;
  const totalLotAmount = p.openLots.reduce((sum, lot) => sum + lot.amount, 0);

  return (
    <>
      <PageHeader
        title={asset}
        subtitle={`${formatCrypto(p.amount, asset)} · ${formatMoney(p.value, currency)}`}
        actions={
          <Link className="btn ghost" to="/portfolio">
            <ArrowLeft size={15} /> {t('asset.back')}
          </Link>
        }
      />

      <div className="page">
        <div className="grid cols-4">
          <StatCard
            label={t('asset.holdings')}
            value={formatCrypto(p.amount, asset)}
            hint={`${formatMoney(p.price, currency)} · ${formatPercent(p.change24h)}`}
            tone={(p.change24h ?? 0) >= 0 ? 'positive' : 'negative'}
          />
          <StatCard
            label={t('pnl.invested')}
            value={formatMoney(p.costBasis, currency)}
            hint={`${t('pnl.avgCost')} ${formatMoney(p.avgCost, currency)}`}
          />
          <StatCard
            label={t('pnl.unrealized')}
            value={`${p.unrealized >= 0 ? '+' : ''}${formatMoney(p.unrealized, currency)}`}
            hint={formatPercent(p.unrealizedPercent)}
            tone={p.unrealized >= 0 ? 'positive' : 'negative'}
          />
          <StatCard
            label={t('pnl.realized')}
            value={`${p.realized >= 0 ? '+' : ''}${formatMoney(p.realized, currency)}`}
            hint={t('pnl.realizedHint')}
            tone={p.realized >= 0 ? 'positive' : 'negative'}
          />
        </div>

        <div className="grid split">
          <Card title={`${t('asset.priceChart')} · 90d`}>
            {chart === null ? (
              <Skeleton height={280} />
            ) : chartData.length === 0 ? (
              <EmptyState title={t('error.missing_price')} />
            ) : (
              <TrendArea data={chartData} height={280} />
            )}
          </Card>

          <Card title={t('pnl.lots')} action={<span className="hint">{t('pnl.lotsHint')}</span>}>
            {p.openLots.length === 0 ? (
              <EmptyState title={t('asset.noData')} />
            ) : (
              <div className="list">
                {p.openLots.map((lot, index) => {
                  const gain = (p.price - lot.costPerUnit) * lot.amount;
                  return (
                    <div className="list-item" key={`${lot.ts}-${index}`}>
                      <span
                        className="chip"
                        style={{
                          background: `${CHART_COLORS[index % CHART_COLORS.length]}22`,
                          color: CHART_COLORS[index % CHART_COLORS.length],
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {index + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="title" style={{ fontSize: 13 }}>
                          {formatCrypto(lot.amount, asset)}
                        </div>
                        <div className="meta">
                          {t('pnl.acquired')} {formatDate(lot.ts, locale)} ·{' '}
                          {formatMoney(lot.costPerUnit, currency)}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <Progress
                            value={totalLotAmount > 0 ? (lot.amount / totalLotAmount) * 100 : 0}
                            color={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        </div>
                      </div>
                      <Money className={`amount ${gain >= 0 ? 'pos' : 'neg'}`}>
                        {gain >= 0 ? '+' : ''}
                        {formatMoney(gain, currency)}
                      </Money>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="grid split-rev">
          <Card title={t('asset.inWallets')}>
            {data.wallets.length === 0 ? (
              <EmptyState title={t('portfolio.empty')} />
            ) : (
              <div className="list">
                {data.wallets.map((wallet) => (
                  <div className="list-item" key={wallet.label}>
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
                    <Money className="amount">
                      {formatCrypto(Number(wallet.amount), asset)}
                    </Money>
                  </div>
                ))}
              </div>
            )}
            <div className="hint" style={{ marginTop: 14 }}>
              {t('pnl.method')}
            </div>
          </Card>

          <Card title={t('asset.history')}>
            {data.transactions.length === 0 ? (
              <EmptyState title={t('asset.noData')} />
            ) : (
              <div className="list">
                {data.transactions.slice(0, 12).map((tx) => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
