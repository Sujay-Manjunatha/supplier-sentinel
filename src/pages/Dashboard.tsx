import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import DataFoundation from "@/components/dashboard/DataFoundation";
import ComparisonUpload from "@/components/dashboard/ComparisonUpload";
import AnalysisResults from "@/components/dashboard/AnalysisResults";
import MyProcesses from "@/components/dashboard/MyProcesses";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { LOCAL_USER_ID } from "@/lib/localStore";

const Dashboard = () => {
  const [activeSection, setActiveSection] = useState("data-foundation");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [comparisonDocumentId, setComparisonDocumentId] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleAnalysisComplete = (id: string, compDocId: string) => {
    setAnalysisId(id);
    setComparisonDocumentId(compDocId);
    setActiveSection("results");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-primary/5 to-background">
        <AppSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-card/50 backdrop-blur-sm">
            <div className="container mx-auto px-6 py-3 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
              </div>
              <div className="flex gap-2">
                <LanguageSwitcher />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 container max-w-7xl mx-auto px-6 py-6">
            {activeSection === "data-foundation" && (
              <DataFoundation />
            )}

            {activeSection === "processes" && <MyProcesses />}

            {activeSection === "new-process" && (
              <ComparisonUpload
                userId={LOCAL_USER_ID}
                baselineId=""
                onAnalysisComplete={handleAnalysisComplete}
              />
            )}

            {activeSection === "results" && (
              <AnalysisResults
                analysisId={analysisId}
                comparisonDocumentId={comparisonDocumentId}
              />
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;
