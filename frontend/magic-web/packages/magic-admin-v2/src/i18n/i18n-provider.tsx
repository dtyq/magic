import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { I18nextProvider } from "react-i18next";
import { createI18nInstance } from "@magic-admin-v2/i18n/create-i18n";
import {
  I18nContext,
  type I18nContextValue,
} from "@magic-admin-v2/i18n/i18n-context";
import { I18nReadyBoundary } from "@magic-admin-v2/i18n/i18n-ready-boundary";
import type { Language } from "@magic-admin-v2/i18n/resources";

type I18nProviderProps = PropsWithChildren<{
  fallback?: ReactNode;
  includeDevelopment?: boolean;
  language: Language;
  onLanguageChange?: (
    language: Language,
  ) => void | Promise<void>;
}>;

export function I18nProvider({
  children,
  fallback,
  includeDevelopment = false,
  language,
  onLanguageChange,
}: I18nProviderProps) {
  const [i18nInstance] = useState(() =>
    createI18nInstance({ includeDevelopment }),
  );
  const [resolvedLanguage, setResolvedLanguage] =
    useState<Language>(language);
  const [ready, setReady] = useState(false);
  const [isChangingLanguage, setChangingLanguage] = useState(false);

  useEffect(() => {
    let active = true;
    setChangingLanguage(true);

    void i18nInstance.ensureLanguage(language).then(
      () => {
        if (!active) return;
        setResolvedLanguage(language);
        setReady(true);
        setChangingLanguage(false);
      },
      () => {
        if (!active) return;
        setChangingLanguage(false);
      },
    );

    return () => {
      active = false;
    };
  }, [i18nInstance, language]);

  const setLanguage = useCallback(
    async (nextLanguage: Language) => {
      if (!onLanguageChange || nextLanguage === language) return;
      await onLanguageChange(nextLanguage);
    },
    [language, onLanguageChange],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      canChangeLanguage: Boolean(onLanguageChange),
      isChangingLanguage,
      language: resolvedLanguage,
      setLanguage,
    }),
    [isChangingLanguage, onLanguageChange, resolvedLanguage, setLanguage],
  );

  return (
    <I18nextProvider i18n={i18nInstance.instance}>
      <I18nContext.Provider value={value}>
        <I18nReadyBoundary fallback={fallback} ready={ready}>
          {children}
        </I18nReadyBoundary>
      </I18nContext.Provider>
    </I18nextProvider>
  );
}
