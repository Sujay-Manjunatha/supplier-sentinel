import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Shield } from "lucide-react";
import NegativeListManager from "./NegativeListManager";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const DataFoundation = () => {
  const [activeDocType, setActiveDocType] = useState<'supplier_code' | 'nda'>('supplier_code');
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{t('dashboard.dataFoundation')}</h2>
        <p className="text-muted-foreground">
          {t('negativeList.description')}
        </p>
      </div>

      <Tabs value={activeDocType} onValueChange={(v) => setActiveDocType(v as 'supplier_code' | 'nda')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="supplier_code" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('dataFoundation.supplierCode')}
          </TabsTrigger>
          <TabsTrigger value="nda" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('dataFoundation.nda')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supplier_code" className="mt-6">
          <NegativeListManager documentType="supplier_code" />
        </TabsContent>

        <TabsContent value="nda" className="mt-6">
          <NegativeListManager documentType="nda" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataFoundation;