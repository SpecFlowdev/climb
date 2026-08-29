import { useI18n, type TranslationKey } from '../i18n';
import { useApi } from '../hooks';

export interface PeriodState {
  year: number;
  month: number | null;
}

export function PeriodPicker({
  value,
  onChange,
  allowAll = true,
}: {
  value: PeriodState;
  onChange: (period: PeriodState) => void;
  allowAll?: boolean;
}) {
  const { t } = useI18n();
  const { data: years } = useApi<number[]>('/stats/years');
  const options = years?.length ? years : [new Date().getFullYear()];

  return (
    <div className="row between wrap" style={{ gap: 12 }}>
      <div className="pill-row">
        {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
          <button
            key={month}
            className={`pill ${value.month === month ? 'active' : ''}`}
            onClick={() => onChange({ ...value, month })}
          >
            {t(`month.${month}` as TranslationKey)}
          </button>
        ))}
        {allowAll && (
          <button
            className={`pill ${value.month === null ? 'active' : ''}`}
            onClick={() => onChange({ ...value, month: null })}
          >
            {t('common.all')}
          </button>
        )}
      </div>
      <select
        className="select"
        style={{ width: 110 }}
        value={value.year}
        onChange={(event) => onChange({ ...value, year: Number(event.target.value) })}
      >
        {options.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
}
