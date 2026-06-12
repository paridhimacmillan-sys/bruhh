import express, { type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { createServer } from "http";
import { initDb, pool } from "./db";
import { setupPassport } from "./auth";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";

const app = express();
const httpServer = createServer(app);

app.set("trust proxy", 1);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));

// Brief request log
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

const port = parseInt(process.env.PORT || "5000", 10);

// Start listening immediately so health checks pass; DB init happens after.
httpServer.listen({ port, host: "0.0.0.0" }, () => {
  console.log(`serving on port ${port}`);
});

(async () => {
  try {
    console.log("[startup] Initializing database...");
    await initDb();
    console.log("[startup] Database ready");
  } catch (err: any) {
    console.error("[startup] FATAL DB init failed:", err.message ?? err);
    process.exit(1);
  }

  // Session — Postgres-backed, secure cookie in production
  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "dev-secret-change-in-prod",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );

  setupPassport();
  app.use(passport.initialize());
  app.use(passport.session());

  registerRoutes(app);

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[error]", err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: err.message || "Internal Server Error" });
  });

  // Static client (production only). In dev, run `vite dev` separately on another port.
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  }

  console.log("[startup] Application ready");
})();
