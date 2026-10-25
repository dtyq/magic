import { createContext } from "react";
import type { Language } from "@magic-admin-v2/i18n/resources";

export type I18nContextValue = {
  canChangeLanguage: boolean;
  isChangingLanguage: boolean;
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
};

export const I18nContext = createContext<I18nContextValue | null>(null);
