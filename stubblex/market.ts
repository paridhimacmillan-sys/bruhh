import { Router, type IRouter } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import {
  CreateCommitmentRequestBody,
  CreateCommitmentRequestResponse,
  CreateOrderBody,
  CreateOrderResponse,
  GetLotParams,
  GetLotResponse,
  ListLotsResponse,
} from "@workspace/api-zod";
import {
  batchesTable,
  clustersTable,
  commitmentRequestsTable,
  db,
  lotBatchesTable,
  lotsTable,
  ordersTable,
  yardsTable,
} from "@workspace/db";

const router: IRouter = Router();

async function publicLots(lotId?: string) {
  const rows = await db
    .select({
      lot: lotsTable,
      yardName: yardsTable.name,
      yardDistrict: yardsTable.district,
      yardLat: yardsTable.lat,
      yardLng: yardsTable.lng,
      clusterName: clustersTable.name,
      clusterDistrict: clustersTable.district,
    })
    .from(lotsTable)
    .innerJoin(yardsTable, eq(lotsTable.yardId, yardsTable.id))
    .innerJoin(clustersTable, eq(lotsTable.clusterId, clustersTable.id))
    .where(lotId ? eq(lotsTable.id, lotId) : undefined)
    .orderBy(desc(lotsTable.listedAt));

  if (rows.length === 0) return [];

  const links = await db
    .select({ lotId: lotBatchesTable.lotId, passportId: batchesTable.passportId, baledAt: batchesTable.baledAt })
    .from(lotBatchesTable)
    .innerJoin(batchesTable, eq(lotBatchesTable.batchId, batchesTable.id))
    .where(inArray(lotBatchesTable.lotId, rows.map(({ lot }) => lot.id)));

  return rows.map(({ lot, ...location }) => {
    const linked = links.filter((link) => link.lotId === lot.id);
    const baledAt = linked.reduce(
      (latest, link) => link.baledAt > latest ? link.baledAt : latest,
      linked[0]?.baledAt ?? lot.listedAt,
    );
    return { ...lot, ...location, baledAt, passportIds: linked.map((link) => link.passportId) };
  });
}

router.get("/lots", async (_req, res, next) => {
  try {
    res.json(ListLotsResponse.parse(await publicLots()));
  } catch (error) {
    next(error);
  }
});

router.get("/lots/:lotId", async (req, res, next) => {
  const parsed = GetLotParams.safeParse(req.params);
  if (!parsed.success) return void res.status(400).json({ message: "Invalid lot ID" });
  try {
    const [lot] = await publicLots(parsed.data.lotId);
    if (!lot) return void res.status(404).json({ message: "Lot not found" });
    res.json(GetLotResponse.parse(lot));
  } catch (error) {
    next(error);
  }
});

router.post("/commitment-requests", async (req, res, next) => {
  const parsed = CreateCommitmentRequestBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ message: "Please check the commitment details" });
  try {
    const [created] = await db.insert(commitmentRequestsTable).values(parsed.data).returning();
    res.status(201).json(CreateCommitmentRequestResponse.parse(created));
  } catch (error) {
    next(error);
  }
});

router.post("/orders", async (req, res, next) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ message: "Please check the order details" });

  try {
    const created = await db.transaction(async (tx) => {
      const [lot] = await tx.select().from(lotsTable).where(eq(lotsTable.id, parsed.data.lotId)).limit(1);
      if (!lot) return { ok: false, error: "Lot not found", status: 404 } as const;
      if (lot.status === "committed" || lot.status === "sold") return { ok: false, error: "This lot is no longer accepting requests", status: 409 } as const;

      const active = await tx.select().from(ordersTable).where(eq(ordersTable.lotId, lot.id));
      const reserved = active
        .filter((order) => order.status !== "rejected")
        .reduce((sum, order) => sum + order.tonnes, 0);
      if (parsed.data.tonnes > lot.tonnes - reserved) {
        return { ok: false, error: `Only ${Math.max(lot.tonnes - reserved, 0).toFixed(2)} tonnes remain`, status: 409 } as const;
      }

      const [order] = await tx.insert(ordersTable).values({ ...parsed.data, status: "requested" }).returning();
      await tx.update(lotsTable).set({ status: "requested" }).where(eq(lotsTable.id, lot.id));
      return { ok: true, order: { ...order, lotTonnes: lot.tonnes } } as const;
    });

    if (!created.ok) return void res.status(created.status).json({ message: created.error });
    res.status(201).json(CreateOrderResponse.parse(created.order));
  } catch (error) {
    next(error);
  }
});

export default router;
