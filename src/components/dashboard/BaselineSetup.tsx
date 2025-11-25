import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import extract from "react-pdftotext";

interface BaselineSetupProps {
  userId: string;
  onBaselineCreated: (id: string) => void;
  existingBaselineId: string | null;
}

const BaselineSetup = ({ userId, onBaselineCreated, existingBaselineId }: BaselineSetupProps) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingBaseline, setExistingBaseline] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (existingBaselineId) {
      fetchBaseline();
    }
  }, [existingBaselineId]);

  const fetchBaseline = async () => {
    const { data, error } = await supabase
      .from("baseline_documents")
      .select("*")
      .eq("id", existingBaselineId)
      .single();

    if (data) {
      setExistingBaseline(data);
      setTitle(data.title);
      setContent(data.content);
      setFileName(data.file_name);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isTXT = file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");

    if (!isPDF && !isTXT) {
      toast({
        title: "Unsupported file type",
        description: "Please upload a PDF or plain text (.txt) file.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let text: string;

      if (isPDF) {
        // Extract text from PDF
        text = await extract(file);
      } else {
        // Read text file
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      if (!text || text.trim().length === 0) {
        toast({
          title: "Empty document",
          description: "The file appears to be empty or contains no extractable text.",
          variant: "destructive",
        });
        return;
      }

      setContent(text);
      setFileName(file.name);
      if (!title) {
        setTitle(file.name.replace(/\.[^.]+$/, ""));
      }

      toast({
        title: "File uploaded",
        description: isPDF ? "Text extracted from PDF successfully." : "Text file loaded successfully.",
      });
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to process the file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title || !content) {
      toast({
        title: "Error",
        description: "Please provide both title and content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (existingBaseline) {
        // Update existing
        const { error } = await supabase
          .from("baseline_documents")
          .update({
            title,
            content,
            file_name: fileName,
          })
          .eq("id", existingBaseline.id);

        if (error) throw error;

        toast({
          title: "Updated",
          description: "Baseline document updated successfully",
        });
        onBaselineCreated(existingBaseline.id);
      } else {
        // Create new
        const { data, error } = await supabase
          .from("baseline_documents")
          .insert({
            user_id: userId,
            title,
            content,
            file_name: fileName || "manual-entry.txt",
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Success",
          description: "Baseline document saved successfully",
        });
        onBaselineCreated(data.id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save baseline document",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingBaseline) return;

    if (!confirm("Are you sure you want to delete this baseline document?")) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("baseline_documents")
        .delete()
        .eq("id", existingBaseline.id);

      if (error) throw error;

      setExistingBaseline(null);
      setTitle("");
      setContent("");
      setFileName("");
      
      toast({
        title: "Deleted",
        description: "Baseline document deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete baseline document",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Baseline Supplier Code</h2>
          <p className="text-muted-foreground">
            Upload or enter your supplier code to use as the reference for all comparisons.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baseline-file">Upload Document (Optional)</Label>
            <div className="flex items-center gap-4">
              <Input
                id="baseline-file"
                type="file"
                accept=".txt,.pdf"
                onChange={handleFileUpload}
                disabled={loading}
                className="flex-1"
              />
              {fileName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{fileName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseline-title">Document Title</Label>
            <Input
              id="baseline-title"
              placeholder="e.g., Company Supplier Code v2.0"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseline-content">Content</Label>
            <Textarea
              id="baseline-content"
              placeholder="Paste or type your supplier code content here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              <Upload className="h-4 w-4 mr-2" />
              {existingBaseline ? "Update Baseline" : "Save Baseline"}
            </Button>
            {existingBaseline && (
              <Button variant="destructive" onClick={handleDelete} disabled={loading}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default BaselineSetup;
