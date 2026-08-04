import { Router, type IRouter } from "express";
import { CreateLeadBody, CreateLeadResponse } from "@workspace/api-zod";
import { db, leadsTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/leads", async (req, res, next) => {
  const parsedBody = CreateLeadBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ message: "Invalid lead payload" });
    return;
  }

  try {
    const [lead] = await db.insert(leadsTable).values(parsedBody.data).returning();
    if (!lead) {
      throw new Error("Lead insert returned no record");
    }

    res.status(201).json(CreateLeadResponse.parse(lead));
  } catch (error) {
    next(error);
  }
});

export default router;
