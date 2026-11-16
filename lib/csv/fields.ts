export interface CsvFieldDef {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

export const ACCOUNT_CSV_FIELDS: CsvFieldDef[] = [
  {
    key: "companyName",
    label: "Company Name",
    required: true,
    aliases: ["company name", "company", "name", "account name", "organization"],
  },
  { key: "website", label: "Website", aliases: ["website", "url", "domain", "company website"] },
  { key: "country", label: "Country", aliases: ["country", "hq country", "location"] },
  {
    key: "companyType",
    label: "Company Type",
    aliases: ["company type", "type", "account type"],
  },
  {
    key: "fleetSize",
    label: "Fleet Size",
    aliases: ["fleet size", "fleet", "vessels", "number of vessels"],
  },
  {
    key: "vesselTypes",
    label: "Vessel Types",
    aliases: ["vessel types", "vessel type", "ship types"],
  },
  { key: "regions", label: "Regions", aliases: ["regions", "region", "operating regions"] },
  { key: "status", label: "Status", aliases: ["status", "pipeline status"] },
];

export const CONTACT_CSV_FIELDS: CsvFieldDef[] = [
  {
    key: "accountCompanyName",
    label: "Account / Company Name",
    required: true,
    aliases: ["company", "company name", "account", "account name", "organization"],
  },
  { key: "name", label: "Name", required: true, aliases: ["name", "full name", "contact name"] },
  { key: "title", label: "Title", aliases: ["title", "job title", "position"] },
  { key: "department", label: "Department", aliases: ["department", "dept"] },
  {
    key: "linkedinUrl",
    label: "LinkedIn URL",
    aliases: ["linkedin", "linkedin url", "linkedin profile"],
  },
  { key: "email", label: "Email", aliases: ["email", "email address", "work email"] },
  { key: "persona", label: "Persona", aliases: ["persona", "buyer persona", "role"] },
  { key: "seniority", label: "Seniority", aliases: ["seniority", "seniority level"] },
  { key: "influenceScore", label: "Influence Score", aliases: ["influence score", "influence"] },
];
