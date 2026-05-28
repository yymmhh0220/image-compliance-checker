import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented, Collapse } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

interface AppLayoutProps {
  children: ReactNode;
}

const languageOptions = [
  { label: '中文', value: 'zh' },
  { label: '日本語', value: 'ja' },
  { label: 'English', value: 'en' },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(i18n.language || 'zh');

  const handleLanguageChange = (value: string | number) => {
    const lang = value as string;
    setCurrentLang(lang);
    i18n.changeLanguage(lang);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* App Title */}
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
              {t('common.appTitle')}
            </h1>

            {/* Language Switcher */}
            <div className="flex-shrink-0 ml-4">
              <Segmented
                value={currentLang}
                options={languageOptions}
                onChange={handleLanguageChange}
                size="small"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Rules Summary */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <Collapse
          defaultActiveKey={['rules']}
          size="small"
          items={[
            {
              key: 'rules',
              label: (
                <span className="flex items-center gap-2 text-sm font-medium text-blue-700">
                  <InfoCircleOutlined />
                  {t('layout.rulesTitle')}
                </span>
              ),
              children: (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 mb-3">
                    {t('layout.rulesDescription')}
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>{t('rules.sizeRule')}</li>
                    <li>{t('rules.backgroundRule')}</li>
                    <li>{t('rules.coverageRule')}</li>
                    <li>{t('rules.textRule')}</li>
                    <li>{t('rules.multiViewRule')}</li>
                  </ul>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
