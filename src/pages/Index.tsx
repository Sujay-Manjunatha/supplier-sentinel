import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, BarChart3, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: FileText,
      title: "Document Upload",
      description: "Upload your baseline supplier code and compare it with customer documents"
    },
    {
      icon: BarChart3,
      title: "AI Analysis",
      description: "Semantic comparison powered by advanced AI to identify meaningful gaps"
    },
    {
      icon: Shield,
      title: "Compliance Dashboard",
      description: "Visual insights with severity classification and actionable recommendations"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Supplier Code GAP Analysis</h1>
          </div>
          <Button variant="outline" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-5xl font-bold text-foreground leading-tight">
            Analyze Supplier Codes with
            <span className="text-primary"> AI-Powered Precision</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Compare supplier codes semantically, identify compliance gaps, and get actionable recommendations instantly.
          </p>
          <div className="flex gap-4 justify-center pt-6">
            <Button size="lg" onClick={() => navigate('/signup')} className="text-lg px-8">
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="text-lg px-8">
              Sign In
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
          <h3 className="text-3xl font-bold text-center mb-12 text-foreground">How It Works</h3>
          <div className="space-y-8">
            <div className="flex gap-6 items-start">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2 text-foreground">Upload Your Baseline</h4>
                <p className="text-muted-foreground">Set your supplier code as the reference document for all future comparisons.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2 text-foreground">Compare Customer Codes</h4>
                <p className="text-muted-foreground">Upload customer supplier codes for semantic analysis and gap identification.</p>
              </div>
            </div>
            <div className="flex gap-6 items-start">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2 text-foreground">Get Insights</h4>
                <p className="text-muted-foreground">Review detailed gap analysis with severity levels and actionable recommendations.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="p-12 text-center bg-primary text-primary-foreground">
          <h3 className="text-3xl font-bold mb-4">Ready to streamline your compliance analysis?</h3>
          <p className="text-lg mb-8 opacity-90">Start analyzing supplier codes today with AI-powered precision.</p>
          <Button size="lg" variant="secondary" onClick={() => navigate('/signup')} className="text-lg px-8">
            Create Free Account
          </Button>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur-sm py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 Supplier Code GAP Analysis. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
