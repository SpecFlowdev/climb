import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api, type Category, type Rule } from '../api';
import { useApp } from '../app-context';
import { PageHeader } from '../components/Layout';
import { categoryLabel } from '../components/TxList';
import { Card, EmptyState, Field, Modal, Skeleton } from '../components/ui';
import { useApi } from '../hooks';
import { useI18n } from '../i18n';

const FIELDS = ['counterparty', 'asset', 'chain', 'note', 'direction'] as const;
const OPERATORS = ['contains', 'equals', 'starts_with'] as const;

export function RulesPage() {
  const { t, locale } = useI18n();
  const { toast } = useApp();
  const rules = useApi<Rule[]>('/rules');
  const categories = useApi<Category[]>('/categories');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    field: 'counterparty' as (typeof FIELDS)[number],
    operator: 'contains' as (typeof OPERATORS)[number],
    pattern: '',
    categoryId: '',
    priority: 100,
  });

  async function save() {
    await api.post('/rules', { ...form, categoryId: Number(form.categoryId) });
    setOpen(false);
    setForm({ ...form, pattern: '' });
    rules.reload();
    toast(t('common.save'), 'success');
  }

  async function toggle(rule: Rule) {
    await api.patch(`/rules/${rule.id}`, { enabled: !rule.enabled });
    rules.reload();
  }

  async function remove(id: number) {
    await api.del(`/rules/${id}`);
    rules.reload();
  }

  return (
    <>
      <PageHeader
        title={t('rules.title')}
        subtitle={t('rules.subtitle')}
        actions={
          <button className="btn primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> {t('rules.add')}
          </button>
        }
      />
      <div className="page">
        <Card className="pad-0">
          {rules.loading ? (
            <div style={{ padding: 18 }}>
              <Skeleton height={200} />
            </div>
          ) : (rules.data?.length ?? 0) === 0 ? (
            <EmptyState
              title={t('rules.empty')}
              hint={t('rules.emptyHint')}
              action={
                <button className="btn primary" onClick={() => setOpen(true)}>
                  <Plus size={15} /> {t('rules.add')}
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('rules.priority')}</th>
                    <th>{t('rules.field')}</th>
                    <th>{t('rules.operator')}</th>
                    <th>{t('rules.pattern')}</th>
                    <th>{t('common.category')}</th>
                    <th>{t('rules.enabled')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rules.data?.map((rule) => (
                    <tr key={rule.id}>
                      <td className="dim">{rule.priority}</td>
                      <td>{rule.field}</td>
                      <td className="dim">{t(`rules.${rule.operator}`)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{rule.pattern}</td>
                      <td>
                        <span
                          className="badge"
                          style={{ background: `${rule.category_color}22`, color: rule.category_color }}
                        >
                          {rule.category_name}
                        </span>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => toggle(rule)}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn ghost icon" onClick={() => remove(rule.id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {open && (
        <Modal
          title={t('rules.add')}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn primary"
                onClick={save}
                disabled={!form.pattern || !form.categoryId}
              >
                {t('common.save')}
              </button>
            </>
          }
        >
          <div className="grid cols-2" style={{ gap: 12 }}>
            <Field label={t('rules.field')}>
              <select
                className="select"
                value={form.field}
                onChange={(event) =>
                  setForm({ ...form, field: event.target.value as (typeof FIELDS)[number] })
                }
              >
                {FIELDS.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('rules.operator')}>
              <select
                className="select"
                value={form.operator}
                onChange={(event) =>
                  setForm({ ...form, operator: event.target.value as (typeof OPERATORS)[number] })
                }
              >
                {OPERATORS.map((operator) => (
                  <option key={operator} value={operator}>
                    {t(`rules.${operator}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t('rules.pattern')}>
            <input
              className="input"
              value={form.pattern}
              onChange={(event) => setForm({ ...form, pattern: event.target.value })}
              placeholder="0x… / USDT / binance"
            />
          </Field>
          <Field label={t('common.category')}>
            <select
              className="select"
              value={form.categoryId}
              onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
            >
              <option value="">{t('common.none')}</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {categoryLabel(locale, category.name, category.name_ru)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('rules.priority')}>
            <input
              className="input"
              type="number"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })}
            />
          </Field>
        </Modal>
      )}
    </>
  );
}
