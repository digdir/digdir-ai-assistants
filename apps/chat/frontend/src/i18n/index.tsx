import { createContext, useContext, useState, useCallback } from "react";
import en from "./en";
import no from "./no";
import type { TranslationKey, Translations } from "./en";

export type Locale = "en" | "no";

const translations: Record<Locale, Translations> = { en, no };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
  const stored = localStorage.getItem("locale");
  if (stored === "en" || stored === "no") return stored;
  // Default to Norwegian if browser language is Norwegian
  if (navigator.language.startsWith("nb") || navigator.language.startsWith("nn") || navigator.language.startsWith("no")) {
    return "no";
  }
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem("locale", next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let text: string = translations[locale][key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider");
  return ctx;
}
