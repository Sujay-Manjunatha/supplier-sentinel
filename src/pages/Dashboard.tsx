import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BaselineSetup from "@/components/dashboard/BaselineSetup";
import ComparisonUpload from "@/components/dashboard/ComparisonUpload";
import AnalysisResults from "@/components/dashboard/AnalysisResults";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("baseline");
  const [baselineId, setBaselineId] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
      } else {
        setUser(user);
        checkForBaseline(user.id);
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

  const checkForBaseline = async (userId: string) => {
    const { data, error } = await supabase
      .from("baseline_documents")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setBaselineId(data.id);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You've been successfully signed out.",
    });
    navigate("/");
  };

  const handleBaselineCreated = (id: string) => {
    setBaselineId(id);
    setActiveTab("compare");
    toast({
      title: "Baseline saved",
      description: "Your baseline document has been saved successfully.",
    });
  };

  const handleAnalysisComplete = (id: string) => {
    setAnalysisId(id);
    setActiveTab("results");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Supplier Code GAP Analysis</h1>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3">
            <TabsTrigger value="baseline">Baseline Setup</TabsTrigger>
            <TabsTrigger value="compare" disabled={!baselineId}>
              Upload & Compare
            </TabsTrigger>
            <TabsTrigger value="results" disabled={!analysisId}>
              Analysis Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="baseline" className="space-y-4">
            <BaselineSetup 
              userId={user.id} 
              onBaselineCreated={handleBaselineCreated}
              existingBaselineId={baselineId}
            />
          </TabsContent>

          <TabsContent value="compare" className="space-y-4">
            <ComparisonUpload
              userId={user.id}
              baselineId={baselineId}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            <AnalysisResults analysisId={analysisId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
