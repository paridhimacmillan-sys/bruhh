import { Router, type IRouter } from "express";
import healthRouter from "./health";
import batchesRouter from "./batches";
import leadsRouter from "./leads";
import authRouter from "./auth";
import marketRouter from "./market";
import ordersRouter from "./orders";
import onboardingRouter from "./onboarding";
import staffRouter from "./staff";
import farmerDashboardRouter from "./farmer-dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(batchesRouter);
router.use(leadsRouter);
router.use(authRouter);
router.use(marketRouter);
router.use(ordersRouter);
router.use(onboardingRouter);
router.use(staffRouter);
router.use(farmerDashboardRouter);

export default router;
