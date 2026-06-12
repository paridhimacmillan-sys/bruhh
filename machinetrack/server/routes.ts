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
      await storage.deleteMachine(parseInt(String(req.params.id), 10), orgId);
      res.status(204).end();
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
      await storage.deleteItem(parseInt(String(req.params.id), 10), orgId);
      res.status(204).end();
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
          entries: z.array(
            z.object({
              hour: z.string(),
              closingReading: z.number().nullable(),
              actual: z.number(),
              expected: z.number(),
            })
          ),
          operatorName: z.string().nullable(),
          notes: z.string().nullable(),
          lockedHours: z.array(z.number().int()),
          status: z.string(),
        })
        .parse(req.body);

      // Server-side validation: REJECT (don't silently cap) anything that exceeds expected.
      const validated: HourlyEntry[] = [];
      let prev = input.openingReading;
      for (const [idx, e] of input.entries.entries()) {
        if (e.closingReading == null) {
          validated.push({ ...e, actual: 0 });
          continue;
        }
        if (e.closingReading < prev) {
          return res.status(400).json({
            message: `Hour ${idx + 1}: closing reading (${e.closingReading}) cannot be less than previous reading (${prev})`,
          });
        }
        const actual = e.closingReading - prev;
        if (e.expected > 0 && actual > e.expected) {
          return res.status(400).json({
            message: `Hour ${idx + 1}: produced ${actual} exceeds target of ${e.expected}. Max allowed closing = ${prev + e.expected}`,
          });
        }
        validated.push({ ...e, actual });
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
        entries: validated,
        operatorName: input.operatorName,
        notes: input.notes,
        lockedHours: input.lockedHours,
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

  // Delete is destructive — admin only
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
