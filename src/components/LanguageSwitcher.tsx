import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  
  const toggleLanguage = () => {
    const newLang = i18n.language === 'de' ? 'en' : 'de';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };
  
  return (
    <Button variant="ghost" onClick={toggleLanguage} className="gap-2">
      {i18n.language === 'de' ? '🇬🇧 EN' : '🇩🇪 DE'}
    </Button>
  );
};

export default LanguageSwitcher;
