import { AccountForm } from "@/components/accounts/account-form";

export default function NewAccountPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Account</h1>
        <p className="text-sm text-muted-foreground">
          Add a company to the account database.
        </p>
      </div>
      <AccountForm />
    </div>
  );
}
