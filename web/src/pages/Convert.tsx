import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../app-context';
import { TrendArea } from '../components/charts';
import { PageHeader } from '../components/Layout';
import { Card, Field, Money, Skeleton } from '../components/ui';
import { formatCrypto, formatMoney } from '../format';
import { useI18n } from '../i18n';

const ASSETS = ['BTC', 'ETH', 'SOL', 'TRX', 'POL', 'USDT', 'USDC', 'DAI', 'LINK', 'ARB', 'OP', 'TON'];
const RANGES = [7, 30, 90, 365];

interface ConvertResponse {
  rate: number;
  result: number;
  fromPrice: number;
  toPrice: number;
}

export function ConvertPage() {
  const { t } = useI18n();
  const { currency } = useApp();
  const [from, setFrom] = useState('BTC');
  const [to, setTo] = useState('USDT');
  const [amount, setAmount] = useState('1');
  const [days, setDays] = useState(30);
  const [result, setResult] = useState<ConvertResponse | null>(null);
  const [chart, setChart] = useState<Array<{ t: number; p: number }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setError(null);
    api
      .get<ConvertResponse>(`/market/convert?from=${from}&to=${to}&amount=${value}`)
      .then(setResult)
      .catch(() => setError(t('error.missing_price')));
  }, [from, to, amount, t]);

  useEffect(() => {
    setChart(null);
    api
      .get<{ points: Array<{ t: number; p: number }> }>(`/market/chart?asset=${from}&days=${days}`)
      .then((data) => setChart(data.points))
      .catch(() => setChart([]));
  }, [from, days]);

  const chartData = useMemo(
    () =>
      (chart ?? []).map((point) => ({
        label: new Date(point.t).toISOString().slice(5, 10),
        value: point.p,
      })),
    [chart],
  );

  return (
    <>
      <PageHeader title={t('convert.title')} subtitle={t('convert.subtitle')} />
      <div className="page">
        <div className="grid split-rev">
          <Card title={t('convert.title')}>
            <div className="grid" style={{ gap: 14 }}>
              <Field label={t('convert.from')}>
                <div className="row">
                  <input
                    className="input"
                    type="number"
                    step="any"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <select
                    className="select"
                    style={{ width: 130 }}
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                  >
                    {ASSETS.map((asset) => (
                      <option key={asset}>{asset}</option>
                    ))}
                  </select>
                </div>
              </Field>

              <button
                className="btn"
                style={{ justifySelf: 'center' }}
                onClick={() => {
                  setFrom(to);
                  setTo(from);
                }}
              >
                <ArrowLeftRight size={15} /> {t('convert.swap')}
              </button>

              <Field label={t('convert.to')}>
                <select
                  className="select"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                >
                  {ASSETS.map((asset) => (
                    <option key={asset}>{asset}</option>
                  ))}
                </select>
              </Field>

              <div className="card" style={{ background: 'var(--panel-2)' }}>
                <div className="stat-label">{t('convert.result')}</div>
                <div className="stat-value pos">
                  <Money>{result ? formatCrypto(result.result, to) : '—'}</Money>
                </div>
                <div className="stat-hint">
                  {error
                    ? error
                    : result
                      ? `${t('convert.rate')}: 1 ${from} = ${result.rate.toFixed(6)} ${to} · ${formatMoney(
                          result.fromPrice,
                          currency,
                        )}`
                      : t('common.loading')}
                </div>
              </div>
            </div>
          </Card>

          <Card
            title={`${t('convert.chart')} · ${from}`}
            action={
              <div className="pill-row">
                {RANGES.map((range) => (
                  <button
                    key={range}
                    className={`pill ${days === range ? 'active' : ''}`}
                    style={{ padding: '5px 12px' }}
                    onClick={() => setDays(range)}
                  >
                    {range}d
                  </button>
                ))}
              </div>
            }
          >
            {chart === null ? (
              <Skeleton height={300} />
            ) : (
              <TrendArea data={chartData} height={300} color="var(--info)" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
