import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ru from './locales/ru.json';
import zh from './locales/zh.json';

export const supportedLanguages = {
    en: { name: 'English', nativeName: 'English', flag: '🇺🇸' },
    ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
    zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
} as const;

export type SupportedLanguage = keyof typeof supportedLanguages;

const resources = {
    en: { translation: en },
    ru: { translation: ru },
    zh: { translation: zh },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        supportedLngs: Object.keys(supportedLanguages),
        interpolation: {
            escapeValue: false, // React already escapes values
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupLocalStorage: 'whether_language',
        },
        react: {
            useSuspense: false, // Disable suspense for Telegram Mini App compatibility
        },
    });

/**
 * Set language from Telegram user preferences.
 * Call this after Telegram WebApp is initialized.
 */
export function setLanguageFromTelegram(languageCode: string | undefined): void {
    if (!languageCode) return;

    // Map Telegram language codes to our supported languages
    const langMap: Record<string, SupportedLanguage> = {
        en: 'en',
        ru: 'ru',
        zh: 'zh',
        'zh-hans': 'zh',
        'zh-hant': 'zh',
    };

    const mappedLang = langMap[languageCode.toLowerCase()];
    if (mappedLang && i18n.language !== mappedLang) {
        // Only set if user hasn't explicitly chosen a different language
        const storedLang = localStorage.getItem('whether_language');
        if (!storedLang) {
            i18n.changeLanguage(mappedLang);
        }
    }
}

/**
 * Change the current language and persist to localStorage.
 */
export function changeLanguage(lang: SupportedLanguage): void {
    i18n.changeLanguage(lang);
    localStorage.setItem('whether_language', lang);
}

/**
 * Get the current language.
 */
export function getCurrentLanguage(): SupportedLanguage {
    return (i18n.language as SupportedLanguage) || 'en';
}

export default i18n;
