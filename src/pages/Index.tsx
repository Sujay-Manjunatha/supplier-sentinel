import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, BarChart3, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const features = [
    {
      icon: FileText,
      title: t('landing.features.docUpload.title'),
      description: t('landing.features.docUpload.description')
    },
    {
      icon: BarChart3,
      title: t('landing.features.aiAnalysis.title'),
      description: t('landing.features.aiAnalysis.description')
    },
    {
      icon: Shield,
      title: t('landing.features.dashboard.title'),
      description: t('landing.features.dashboard.description')
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{t('landing.title')}</h1>
          </div>
          <div className="flex gap-2">
            <LanguageSwitcher />
            <Button variant="outline" onClick={() => navigate('/login')}>
              {t('common.login')}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-5xl font-bold text-foreground leading-tight">
            {t('landing.heroTitle')}
            <span className="text-primary"> {t('landing.heroHighlight')}</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            {t('landing.heroDescription')}
          </p>
          <div className="flex gap-4 justify-center pt-6">
            <Button size="lg" onClick={() => navigate('/signup')} className="text-lg px-8">
              {t('landing.getStarted')}
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="text-lg px-8">
              {t('common.login')}
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-3xl font-bold text-center mb-12 text-foreground">{t('landing.howItWorks.title')}</h3>
          <div className="space-y-8">
            <div className="flex gap-6 items-start">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2 text-foreground">{t('landing.howItWorks.step1.title')}</h4>
                <p className="text-muted-foreground">{t('landing.howItWorks.step1.description')}</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2 text-foreground">{t('landing.howItWorks.step2.title')}</h4>
                <p className="text-muted-foreground">{t('landing.howItWorks.step2.description')}</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2 text-foreground">{t('landing.howItWorks.step3.title')}</h4>
                <p className="text-muted-foreground">{t('landing.howItWorks.step3.description')}</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2 text-foreground">{t('landing.howItWorks.step4.title')}</h4>
                <p className="text-muted-foreground">{t('landing.howItWorks.step4.description')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="p-12 text-center bg-primary text-primary-foreground">
          <h3 className="text-3xl font-bold mb-4">{t('landing.cta.title')}</h3>
          <p className="text-lg mb-8 opacity-90">{t('landing.cta.description')}</p>
          <Button size="lg" variant="secondary" onClick={() => navigate('/signup')} className="text-lg px-8">
            {t('landing.cta.button')}
          </Button>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur-sm py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 {t('landing.title')}. {t('landing.footer.rights')}</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
