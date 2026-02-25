import { useContext } from 'react';
import { I18nContext } from './i18n-context';

export type { I18nContextValue, Locale } from './i18n-context';

export function useTranslation() {
    const context = useContext(I18nContext);
    if (!context) {
        throw new Error('useTranslation must be used within I18nProvider');
    }
    return context;
}
