import type { Express } from "express";
import passport from "passport";
import { z } from "zod";
import { storage } from "./storage";
import {
  isAuthenticated,
  isAdmin,
  getOrgId,
  isGoogleAuthEnabled,
  hashPassword,
} from "./auth";
import {
  insertMachineSchema,
  insertItemSchema,
  insertShiftSchema,
  insertOperatorSchema,
  insertAlertThresholdSchema,
  insertBreakdownReasonSchema,
} from "@shared/schema";
import type { HourlyEntry, User } from "@shared/schema";

export function registerRoutes(app: Express) {
  // ===================================================
  // AUTH
  // ===================================================
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user)
        return res
          .status(401)
          .json({ message: info?.message ?? "Invalid credentials" });
      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        const { password, ...safe } = user;
        res.json(safe);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/me", isAuthenticated, (req, res) => {
    const { password, ...safe } = req.user as any;
    res.json(safe);
  });

  app.get("/api/auth/google/enabled", (_req, res) => {
    res.json({ enabled: isGoogleAuthEnabled() });
  });

  app.get(
    "/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=google" }),
    (_req, res) => res.redirect("/")
  );

  // Register an operator account (admin only). Operator logs in with username + password.
  app.post("/api/operators-account", isAdmin, async (req, res, next) => {
    try {
      const { username, password } = z
        .object({
          username: z
            .string()
            .trim()
            .min(2, "Username must be 2+ characters")
            .regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, _, ., - only"),
          password: z.string().min(4, "Password must be 4+ characters"),
        })
        .parse(req.body);
      const existing = await storage.getUserByUsername(username);
      if (existing)
        return res.status(409).json({ message: "Username already exists" });
      const orgId = getOrgId(req);
      const user = await storage.createUser({
        email: null,
        username: username.toLowerCase(),
        password,
        role: "employee",
        organizationId: orgId,
      });
      const { password: _, ...safe } = user;
      res.status(201).json(safe);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.get("/api/operators-account", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const list = await storage.listOperatorUsers(orgId);
      res.json(list.map(({ password, ...rest }) => rest));
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/operators-account/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      await storage.deleteUser(parseInt(String(req.params.id), 10), orgId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ===================================================
  // MACHINES
  // ===================================================
  app.get("/api/machines", isAuthenticated, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const items = await storage.getMachines(orgId);
      res.json(items);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/machines", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const input = insertMachineSchema.parse(req.body);
      const created = await storage.createMachine({ ...input, organizationId: orgId });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res
          .status(400)
          .json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      next(err);
    }
  });

  app.put("/api/machines/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const id = parseInt(String(req.params.id), 10);
      const input = insertMachineSchema.partial().parse(req.body);
      const updated = await storage.updateMachine(id, orgId, input);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.delete("/api/machines/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const result = await storage.deleteMachine(
        parseInt(String(req.params.id), 10),
        orgId
      );
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  });

  // ===================================================
  // ITEMS
  // ===================================================
  app.get("/api/items", isAuthenticated, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const list = await storage.getItems(orgId);
      res.json(list);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/items", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const input = insertItemSchema.parse(req.body);
      const created = await storage.createItem({ ...input, organizationId: orgId });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.put("/api/items/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const id = parseInt(String(req.params.id), 10);
      const input = insertItemSchema.partial().parse(req.body);
      const updated = await storage.updateItem(id, orgId, input);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.delete("/api/items/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const result = await storage.deleteItem(
        parseInt(String(req.params.id), 10),
        orgId
      );
      res.status(200).json(result);
    } catch (e) {
      next(e);
    }
  });

  // ===================================================
  // SHIFTS
  // ===================================================
  app.get("/api/shifts", isAuthenticated, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const list = await storage.getShifts(orgId);
      res.json(list);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/shifts", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const input = insertShiftSchema.parse(req.body);
      const created = await storage.createShift({ ...input, organizationId: orgId });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.put("/api/shifts/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const id = parseInt(String(req.params.id), 10);
      const input = insertShiftSchema.partial().parse(req.body);
      const updated = await storage.updateShift(id, orgId, input);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.delete("/api/shifts/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      await storage.deleteShift(parseInt(String(req.params.id), 10), orgId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ===================================================
  // OPERATORS (assignable names, not login accounts)
  // ===================================================
  app.get("/api/operators", isAuthenticated, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const list = await storage.getOperators(orgId);
      res.json(list);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/operators", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const input = insertOperatorSchema.parse(req.body);
      const created = await storage.createOperator({ ...input, organizationId: orgId });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.put("/api/operators/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const id = parseInt(String(req.params.id), 10);
      const input = insertOperatorSchema.partial().parse(req.body);
      const updated = await storage.updateOperator(id, orgId, input);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.delete("/api/operators/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      await storage.deleteOperator(parseInt(String(req.params.id), 10), orgId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ===================================================
  // BREAKDOWN REASONS
  // ===================================================
  app.get("/api/reasons", isAuthenticated, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const list = await storage.getBreakdownReasons(orgId);
      res.json(list);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/reasons", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const input = insertBreakdownReasonSchema.parse(req.body);
      const created = await storage.createBreakdownReason({
        ...input,
        organizationId: orgId,
      });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.put("/api/reasons/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const id = parseInt(String(req.params.id), 10);
      const input = insertBreakdownReasonSchema.partial().parse(req.body);
      const updated = await storage.updateBreakdownReason(id, orgId, input);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.delete("/api/reasons/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      await storage.deleteBreakdownReason(
        parseInt(String(req.params.id), 10),
        orgId
      );
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // Seed default reasons for the current org. Idempotent — only seeds if empty.
  app.post("/api/reasons/seed", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const existing = await storage.getBreakdownReasons(orgId);
      if (existing.length > 0) {
        return res
          .status(409)
          .json({ message: `${existing.length} reason(s) already exist; seed skipped` });
      }
      await storage.seedBreakdownReasons(orgId);
      const list = await storage.getBreakdownReasons(orgId);
      res.json({ seeded: list.length });
    } catch (e) {
      next(e);
    }
  });

  // ===================================================
  // MACHINE-SHIFT ASSIGNMENTS
  // GET returns every (machineId, shiftId) pair for the org.
  // Client filters the production grid using this map.
  // PUT replaces the full shift list for one machine.
  // ===================================================
  app.get("/api/machine-shifts", isAuthenticated, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const list = await storage.getMachineShifts(orgId);
      res.json(list);
    } catch (e) {
      next(e);
    }
  });

  app.put("/api/machine-shifts/:machineId", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const machineId = parseInt(String(req.params.machineId), 10);
      const body = z
        .object({ shiftIds: z.array(z.coerce.number().int().positive()) })
        .parse(req.body);
      const updated = await storage.setMachineShifts(
        machineId,
        orgId,
        body.shiftIds
      );
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  // ===================================================
  // BULK DELETE — accepts {ids: number[]} body, returns counts.
  // Machines/items use soft-delete when production entries exist;
  // shifts, operators, reasons are always hard-deleted.
  // ===================================================
  const bulkIdsBody = z.object({
    ids: z.array(z.coerce.number().int().positive()).min(1),
  });

  app.post("/api/machines/bulk-delete", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const { ids } = bulkIdsBody.parse(req.body);
      const result = await storage.bulkDeleteMachines(ids, orgId);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.post("/api/items/bulk-delete", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const { ids } = bulkIdsBody.parse(req.body);
      const result = await storage.bulkDeleteItems(ids, orgId);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.post("/api/shifts/bulk-delete", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const { ids } = bulkIdsBody.parse(req.body);
      const result = await storage.bulkDeleteShifts(ids, orgId);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.post("/api/operators/bulk-delete", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const { ids } = bulkIdsBody.parse(req.body);
      const result = await storage.bulkDeleteOperators(ids, orgId);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.post("/api/reasons/bulk-delete", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const { ids } = bulkIdsBody.parse(req.body);
      const result = await storage.bulkDeleteBreakdownReasons(ids, orgId);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  // ===================================================
  // PRODUCTION ENTRIES — operators MUST be able to save
  // ===================================================
  app.get("/api/entries", isAuthenticated, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const filters = {
        dateFrom: typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined,
        dateTo: typeof req.query.dateTo === "string" ? req.query.dateTo : undefined,
        machineId: req.query.machineId
          ? parseInt(String(req.query.machineId), 10)
          : undefined,
        shift: typeof req.query.shift === "string" ? req.query.shift : undefined,
      };
      const list = await storage.getEntries(orgId, filters);
      res.json(list);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/entries", isAuthenticated, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const input = z
        .object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
          machineId: z.number().int().positive(),
          itemId: z.number().int().positive(),
          shift: z.string().min(1),
          openingReading: z.number().int().min(0),
          // ISO timestamp strings; null is allowed but undefined is also fine.
          openingAt: z.string().datetime().nullable().optional(),
          closingAt: z.string().datetime().nullable().optional(),
          entries: z.array(
            z.object({
              hour: z.string(),
              closingReading: z.number().nullable(),
              actual: z.number(),
              expected: z.number(),
              reasonId: z.number().int().positive().nullable().optional(),
            })
          ),
          operatorName: z.string().nullable(),
          operatorName2: z.string().nullable().optional(),
          operatorChangeTime: z
            .string()
            .regex(/^\d{2}:\d{2}$/, "Change time must be HH:MM")
            .nullable()
            .optional(),
          notes: z.string().nullable(),
          lockedHours: z.array(z.number().int()),
          hourSavedAt: z.record(z.string(), z.string()).optional(),
          status: z.string(),
        })
        .parse(req.body);

      // "Both or neither" rule for operator handover. Treat empty string as
      // unset so the frontend can send '' and we normalise to null.
      const op2 = input.operatorName2?.trim() || null;
      const chg = input.operatorChangeTime?.trim() || null;
      if ((op2 && !chg) || (!op2 && chg)) {
        return res.status(400).json({
          message:
            "Second operator and change time must be filled together — fill both or leave both blank.",
        });
      }

      // Convert ISO strings to Date for the DB driver. Undefined means
      // "don't change" (preserve existing). null means "clear".
      const openingAt =
        input.openingAt === undefined
          ? undefined
          : input.openingAt === null
          ? null
          : new Date(input.openingAt);
      const closingAt =
        input.closingAt === undefined
          ? undefined
          : input.closingAt === null
          ? null
          : new Date(input.closingAt);

      // Server-side validation: REJECT (don't silently cap) anything that
      // exceeds expected. Skipped (null closing) cells are tolerated — meter
      // doesn't advance during gaps. `prev` only updates on real readings,
      // so the next non-null reading is compared against the last real one.
      //
      // For machines in shift_total mode, the client sends a single entry
      // covering the whole shift. We compute its `expected` server-side from
      // elapsed (openingAt → closingAt, rounded to nearest hour, minus lunch)
      // so the client can't inflate the target.
      const machine = await storage.getMachineById(input.machineId, orgId);
      const item = await storage.getItemById(input.itemId, orgId);
      const isShiftTotal = machine?.trackingMode === "shift_total";

      let serverComputedExpected: number | null = null;
      if (isShiftTotal && openingAt && closingAt && item) {
        const rates = (item.rates as Array<{ machineId: number; rate: number }>) ?? [];
        const rate =
          rates.find((r) => r?.machineId === input.machineId)?.rate ?? 0;
        // Round each timestamp to the nearest hour, then subtract lunch
        // overlap (13:00–13:30) before computing target.
        const roundHr = (d: Date) => {
          const r = new Date(d);
          const mm = r.getMinutes();
          if (mm >= 30) r.setHours(r.getHours() + 1);
          r.setMinutes(0, 0, 0);
          return r;
        };
        const oH = roundHr(openingAt);
        const cH = roundHr(closingAt);
        let workedMin = Math.max(0, (cH.getTime() - oH.getTime()) / 60000);
        // Subtract lunch overlap if the range covers 13:00-13:30 of that day.
        const lunchStart = new Date(oH);
        lunchStart.setHours(13, 0, 0, 0);
        const lunchEnd = new Date(oH);
        lunchEnd.setHours(13, 30, 0, 0);
        const overlapStart = Math.max(oH.getTime(), lunchStart.getTime());
        const overlapEnd = Math.min(cH.getTime(), lunchEnd.getTime());
        const lunchOverlap = Math.max(0, (overlapEnd - overlapStart) / 60000);
        workedMin -= lunchOverlap;
        serverComputedExpected = Math.round((rate * workedMin) / 60);
      }

      const validated: HourlyEntry[] = [];
      let prev = input.openingReading;
      for (const [idx, e] of input.entries.entries()) {
        if (e.closingReading == null) {
          validated.push({ ...e, actual: 0, closingReading: null });
          continue;
        }
        if (e.closingReading < prev) {
          return res.status(400).json({
            message: `Hour ${e.hour}: closing reading (${e.closingReading}) cannot be less than the last recorded reading (${prev})`,
          });
        }
        const actual = e.closingReading - prev;
        // Override expected with server-computed value in shift-total mode
        const effectiveExpected =
          isShiftTotal && serverComputedExpected != null
            ? serverComputedExpected
            : e.expected;
        if (effectiveExpected > 0 && actual > effectiveExpected) {
          return res.status(400).json({
            message: `Hour ${e.hour}: produced ${actual} exceeds target of ${effectiveExpected}. Max allowed closing = ${prev + effectiveExpected}`,
          });
        }
        validated.push({ ...e, actual, expected: effectiveExpected });
        prev = e.closingReading;
      }

      const totalActual = validated.reduce((s, e) => s + e.actual, 0);
      const totalExpected = validated.reduce((s, e) => s + e.expected, 0);

      const saved = await storage.upsertEntry({
        organizationId: orgId,
        date: input.date,
        machineId: input.machineId,
        itemId: input.itemId,
        shift: input.shift,
        openingReading: input.openingReading,
        openingAt,
        closingAt,
        entries: validated,
        operatorName: input.operatorName,
        operatorName2: op2,
        operatorChangeTime: chg,
        notes: input.notes,
        lockedHours: input.lockedHours,
        hourSavedAt: input.hourSavedAt,
        totalActual,
        totalExpected,
        status: input.status,
      });
      res.json(saved);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  // Undo / unlock a previously saved hour. Authorisation rules:
  //   admin → always allowed
  //   operator → only if the hour was saved less than 10 minutes ago
  // Removes the hour from every matching entry's lockedHours AND clears its
  // hourSavedAt entry, so the operator can edit the closing readings again.
  app.post("/api/entries/unlock-hour", isAuthenticated, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const user = req.user as User;
      const input = z
        .object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          shift: z.string().min(1),
          hourIdx: z.coerce.number().int().min(0),
        })
        .parse(req.body);

      const isAdmin = user.role === "admin";

      // First check whether the operator is within the allowed window. Don't
      // mutate anything until that's settled.
      if (!isAdmin) {
        // Peek at the earliest savedAt across matching entries to decide.
        // We do this by calling the underlying unlock then potentially
        // rolling back — but cleaner: a small read-only pre-check.
        const matches = await storage.getEntries(orgId, {
          dateFrom: input.date,
          dateTo: input.date,
          shift: input.shift,
        });
        let earliest: string | null = null;
        for (const m of matches) {
          const savedAt = (m.hourSavedAt as Record<string, string>) ?? {};
          const t = savedAt[String(input.hourIdx)];
          if (t && (earliest == null || t < earliest)) earliest = t;
        }
        if (earliest == null) {
          return res.status(400).json({
            message: "This hour has no recorded save time. Admin must unlock it.",
          });
        }
        const ageMs = Date.now() - new Date(earliest).getTime();
        const TEN_MIN = 10 * 60 * 1000;
        if (ageMs > TEN_MIN) {
          const minutesAgo = Math.round(ageMs / 60000);
          return res.status(403).json({
            message: `Saved ${minutesAgo} min ago — only admin can undo after 10 minutes.`,
          });
        }
      }

      const result = await storage.unlockHour(
        orgId,
        input.date,
        input.shift,
        input.hourIdx
      );
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });
  app.delete("/api/entries", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const date = String(req.query.date ?? "");
      const shift = String(req.query.shift ?? "");
      if (!date || !shift)
        return res.status(400).json({ message: "date and shift required" });
      await storage.deleteEntries(orgId, date, shift);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // Delete one row by id — admin only
  app.delete("/api/entries/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      await storage.deleteEntryById(id, orgId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ===================================================
  // ALERT THRESHOLDS
  // ===================================================
  app.get("/api/alerts", isAuthenticated, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const list = await storage.getAlertThresholds(orgId);
      res.json(list);
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/alerts", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const input = insertAlertThresholdSchema.parse(req.body);
      const created = await storage.createAlertThreshold({ ...input, organizationId: orgId });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.put("/api/alerts/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const id = parseInt(String(req.params.id), 10);
      const input = insertAlertThresholdSchema.partial().parse(req.body);
      const updated = await storage.updateAlertThreshold(id, orgId, input);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError)
        return res.status(400).json({ message: err.errors[0].message });
      next(err);
    }
  });

  app.delete("/api/alerts/:id", isAdmin, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      await storage.deleteAlertThreshold(parseInt(String(req.params.id), 10), orgId);
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  // ===================================================
  // DASHBOARD AGGREGATIONS
  // ===================================================
  // Single endpoint that returns everything the dashboard needs for a given date.
  // Aggregates entries client-side rather than running heavy SQL — fine at this scale.
  app.get("/api/dashboard", isAuthenticated, async (req, res, next) => {
    try {
      const orgId = getOrgId(req);
      const date = typeof req.query.date === "string" ? req.query.date : undefined;
      const dateFrom = date;
      const dateTo = date;
      const entries = await storage.getEntries(orgId, { dateFrom, dateTo });
      const machines = await storage.getMachines(orgId);

      // Per-machine totals
      const byMachine: Record<number, { actual: number; expected: number }> = {};
      // Per-hour totals across all machines
      const byHour: Record<string, { actual: number; expected: number }> = {};
      // Per-item totals
      const byItem: Record<number, { actual: number; expected: number; count: number }> = {};

      for (const e of entries) {
        const m = e.machineId;
        byMachine[m] = byMachine[m] ?? { actual: 0, expected: 0 };
        byMachine[m].actual += e.totalActual ?? 0;
        byMachine[m].expected += e.totalExpected ?? 0;

        const list = (e.entries as Array<{
          hour: string;
          actual: number;
          expected: number;
        }>) ?? [];
        for (const h of list) {
          byHour[h.hour] = byHour[h.hour] ?? { actual: 0, expected: 0 };
          byHour[h.hour].actual += h.actual;
          byHour[h.hour].expected += h.expected;
        }

        if (e.itemId) {
          byItem[e.itemId] = byItem[e.itemId] ?? { actual: 0, expected: 0, count: 0 };
          byItem[e.itemId].actual += e.totalActual ?? 0;
          byItem[e.itemId].expected += e.totalExpected ?? 0;
          byItem[e.itemId].count += 1;
        }
      }

      const totalActual = Object.values(byMachine).reduce((s, v) => s + v.actual, 0);
      const totalExpected = Object.values(byMachine).reduce((s, v) => s + v.expected, 0);
      const efficiency =
        totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0;

      const machineRows = machines.map((m) => {
        const stats = byMachine[m.id] ?? { actual: 0, expected: 0 };
        return {
          machineId: m.id,
          machineNumber: m.machineNumber,
          actual: stats.actual,
          expected: stats.expected,
          efficiency:
            stats.expected > 0 ? Math.round((stats.actual / stats.expected) * 100) : 0,
        };
      });

      const onTargetCount = machineRows.filter(
        (m) => m.expected > 0 && m.efficiency >= 95
      ).length;

      const hourlyRows = Object.entries(byHour)
        .map(([hour, v]) => ({ hour, actual: v.actual, expected: v.expected }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      const items = await storage.getItems(orgId);
      const itemRows = Object.entries(byItem)
        .map(([id, v]) => {
          const item = items.find((i) => i.id === parseInt(id, 10));
          return {
            itemId: parseInt(id, 10),
            itemName: item?.itemName ?? "Unknown",
            actual: v.actual,
            expected: v.expected,
            machineCount: v.count,
            efficiency:
              v.expected > 0 ? Math.round((v.actual / v.expected) * 100) : 0,
          };
        })
        .sort((a, b) => b.actual - a.actual);

      res.json({
        summary: {
          totalActual,
          totalExpected,
          efficiency,
          machinesOnTarget: onTargetCount,
          totalMachines: machines.length,
        },
        machines: machineRows,
        hourly: hourlyRows,
        items: itemRows,
      });
    } catch (e) {
      next(e);
    }
  });
}
