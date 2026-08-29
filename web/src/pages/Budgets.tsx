import { useState } from 'react';
import { Plus, Target, Trash2 } from 'lucide-react';
import { api, type Budget, type Category } from '../api';
import { useApp } from '../app-context';
import { PageHeader } from '../components/Layout';
import { PeriodPicker, type PeriodState } from '../components/PeriodPicker';
import { categoryLabel } from '../components/TxList';
import { Card, EmptyState, Field, Modal, Money, Skeleton, StatCard } from '../components/ui';
import { formatMoney } from '../format';
import { useApi } from '../hooks';
import { useI18n } from '../i18n';

export function BudgetsPage() {
  const { t, locale } = useI18n();
  const { currency, toast } = useApp();
  const now = new Date();
  const [period, setPeriod] = useState<PeriodState>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const suffix = `year=${period.year}&month=${period.month ?? now.getMonth() + 1}`;
  const budgets = useApi<Budget[]>(`/planning/budgets?${suffix}`, [suffix]);
  const categories = useApi<Category[]>('/categories');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ categoryId: '', amount: '', period: 'month' as 'month' | 'year' });

  const list = budgets.data ?? [];
  const planned = list.reduce((sum, item) => sum + item.amount, 0);
  const spent = list.reduce((sum, item) => sum + item.spent, 0);

  async function save() {
    await api.post('/planning/budgets', {
      categoryId: Number(form.categoryId),
      amount: Number(form.amount),
      period: form.period,
    });
    setOpen(false);
    setForm({ categoryId: '', amount: '', period: 'month' });
    budgets.reload();
    toast(t('common.save'), 'success');
  }

  async function remove(id: number) {
    await api.del(`/planning/budgets/${id}`);
    budgets.reload();
  }

  return (
    <>
      <PageHeader
        title={t('budget.title')}
        subtitle={t('budget.subtitle')}
        actions={
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> {t('budget.add')}
          </button>
        }
      />
      <div className="page">
        <PeriodPicker value={period} onChange={setPeriod} allowAll={false} />

        <div className="grid cols-3">
          <StatCard
            label={t('budget.totalPlanned')}
            value={formatMoney(planned, currency)}
            hint={`${list.length} ${t('nav.budgets').toLowerCase()}`}
          />
          <StatCard
            label={t('budget.totalSpent')}
            value={formatMoney(spent, currency)}
            hint={planned > 0 ? `${((spent / planned) * 100).toFixed(0)}%` : '—'}
            tone={spent > planned ? 'negative' : 'default'}
          />
          <StatCard
            label={t('budget.remaining')}
            value={formatMoney(planned - spent, currency)}
            hint={t('budget.limit')}
            tone={planned - spent >= 0 ? 'positive' : 'negative'}
          />
        </div>

        {budgets.loading ? (
          <Skeleton height={280} />
        ) : list.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Target size={26} />}
              title={t('budget.empty')}
              hint={t('budget.emptyHint')}
              action={
                <button className="btn primary" onClick={() => setOpen(true)}>
                  <Plus size={15} /> {t('budget.add')}
                </button>
              }
            />
          </Card>
        ) : (
          <div className="grid cols-2">
            {list.map((budget) => {
              const ahead = budget.usedPercent > budget.periodElapsedPercent + 5;
              return (
                <div className="card budget-card" key={budget.id}>
                  <div className="row between">
                    <div className="row">
                      <span
                        className="chip"
                        style={{ background: `${budget.color}22`, color: budget.color }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: budget.color,
                            display: 'block',
                          }}
                        />
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {categoryLabel(locale, budget.categoryName, budget.categoryNameRu)}
                        </div>
                        <div className="hint">
                          {budget.period === 'month' ? t('budget.month') : t('budget.year')}
                        </div>
                      </div>
                    </div>
                    <button className="btn ghost icon" onClick={() => remove(budget.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="row between" style={{ margin: '16px 0 8px', alignItems: 'baseline' }}>
                    <Money className="stat-value" style={{ fontSize: 22, margin: 0 }}>
                      {formatMoney(budget.spent, currency)}
                    </Money>
                    <span className="dim">
                      / <Money>{formatMoney(budget.amount, currency)}</Money>
                    </span>
                  </div>

                  {/* The marker shows how far into the period we are, so a bar
                      that is ahead of it means you are overspending the pace. */}
                  <div className="budget-track">
                    <span
                      className="budget-fill"
                      style={{
                        width: `${Math.min(budget.usedPercent, 100)}%`,
                        // Status drives the colour — the category's own colour is
                        // already on the chip, and reusing it here made a healthy
                        // red-ish category look like it was over budget.
                        background:
                          budget.status === 'over'
                            ? 'var(--danger)'
                            : budget.status === 'warning'
                              ? 'var(--warn)'
                              : 'var(--accent)',
                      }}
                    />
                    <span
                      className="budget-marker"
                      style={{ left: `${budget.periodElapsedPercent}%` }}
                      title={t('budget.pace')}
                    />
                  </div>

                  <div className="row between" style={{ marginTop: 10 }}>
                    <span
                      className={`badge ${
                        budget.status === 'over' ? 'red' : budget.status === 'warning' ? '' : 'green'
                      }`}
                    >
                      {budget.status === 'over'
                        ? t('budget.over')
                        : budget.status === 'warning'
                          ? t('budget.warning')
                          : t('budget.onTrack')}
                    </span>
                    <span className="hint">
                      {budget.remaining >= 0
                        ? `${t('budget.remaining')}: `
                        : `${t('budget.over')}: `}
                      <Money>{formatMoney(Math.abs(budget.remaining), currency)}</Money>
                    </span>
                  </div>

                  <div className="hint" style={{ marginTop: 8 }}>
                    {ahead ? t('budget.paceAhead') : t('budget.paceBehind')} ·{' '}
                    {budget.usedPercent.toFixed(0)}% / {budget.periodElapsedPercent.toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <Modal
          title={t('budget.add')}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn primary"
                onClick={save}
                disabled={!form.categoryId || !Number(form.amount)}
              >
                {t('common.save')}
              </button>
            </>
          }
        >
          <Field label={t('common.category')}>
            <select
              className="select"
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
            >
              <option value="">{t('common.none')}</option>
              {categories.data
                ?.filter((category) => category.kind === 'expense')
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryLabel(locale, category.name, category.name_ru)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t('budget.limit')}>
            <input
              className="input"
              type="number"
              step="any"
              placeholder="500"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </Field>
          <Field label={t('budget.period')}>
            <select
              className="select"
              value={form.period}
              onChange={(event) =>
                setForm({ ...form, period: event.target.value as 'month' | 'year' })
              }
            >
              <option value="month">{t('budget.month')}</option>
              <option value="year">{t('budget.year')}</option>
            </select>
          </Field>
        </Modal>
      )}
    </>
  );
}
