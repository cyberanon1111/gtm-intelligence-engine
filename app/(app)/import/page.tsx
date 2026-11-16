"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountImportWizard } from "@/components/import/account-import-wizard";
import { ContactImportWizard } from "@/components/import/contact-import-wizard";

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import CSV</h1>
        <p className="text-sm text-muted-foreground">
          Upload → parse → validate → preview → map columns → confirm → import. Nothing is
          written to the database until you confirm on the preview screen.
        </p>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" className="mt-4">
          <AccountImportWizard key="accounts" />
        </TabsContent>
        <TabsContent value="contacts" className="mt-4">
          <ContactImportWizard key="contacts" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
