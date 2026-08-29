import { useState } from 'react';
import { CheckCircle2, Flag, Plus, Trash2 } from 'lucide-react';
import { api, type Goal } from '../api';
import { useApp } from '../app-context';
import { PageHeader } from '../components/Layout';
import { Card, EmptyState, Field, Modal, Money, Skeleton } from '../components/ui';
import { CHART_COLORS, formatCrypto, formatDateTime, formatMoney } from '../format';
import { useApi } from '../hooks';
import { useI18n } from '../i18n';

const ASSETS = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'TRX', 'POL'];

export function GoalsPage() {
  const { t, locale } = useI18n();
  const { currency, toast } = useApp();
  const goals = useApi<Goal[]>('/planning/goals');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    asset: '',
    target: '',
    deadline: '',
    color: CHART_COLORS[0],
  });

  async function save() {
    await api.post('/planning/goals', {
      title: form.title,
      asset: form.asset || null,
      target: Number(form.target),
      deadline: form.deadline || null,
      color: form.color,
    });
    setOpen(false);
    setForm({ title: '', asset: '', target: '', deadline: '', color: CHART_COLORS[0] });
    goals.reload();
    toast(t('common.save'), 'success');
  }

  async function remove(id: number) {
    await api.del(`/planning/goals/${id}`);
    goals.reload();
  }

  const list = goals.data ?? [];

  return (
    <>
      <PageHeader
        title={t('goal.title')}
        subtitle={t('goal.subtitle')}
        actions={
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> {t('goal.add')}
          </button>
        }
      />
      <div className="page">
        {goals.loading ? (
          <Skeleton height={240} />
        ) : list.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Flag size={26} />}
              title={t('goal.empty')}
              hint={t('goal.emptyHint')}
              action={
                <button className="btn primary" onClick={() => setOpen(true)}>
                  <Plus size={15} /> {t('goal.add')}
                </button>
              }
            />
          </Card>
        ) : (
          <div className="grid cols-2">
            {list.map((goal) => {
              const done = goal.progressPercent >= 100;
              const overdue = goal.daysLeft !== null && goal.daysLeft < 0 && !done;
              return (
                <div className="card" key={goal.id}>
                  <div className="row between">
                    <div className="row">
                      <span
                        className="chip"
                        style={{ background: `${goal.color}22`, color: goal.color }}
                      >
                        {done ? <CheckCircle2 size={16} /> : <Flag size={16} />}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{goal.title}</div>
                        <div className="hint">
                          {goal.asset
                            ? formatCrypto(goal.target, goal.asset)
                            : formatMoney(goal.target, currency)}
                        </div>
                      </div>
                    </div>
                    <button className="btn ghost icon" onClick={() => remove(goal.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="goal-ring-row">
                    <GoalRing percent={goal.progressPercent} color={goal.color} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="stat-label">{t('goal.progress')}</div>
                      <Money className="stat-value" style={{ fontSize: 22, margin: '6px 0' }}>
                        {goal.asset
                          ? formatCrypto(goal.current, goal.asset)
                          : formatMoney(goal.current, currency)}
                      </Money>
                      <div className="hint">
                        <Money>{formatMoney(goal.currentValue, currency)}</Money>
                        {' / '}
                        <Money>{formatMoney(goal.targetValue, currency)}</Money>
                      </div>
                    </div>
                  </div>

                  <div className="row between" style={{ marginTop: 14 }}>
                    {done ? (
                      <span className="badge green">{t('goal.reached')}</span>
                    ) : overdue ? (
                      <span className="badge red">{t('goal.overdue')}</span>
                    ) : goal.daysLeft !== null ? (
                      <span className="badge">{t('goal.daysLeft', { n: goal.daysLeft })}</span>
                    ) : (
                      <span className="badge">{formatDateTime(goal.deadline, locale)}</span>
                    )}
                    {!done && goal.requiredPerMonth !== null && (
                      <span className="hint">
                        {t('goal.needPerMonth')}:{' '}
                        <Money>
                          <strong>{formatMoney(goal.requiredPerMonth, currency)}</strong>
                        </Money>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <Modal
          title={t('goal.add')}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn primary"
                onClick={save}
                disabled={!form.title || !Number(form.target)}
              >
                {t('common.save')}
              </button>
            </>
          }
        >
          <Field label={t('goal.name')}>
            <input
              className="input"
              placeholder="Stack 1 BTC"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <Field label={t('goal.targetAsset')}>
              <select
                className="select"
                value={form.asset}
                onChange={(event) => setForm({ ...form, asset: event.target.value })}
              >
                <option value="">{t('goal.anyAsset')}</option>
                {ASSETS.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('goal.target')}>
              <input
                className="input"
                type="number"
                step="any"
                value={form.target}
                onChange={(event) => setForm({ ...form, target: event.target.value })}
              />
            </Field>
          </div>
          <Field label={t('goal.deadline')} hint={t('common.optional')}>
            <input
              className="input"
              type="date"
              value={form.deadline}
              onChange={(event) => setForm({ ...form, deadline: event.target.value })}
            />
          </Field>
          <Field label={t('cat.color')}>
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

/** Small SVG progress ring — clearer at a glance than a bar for a single number. */
function GoalRing({ percent, color }: { percent: number; color: string }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(percent, 100) / 100) * circumference;
  return (
    <div className="goal-ring">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={radius} fill="none" stroke="var(--panel-3)" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <span className="goal-ring-value">{percent.toFixed(0)}%</span>
    </div>
  );
}
