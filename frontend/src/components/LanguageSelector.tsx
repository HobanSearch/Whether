import { useTranslation } from 'react-i18next';
import { supportedLanguages, changeLanguage, getCurrentLanguage, type SupportedLanguage } from '../i18n';
import './LanguageSelector.css';

interface LanguageSelectorProps {
    variant?: 'dropdown' | 'buttons' | 'compact';
    showFlags?: boolean;
    showNativeNames?: boolean;
}

function LanguageSelector({
    variant = 'buttons',
    showFlags = true,
    showNativeNames = true,
}: LanguageSelectorProps) {
    const { t } = useTranslation();
    const currentLang = getCurrentLanguage();

    const handleLanguageChange = (lang: SupportedLanguage) => {
        changeLanguage(lang);
    };

    if (variant === 'dropdown') {
        return (
            <div className="language-selector dropdown">
                <label className="selector-label">{t('common.language')}</label>
                <select
                    value={currentLang}
                    onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                    className="language-dropdown"
                >
                    {Object.entries(supportedLanguages).map(([code, lang]) => (
                        <option key={code} value={code}>
                            {showFlags && `${lang.flag} `}
                            {showNativeNames ? lang.nativeName : lang.name}
                        </option>
                    ))}
                </select>
            </div>
        );
    }

    if (variant === 'compact') {
        return (
            <div className="language-selector compact">
                {Object.entries(supportedLanguages).map(([code, lang]) => (
                    <button
                        key={code}
                        className={`lang-btn compact ${currentLang === code ? 'active' : ''}`}
                        onClick={() => handleLanguageChange(code as SupportedLanguage)}
                        title={lang.nativeName}
                    >
                        {lang.flag}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className="language-selector buttons">
            <label className="selector-label">{t('common.language')}</label>
            <div className="lang-buttons">
                {Object.entries(supportedLanguages).map(([code, lang]) => (
                    <button
                        key={code}
                        className={`lang-btn ${currentLang === code ? 'active' : ''}`}
                        onClick={() => handleLanguageChange(code as SupportedLanguage)}
                    >
                        {showFlags && <span className="lang-flag">{lang.flag}</span>}
                        <span className="lang-name">
                            {showNativeNames ? lang.nativeName : lang.name}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default LanguageSelector;
