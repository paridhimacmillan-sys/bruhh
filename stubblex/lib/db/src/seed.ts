import { and, eq, sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { db, pool } from "./index";
import {
  batchesTable,
  adminSettingsTable,
  lotBatchesTable,
  lotsTable,
  clustersTable,
  farmersTable,
  onboardingApplicationsTable,
  machinesTable,
  usersTable,
  yardsTable,
  type InsertBatch,
} from "./schema";

export const DEMO_SALE_PRICE_INR_PER_TONNE = 1_700;
export const FARMER_PAYMENT_INR_PER_TONNE = 400;

const clusters = [
  { name: "Sunam North", district: "Sangrur", acres: 1_460 },
  { name: "Dhuri East", district: "Sangrur", acres: 1_180 },
  { name: "Lehragaga South", district: "Sangrur", acres: 1_325 },
] as const;

const farmers = [
  { name: "Gurpreet Singh", phone: "9814001001", fpoName: "Sunam Kisan Producer Company", clusterName: "Sunam North" },
  { name: "Harpreet Kaur", phone: "9814001002", fpoName: "Sunam Kisan Producer Company", clusterName: "Sunam North" },
  { name: "Jaswinder Singh", phone: "9814001003", fpoName: "Sunam Kisan Producer Company", clusterName: "Sunam North" },
  { name: "Manpreet Singh", phone: "9814001004", fpoName: "Sunam Kisan Producer Company", clusterName: "Sunam North" },
  { name: "Baljit Singh", phone: "9814002001", fpoName: "Dhuri Progressive Farmers FPO", clusterName: "Dhuri East" },
  { name: "Navdeep Kaur", phone: "9814002002", fpoName: "Dhuri Progressive Farmers FPO", clusterName: "Dhuri East" },
  { name: "Sukhdev Singh", phone: "9814002003", fpoName: "Dhuri Progressive Farmers FPO", clusterName: "Dhuri East" },
  { name: "Parminder Singh", phone: "9814002004", fpoName: "Dhuri Progressive Farmers FPO", clusterName: "Dhuri East" },
  { name: "Kuldeep Singh", phone: "9814003001", fpoName: "Lehragaga Agri Collective", clusterName: "Lehragaga South" },
  { name: "Rajinder Kaur", phone: "9814003002", fpoName: "Lehragaga Agri Collective", clusterName: "Lehragaga South" },
  { name: "Amritpal Singh", phone: "9814003003", fpoName: "Lehragaga Agri Collective", clusterName: "Lehragaga South" },
  { name: "Gagandeep Singh", phone: "9814003004", fpoName: "Lehragaga Agri Collective", clusterName: "Lehragaga South" },
] as const;

const bootstrapAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || null;
const users = [
  { phone: "9876500001", email: bootstrapAdminEmail, name: "Amandeep Singh", role: "admin" as const },
  { phone: "9876500002", email: "coordinator.demo@unpackos.in", name: "Mehar Kaur", role: "coordinator" as const },
  { phone: "9876500003", email: "operator.one.demo@unpackos.in", name: "Jagmeet Singh", role: "operator" as const },
  { phone: "9876500004", email: "operator.two.demo@unpackos.in", name: "Simran Kaur", role: "operator" as const },
  { phone: "9876500005", email: "aggregator.demo@unpackos.in", name: "Gursharan Singh", role: "aggregator" as const },
  { phone: "9876500006", email: "inspector.demo@unpackos.in", name: "Navjot Kaur", role: "inspector" as const },
] as const;

const onboardingApplications = [
  { reference: "STX-DEMO-1001", applicantType: "farmer" as const, name: "Sukhwinder Singh", phone: "9814112201", district: "Sangrur", phoneVerifiedAt: new Date("2025-10-01T08:30:00Z"), applicationData: { village: "Gharachon", organizationName: "Bhawanigarh Farmers FPO", acres: 18, expectedTonnes: 27 } },
  { reference: "STX-DEMO-1002", applicantType: "machine_partner" as const, name: "Manjit Agro Services", phone: "9814112202", district: "Sangrur", phoneVerifiedAt: new Date("2025-10-01T08:40:00Z"), applicationData: { email: "manjit.demo@unpackos.in", machineType: "baler", machineCount: 3, serviceRadiusKm: 55, availabilityWindow: "15 Oct – 30 Nov" } },
  { reference: "STX-DEMO-1003", applicantType: "logistics_operator" as const, name: "Gill Rural Logistics", phone: "9814112203", district: "Sangrur", phoneVerifiedAt: new Date("2025-10-01T08:50:00Z"), applicationData: { email: "gill.demo@unpackos.in", machineType: "truck", machineCount: 5, serviceRadiusKm: 80, availabilityWindow: "October – February" } },
  { reference: "STX-DEMO-1004", applicantType: "buyer" as const, name: "Neha Sharma", phone: "9814112204", district: "Ludhiana", phoneVerifiedAt: new Date("2025-10-01T09:00:00Z"), applicationData: { organizationName: "Punjab BioHeat Ltd", expectedTonnes: 500 } },
] as const;

const batchInputs = [
  ["DPP-2025-PB07-0431", "Sunam North", "Gurpreet Singh", 4.2, 10.8, "2025-10-18", "WB-SUN-114", "Punjab EcoBoard Pvt Ltd", "2025-10-20", 41, "9876500003"],
  ["DPP-2025-PB07-0432", "Sunam North", "Harpreet Kaur", 5.75, 12.1, "2025-10-19", "WB-SUN-114", "Punjab EcoBoard Pvt Ltd", "2025-10-21", 38, "9876500003"],
  ["DPP-2025-PB07-0433", "Sunam North", "Jaswinder Singh", 3.6, 9.7, "2025-10-21", "WB-SUN-208", "Malwa Fibre Products", "2025-10-23", 32, "9876500003"],
  ["DPP-2025-PB07-0434", "Sunam North", "Manpreet Singh", 6.1, 13.4, "2025-10-23", "WB-SUN-208", "Malwa Fibre Products", "2025-10-26", 35, "9876500003"],
  ["DPP-2025-PB07-0435", "Dhuri East", "Baljit Singh", 4.85, 11.5, "2025-10-25", "WB-DHU-031", "GreenServe Packaging", "2025-10-27", 26, "9876500004"],
  ["DPP-2025-PB07-0436", "Dhuri East", "Navdeep Kaur", 7.25, 12.9, "2025-10-27", "WB-DHU-031", "GreenServe Packaging", "2025-10-29", 28, "9876500004"],
  ["DPP-2025-PB07-0437", "Dhuri East", "Sukhdev Singh", 5.4, 9.4, "2025-10-29", "WB-DHU-087", "Sutlej BioPanels Ltd", "2025-11-01", 44, "9876500004"],
  ["DPP-2025-PB07-0438", "Dhuri East", "Parminder Singh", 3.95, 13.8, "2025-10-31", "WB-DHU-087", "Sutlej BioPanels Ltd", "2025-11-03", 46, "9876500004"],
  ["DPP-2025-PB07-0439", "Lehragaga South", "Kuldeep Singh", 6.65, 10.2, "2025-11-02", "WB-LEH-052", "Patiala Moulded Fibre", "2025-11-05", 47, "9876500005"],
  ["DPP-2025-PB07-0440", "Lehragaga South", "Rajinder Kaur", 4.5, 11.9, "2025-11-04", "WB-LEH-052", "Patiala Moulded Fibre", "2025-11-07", 43, "9876500005"],
  ["DPP-2025-PB07-0441", "Lehragaga South", "Amritpal Singh", 5.2, 9.9, "2025-11-06", "WB-LEH-119", "Punjab EcoBoard Pvt Ltd", "2025-11-09", 49, "9876500005"],
  ["DPP-2025-PB07-0442", "Lehragaga South", "Gagandeep Singh", 7.8, 13.1, "2025-11-08", "WB-LEH-119", "Sangrur AgroPack", "2025-11-11", 22, "9876500005"],
] as const;

const yards = [
  { name: "Sunam Biomass Yard", district: "Sangrur", lat: 30.1282, lng: 75.7996 },
  { name: "Dhuri Rail Link Yard", district: "Sangrur", lat: 30.3721, lng: 75.8672 },
] as const;

const lotInputs = [
  ["LOT-SGR-2501", "Sunam Biomass Yard", "Sunam North", 420, 11.2, 1700, "2025-11-12", null, ["DPP-2025-PB07-0431", "DPP-2025-PB07-0432"]],
  ["LOT-SGR-2502", "Sunam Biomass Yard", "Sunam North", 360, 13.6, 1700, "2025-11-13", null, ["DPP-2025-PB07-0433"]],
  ["LOT-SGR-2503", "Sunam Biomass Yard", "Dhuri East", 540, 14.9, 1700, "2025-11-14", null, ["DPP-2025-PB07-0435", "DPP-2025-PB07-0436"]],
  ["LOT-SGR-2504", "Sunam Biomass Yard", "Dhuri East", 310, 16.8, 1700, "2025-11-15", null, ["DPP-2025-PB07-0437"]],
  ["LOT-SGR-2505", "Dhuri Rail Link Yard", "Dhuri East", 460, 12.4, 1700, "2025-11-16", null, ["DPP-2025-PB07-0438"]],
  ["LOT-SGR-2506", "Dhuri Rail Link Yard", "Lehragaga South", 620, 10.7, 1700, "2025-11-17", null, ["DPP-2025-PB07-0439", "DPP-2025-PB07-0440"]],
  ["LOT-SGR-2507", "Dhuri Rail Link Yard", "Lehragaga South", 390, 18.2, 1700, "2025-11-18", null, ["DPP-2025-PB07-0441"]],
  ["LOT-SGR-2508", "Dhuri Rail Link Yard", "Lehragaga South", 300, 9.3, 2300, "2025-11-20", "Stored & dry — Feb delivery", ["DPP-2025-PB07-0442"]],
] as const;

function utcDate(day: string): Date {
  return new Date(`${day}T08:30:00.000Z`);
}

export async function seedDemoData(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(clustersTable).values([...clusters]).onConflictDoNothing();
    await tx.insert(usersTable).values([...users]).onConflictDoUpdate({
      target: usersTable.phone,
      set: { email: sql`coalesce(excluded.email, ${usersTable.email})`, name: sql`excluded.name`, role: sql`excluded.role`, active: true },
    });

    const [existingApplication] = await tx.select({ id: onboardingApplicationsTable.id }).from(onboardingApplicationsTable).limit(1);
    if (!existingApplication) await tx.insert(onboardingApplicationsTable).values([...onboardingApplications]);

    const storedClusters = await tx.select().from(clustersTable).where(eq(clustersTable.district, "Sangrur"));
    const clusterIds = new Map(storedClusters.map((cluster) => [cluster.name, cluster.id]));
    const storedUsers = await tx.select().from(usersTable);
    const userIds = new Map(storedUsers.map((user) => [user.phone, user.id]));
    const adminId = userIds.get("9876500001");
    const aggregatorId = userIds.get("9876500005");
    const [existingSettings] = await tx.select({ id: adminSettingsTable.id }).from(adminSettingsTable).limit(1);
    if (!existingSettings) await tx.insert(adminSettingsTable).values({ updatedByUserId: adminId });
    const [existingMachine] = await tx.select({ id: machinesTable.id }).from(machinesTable).limit(1);
    if (!existingMachine && aggregatorId) await tx.insert(machinesTable).values({ ownerUserId: aggregatorId, machineType: "baler", machineCount: 3, district: "Sangrur", serviceRadiusKm: 55, availabilityWindow: "15 Oct – 30 Nov", status: "available", registrationNumber: "PB13-DEMO", rateInrPerDay: 18000 });

    for (const farmer of farmers) {
      const clusterId = clusterIds.get(farmer.clusterName);
      if (!clusterId) throw new Error(`Missing seeded cluster: ${farmer.clusterName}`);
      const assignedOperatorId = userIds.get(farmer.clusterName === "Sunam North" ? "9876500003" : "9876500004");
      if (!assignedOperatorId) throw new Error(`Missing seeded operator for ${farmer.clusterName}`);

      await tx
        .insert(farmersTable)
        .values({ name: farmer.name, phone: farmer.phone, fpoName: farmer.fpoName, clusterId, assignedOperatorId, listedTonnes: 20, accessToken: `demo-${farmer.phone}-farmer` })
        .onConflictDoUpdate({
          target: [farmersTable.name, farmersTable.clusterId],
          set: { phone: farmer.phone, fpoName: farmer.fpoName, assignedOperatorId, listedTonnes: 20, accessToken: `demo-${farmer.phone}-farmer` },
        });
    }

    for (const input of batchInputs) {
      const [passportId, clusterName, farmerName, weightTonnes, moisturePct, baledOn, weighbridgeId, buyerName, deliveredOn, distanceKm, operatorPhone] = input;
      const clusterId = clusterIds.get(clusterName);
      if (!clusterId) throw new Error(`Missing seeded cluster: ${clusterName}`);

      const [farmer] = await tx
        .select({ id: farmersTable.id })
        .from(farmersTable)
        .where(and(eq(farmersTable.name, farmerName), eq(farmersTable.clusterId, clusterId)))
        .limit(1);
      if (!farmer) throw new Error(`Missing seeded farmer: ${farmerName}`);
      const assignedOperatorId = userIds.get(operatorPhone);
      if (!assignedOperatorId) throw new Error(`Missing seeded operator: ${operatorPhone}`);

      const batch: InsertBatch = {
        passportId,
        clusterId,
        farmerId: farmer.id,
        assignedOperatorId: operatorPhone === "9876500005" ? userIds.get("9876500004") : assignedOperatorId,
        assignedAggregatorId: aggregatorId,
        weightTonnes,
        moisturePct,
        pickupScheduledAt: utcDate(baledOn),
        pickupLockedAt: utcDate(baledOn),
        pickupNotes: "Confirmed pilot collection slot",
        baledAt: utcDate(baledOn),
        weighbridgeId,
        farmerPaidInr: Math.round(weightTonnes * FARMER_PAYMENT_INR_PER_TONNE),
        buyerName,
        deliveredAt: utcDate(deliveredOn),
        distanceKm,
        status: "delivered",
      };

      await tx
        .insert(batchesTable)
        .values(batch)
        .onConflictDoUpdate({ target: batchesTable.passportId, set: batch });
    }

    for (const yard of yards) {
      await tx.insert(yardsTable).values(yard).onConflictDoUpdate({
        target: yardsTable.name,
        set: { district: yard.district, lat: yard.lat, lng: yard.lng },
      });
    }

    const storedYards = await tx.select().from(yardsTable);
    const yardIds = new Map(storedYards.map((yard) => [yard.name, yard.id]));
    const storedBatches = await tx.select({ id: batchesTable.id, passportId: batchesTable.passportId }).from(batchesTable);
    const batchIds = new Map(storedBatches.map((batch) => [batch.passportId, batch.id]));

    for (const input of lotInputs) {
      const [id, yardName, clusterName, tonnes, moisturePct, priceInrPerTonne, listedOn, label, passports] = input;
      const yardId = yardIds.get(yardName);
      const clusterId = clusterIds.get(clusterName);
      if (!yardId || !clusterId) throw new Error(`Missing yard or cluster for ${id}`);

      const lot = { id, yardId, clusterId, tonnes, moisturePct, priceInrPerTonne, status: "available" as const, listedAt: utcDate(listedOn), label };
      await tx.insert(lotsTable).values(lot).onConflictDoUpdate({ target: lotsTable.id, set: lot });

      for (const passportId of passports) {
        const batchId = batchIds.get(passportId);
        if (!batchId) throw new Error(`Missing batch ${passportId} for ${id}`);
        await tx.insert(lotBatchesTable).values({ lotId: id, batchId }).onConflictDoNothing();
      }
    }

  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDemoData()
    .then(() => console.log(`Seeded ${batchInputs.length} Sangrur demo batches at ₹${DEMO_SALE_PRICE_INR_PER_TONNE}/t sale price.`))
    .finally(() => pool.end());
}
