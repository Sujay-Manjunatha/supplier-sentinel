import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import DataFoundation from "@/components/dashboard/DataFoundation";
import ComparisonUpload from "@/components/dashboard/ComparisonUpload";
import AnalysisResults from "@/components/dashboard/AnalysisResults";
import MyProcesses from "@/components/dashboard/MyProcesses";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("data-foundation");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [comparisonDocumentId, setComparisonDocumentId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
      } else {
        setUser(user);
      }
    };

    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/login");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: t('dashboard.logoutSuccess'),
      description: t('dashboard.logoutSuccess'),
    });
    navigate("/");
  };

  const handleAnalysisComplete = (id: string, compDocId: string) => {
    setAnalysisId(id);
    setComparisonDocumentId(compDocId);
    setActiveSection("results");
  };

  if (!user) return null;

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
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('common.logout')}
                </Button>
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
                userId={user.id}
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