import { Router, type IRouter } from "express";
import healthRouter from "./health";
import departmentsRouter from "./departments";
import employeesRouter from "./employees";
import attendanceRouter from "./attendance";
import overtimeRouter from "./overtime";
import leavesRouter from "./leaves";
import reportsRouter from "./reports";
import payrollRouter from "./payroll";

const router: IRouter = Router();

router.use(healthRouter);
router.use(departmentsRouter);
router.use(employeesRouter);
router.use(attendanceRouter);
router.use(overtimeRouter);
router.use(leavesRouter);
router.use(reportsRouter);
router.use(payrollRouter);

export default router;
