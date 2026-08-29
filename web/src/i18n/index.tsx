import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { en, type TranslationKey } from './en';
import { ru } from './ru';

export const LOCALES = {
  en: { name: 'English', flag: '🇬🇧', dict: en },
  ru: { name: 'Русский', flag: '🇷🇺', dict: ru },
} as const;

export type LocaleCode = keyof typeof LOCALES;
export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue>({
  locale: 'en',
  setLocale: () => undefined,
  t: (key) => key,
});

export function I18nProvider({
  locale,
  setLocale,
  children,
}: {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  children: ReactNode;
}) {
  const t = useCallback<Translate>(
    (key, vars) => {
      const dict = LOCALES[locale]?.dict ?? en;
      let value: string = (dict as Record<string, string>)[key] ?? en[key] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replace(`{${name}}`, String(replacement));
        }
      }
      return value;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

export type { TranslationKey };
