import { useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { api, type Category } from '../api';
import { useApp } from '../app-context';
import { PageHeader } from '../components/Layout';
import { categoryLabel } from '../components/TxList';
import { Card, Field, Modal, Skeleton } from '../components/ui';
import { CHART_COLORS } from '../format';
import { useApi } from '../hooks';
import { useI18n } from '../i18n';

const KINDS = ['income', 'expense', 'transfer'] as const;

export function CategoriesPage() {
  const { t, locale } = useI18n();
  const { toast } = useApp();
  const categories = useApi<Category[]>('/categories');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    nameRu: '',
    kind: 'expense' as (typeof KINDS)[number],
    color: CHART_COLORS[0],
    icon: 'tag',
  });

  async function save() {
    await api.post('/categories', form);
    setOpen(false);
    setForm({ ...form, name: '', nameRu: '' });
    categories.reload();
    toast(t('common.save'), 'success');
  }

  async function remove(id: number) {
    try {
      await api.del(`/categories/${id}`);
      categories.reload();
    } catch {
      toast(t('error.generic'), 'error');
    }
  }

  async function recategorize() {
    const result = await api.post<{ updated: number }>('/categories/recategorize');
    toast(t('cat.recategorized', { n: result.updated }), 'success');
    categories.reload();
  }

  return (
    <>
      <PageHeader
        title={t('cat.title')}
        subtitle={t('cat.subtitle')}
        actions={
          <>
            <button className="btn" onClick={recategorize}>
              <Wand2 size={15} /> {t('cat.recategorize')}
            </button>
            <button className="btn primary" onClick={() => setOpen(true)}>
              <Plus size={15} /> {t('cat.add')}
            </button>
          </>
        }
      />
      <div className="page">
        {categories.loading ? (
          <Skeleton height={280} />
        ) : (
          <div className="grid cols-3">
            {KINDS.map((kind) => (
              <Card
                key={kind}
                title={t(
                  kind === 'income'
                    ? 'common.income'
                    : kind === 'expense'
                      ? 'common.expense'
                      : 'common.transfer',
                )}
              >
                <div className="list">
                  {categories.data
                    ?.filter((category) => category.kind === kind)
                    .map((category) => (
                      <div className="list-item" key={category.id}>
                        <span
                          className="chip"
                          style={{ background: `${category.color}22`, color: category.color }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 3,
                              background: category.color,
                              display: 'block',
                            }}
                          />
                        </span>
                        <div style={{ flex: 1 }}>
                          <div className="title">
                            {categoryLabel(locale, category.name, category.name_ru)}
                          </div>
                          <div className="meta">
                            {t('cat.used', { n: category.tx_count })}
                            {category.system ? ` · ${t('cat.system')}` : ''}
                          </div>
                        </div>
                        {!category.system && (
                          <button className="btn ghost icon" onClick={() => remove(category.id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {open && (
        <Modal
          title={t('cat.add')}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn primary" onClick={save} disabled={!form.name}>
                {t('common.save')}
              </button>
            </>
          }
        >
          <Field label={t('cat.name')}>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>
          <Field label={t('cat.nameRu')} hint={t('common.optional')}>
            <input
              className="input"
              value={form.nameRu}
              onChange={(event) => setForm({ ...form, nameRu: event.target.value })}
            />
          </Field>
          <Field label={t('cat.kind')}>
            <select
              className="select"
              value={form.kind}
              onChange={(event) =>
                setForm({ ...form, kind: event.target.value as (typeof KINDS)[number] })
              }
            >
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(
                    kind === 'income'
                      ? 'common.income'
                      : kind === 'expense'
                        ? 'common.expense'
                        : 'common.transfer',
                  )}
                </option>
              ))}
            </select>
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
