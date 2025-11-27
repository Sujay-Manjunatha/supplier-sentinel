import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, FolderCheck, Shield } from "lucide-react";
import BaselineSetup from "./BaselineSetup";
import AcceptedRequirements from "./AcceptedRequirements";
import { useState } from "react";

interface DataFoundationProps {
  userId: string;
  onBaselineCreated: (id: string) => void;
  existingBaselineId: string | null;
}

const DataFoundation = ({ userId, onBaselineCreated, existingBaselineId }: DataFoundationProps) => {
  const [activeDocType, setActiveDocType] = useState<'supplier_code' | 'nda'>('supplier_code');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Datengrundlage</h2>
        <p className="text-muted-foreground">
          Verwalten Sie Ihre Basisdokumente und dauerhaft akzeptierte Anforderungen
        </p>
      </div>

      <Tabs value={activeDocType} onValueChange={(v) => setActiveDocType(v as 'supplier_code' | 'nda')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="supplier_code" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Lieferantenkodex
          </TabsTrigger>
          <TabsTrigger value="nda" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            NDA / Geheimhaltung
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supplier_code" className="mt-6 space-y-6">
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
                documentType="supplier_code"
              />
            </TabsContent>

            <TabsContent value="accepted" className="mt-6">
              <AcceptedRequirements documentType="supplier_code" />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="nda" className="mt-6 space-y-6">
          <Tabs defaultValue="baseline" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="baseline" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Mein NDA
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
                existingBaselineId={null}
                documentType="nda"
              />
            </TabsContent>

            <TabsContent value="accepted" className="mt-6">
              <AcceptedRequirements documentType="nda" />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataFoundation;
