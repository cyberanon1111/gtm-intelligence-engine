import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AccountForm } from "@/components/accounts/account-form";

export const dynamic = "force-dynamic";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Account</h1>
        <p className="text-sm text-muted-foreground">{account.companyName}</p>
      </div>
      <AccountForm
        accountId={account.id}
        defaultValues={{
          companyName: account.companyName,
          website: account.website ?? "",
          country: account.country ?? "",
          companyType: account.companyType ?? "",
          fleetSize: account.fleetSize?.toString() ?? "",
          vesselTypes: account.vesselTypes.join(", "),
          regions: account.regions.join(", "),
          status: account.status,
        }}
      />
    </div>
  );
}
