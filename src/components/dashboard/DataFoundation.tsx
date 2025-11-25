import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, FolderCheck } from "lucide-react";
import BaselineSetup from "./BaselineSetup";
import AcceptedRequirements from "./AcceptedRequirements";

interface DataFoundationProps {
  userId: string;
  onBaselineCreated: (id: string) => void;
  existingBaselineId: string | null;
}

const DataFoundation = ({ userId, onBaselineCreated, existingBaselineId }: DataFoundationProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Datengrundlage</h2>
        <p className="text-muted-foreground">
          Verwalten Sie Ihren eigenen Kodex und dauerhaft akzeptierte Anforderungen
        </p>
      </div>

      <Tabs defaultValue="baseline" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="baseline" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Mein Kodex
          </TabsTrigger>
          <TabsTrigger value="accepted" className="flex items-center gap-2">
            <FolderCheck className="h-4 w-4" />
            Akzeptierte Punkte
          </TabsTrigger>
        </TabsList>

        <TabsContent value="baseline" className="mt-6">
          <BaselineSetup
            userId={userId}
            onBaselineCreated={onBaselineCreated}
            existingBaselineId={existingBaselineId}
          />
        </TabsContent>

        <TabsContent value="accepted" className="mt-6">
          <AcceptedRequirements />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataFoundation;
