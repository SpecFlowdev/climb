import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type Settings } from './api';
import { I18nProvider, type LocaleCode } from './i18n';
import { useLocalStorage } from './hooks';

type ToastKind = 'info' | 'success' | 'error';
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface AppValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => Promise<void>;
  toast: (message: string, kind?: ToastKind) => void;
  toasts: Toast[];
  currency: string;
  privacy: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  theme: 'dark',
  currency: 'usd',
  hideSmallBalances: false,
  privacyMode: false,
};

const AppContext = createContext<AppValue>({
  settings: DEFAULT_SETTINGS,
  update: async () => undefined,
  toast: () => undefined,
  toasts: [],
  currency: 'usd',
  privacy: false,
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [local, setLocal] = useLocalStorage<Settings>('climb.settings', DEFAULT_SETTINGS);
  const [settings, setSettings] = useState<Settings>(local);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    api
      .get<Settings>('/settings')
      .then((remote) => {
        const merged = { ...DEFAULT_SETTINGS, ...remote };
        setSettings(merged);
        setLocal(merged);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme === 'light' ? 'light' : 'dark';
    document.documentElement.lang = settings.language;
  }, [settings.theme, settings.language]);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      const merged = { ...settings, ...patch };
      setSettings(merged);
      setLocal(merged);
      await api.put('/settings', patch).catch(() => undefined);
    },
    [settings, setLocal],
  );

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3600);
  }, []);

  const value = useMemo<AppValue>(
    () => ({
      settings,
      update,
      toast,
      toasts,
      currency: String(settings.currency ?? 'usd'),
      privacy: Boolean(settings.privacyMode),
    }),
    [settings, update, toast, toasts],
  );

  const setLocale = useCallback((locale: LocaleCode) => void update({ language: locale }), [update]);

  return (
    <AppContext.Provider value={value}>
      <I18nProvider locale={(settings.language as LocaleCode) ?? 'en'} setLocale={setLocale}>
        {children}
      </I18nProvider>
    </AppContext.Provider>
  );
}

export function useApp(): AppValue {
  return useContext(AppContext);
}
