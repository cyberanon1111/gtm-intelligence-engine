import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ICP_RULES, PERSONAS, PRODUCTS, SCORING_RULES } from "../config/meridian";
import { daysAgo } from "../lib/dates";
import { computeAndSaveAccountScore } from "../lib/scoring/persist";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seedConfig() {
  console.log("Seeding personas...");
  for (const persona of PERSONAS) {
    await prisma.persona.upsert({
      where: { name: persona.name },
      update: {
        description: persona.description,
        department: persona.department,
        seniorityTier: persona.seniorityTier,
      },
      create: persona,
    });
  }

  console.log("Seeding products...");
  for (const product of PRODUCTS) {
    const { personas, ...productData } = product;
    await prisma.product.upsert({
      where: { name: product.name },
      update: productData,
      create: productData,
    });

    const savedProduct = await prisma.product.findUniqueOrThrow({
      where: { name: product.name },
    });

    for (const personaName of personas) {
      const persona = await prisma.persona.findUnique({ where: { name: personaName } });
      if (!persona) {
        console.warn(`  Skipping product-persona link: persona "${personaName}" not found`);
        continue;
      }
      await prisma.productPersona.upsert({
        where: {
          productId_personaId: { productId: savedProduct.id, personaId: persona.id },
        },
        update: {},
        create: { productId: savedProduct.id, personaId: persona.id },
      });
    }
  }

  console.log("Seeding ICP rules...");
  for (const rule of ICP_RULES) {
    await prisma.iCPRule.upsert({
      where: { name: rule.name },
      update: {
        description: rule.description,
        field: rule.field,
        operator: rule.operator,
        value: rule.value as never,
        points: rule.points,
      },
      create: {
        name: rule.name,
        description: rule.description,
        field: rule.field,
        operator: rule.operator,
        value: rule.value as never,
        points: rule.points,
      },
    });
  }

  console.log("Seeding scoring rules...");
  for (const rule of SCORING_RULES) {
    await prisma.scoringRule.upsert({
      where: { dimension: rule.dimension },
      update: {
        name: rule.name,
        description: rule.description,
        maxPoints: rule.maxPoints,
        config: rule.config as never,
      },
      create: {
        name: rule.name,
        dimension: rule.dimension,
        description: rule.description,
        maxPoints: rule.maxPoints,
        config: rule.config as never,
      },
    });
  }
}

// Demo data is intentionally fictitious — every domain uses the
// non-resolving "example-*.test" convention, and every account here exists
// only to exercise the scoring engine's five dimensions end to end (strong
// fit + multiple signals + contacts, moderate fit + outcome-based
// engagement, and a deliberately weak/empty account for the low end of the
// range). No external company facts are represented.
async function seedDemoData() {
  console.log("Seeding demo accounts...");

  const personaByName = new Map(
    (await prisma.persona.findMany()).map((p) => [p.name, p] as const),
  );
  const persona = (name: string) => {
    const found = personaByName.get(name);
    if (!found) throw new Error(`Demo seed expects persona "${name}" to exist — seed personas first.`);
    return found;
  };

  async function ensureAccount(companyName: string, create: () => Promise<{ id: string }>) {
    const existing = await prisma.account.findFirst({ where: { companyName } });
    if (existing) {
      console.log(`  "${companyName}" already exists — skipping.`);
      return existing.id;
    }
    const created = await create();
    console.log(`  Created "${companyName}".`);
    return created.id;
  }

  const oceanTransId = await ensureAccount("OceanTrans Ship Management", () =>
    prisma.account.create({
      data: {
        companyName: "OceanTrans Ship Management",
        website: "https://example-oceantrans.test",
        country: "Singapore",
        companyType: "Ship Manager",
        fleetSize: 42,
        vesselTypes: ["Tanker", "Bulk Carrier"],
        regions: ["Asia Pacific", "Middle East"],
        status: "RESEARCHING",
        contacts: {
          create: [
            {
              name: "Priya Nair",
              title: "Marine Manager",
              department: "Marine Operations",
              personaId: persona("Marine Manager").id,
              seniority: "MANAGER",
              influenceScore: 60,
            },
            {
              name: "Lars Eriksen",
              title: "Designated Person Ashore",
              department: "Safety & Compliance",
              personaId: persona("DPA").id,
              seniority: "DIRECTOR",
              influenceScore: 85,
            },
          ],
        },
        signals: {
          create: [
            {
              category: "COMPLIANCE",
              type: "SIRE_ACTIVITY",
              title: "Upcoming SIRE 2.0 transition announced",
              description:
                "OceanTrans published an internal notice on preparing its fleet for SIRE 2.0 inspection readiness.",
              sourceUrl: "https://example-oceantrans.test/news/sire-2-0-readiness",
              sourceName: "OceanTrans press release",
              detectedAt: daysAgo(20),
              strength: 4,
              confidence: 80,
              decayHalfLifeDays: 60,
            },
            {
              category: "GROWTH",
              type: "FLEET_EXPANSION",
              title: "Added 3 tankers to managed fleet",
              description: "Company reported managing three additional tankers this quarter.",
              sourceUrl: "https://example-oceantrans.test/news/fleet-growth",
              sourceName: "Maritime trade press",
              detectedAt: daysAgo(45),
              strength: 3,
              confidence: 70,
              decayHalfLifeDays: 90,
            },
            {
              category: "ENGAGEMENT",
              type: "DEMO_REQUEST",
              title: "Requested a MoorSense M4 product demo",
              description: "Priya Nair submitted a demo request via the MMS website.",
              sourceUrl: "https://example-oceantrans.test/forms/demo-request",
              sourceName: "Website form submission",
              detectedAt: daysAgo(5),
              strength: 5,
              confidence: 95,
              decayHalfLifeDays: 30,
            },
          ],
        },
      },
    }),
  );

  const nordwaveId = await ensureAccount("Nordwave Bulk Carriers", () =>
    prisma.account.create({
      data: {
        companyName: "Nordwave Bulk Carriers",
        website: "https://example-nordwave.test",
        country: "Norway",
        companyType: "Ship Owner",
        fleetSize: 15,
        vesselTypes: ["Bulk Carrier"],
        regions: ["Europe"],
        status: "NEW",
        contacts: {
          create: [
            {
              name: "Henrik Solberg",
              title: "Technical Manager",
              department: "Technical",
              personaId: persona("Technical Manager").id,
              seniority: "MANAGER",
              influenceScore: 50,
            },
          ],
        },
        signals: {
          create: [
            {
              category: "TECHNOLOGY",
              type: "DIGITAL_TRANSFORMATION",
              title: "Announced fleet digitalization programme",
              description:
                "Nordwave announced a multi-year digitalization initiative across its fleet.",
              sourceUrl: "https://example-nordwave.test/news/digital-programme",
              sourceName: "Company announcement",
              detectedAt: daysAgo(70),
              strength: 3,
              confidence: 65,
              decayHalfLifeDays: 90,
            },
          ],
        },
        activities: {
          create: [
            {
              type: "EMAIL_SENT",
              status: "COMPLETED",
              title: "Intro email re: mooring compliance readiness",
              createdBy: "demo-seed",
              outcomes: {
                create: [{ type: "REPLIED", notes: "Replied asking for more information.", occurredAt: daysAgo(3) }],
              },
            },
          ],
        },
      },
    }),
  );

  const balticId = await ensureAccount("Baltic Freight Carriers", () =>
    prisma.account.create({
      data: {
        companyName: "Baltic Freight Carriers",
        website: "https://example-balticfreight.test",
        country: "Latvia",
        companyType: "Freight Forwarder",
        fleetSize: 3,
        vesselTypes: ["General Cargo"],
        regions: ["Baltic Sea"],
        status: "NEW",
      },
    }),
  );

  for (const accountId of [oceanTransId, nordwaveId, balticId]) {
    await computeAndSaveAccountScore(prisma, accountId);
  }
  console.log("  Computed initial scores for demo accounts.");
}

async function main() {
  await seedConfig();
  await seedDemoData();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
