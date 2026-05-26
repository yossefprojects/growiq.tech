import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import openaiRouter from "./openai/index";
import storageRouter from "./storage";
import publicLandingRouter from "./public-landing";
import adsRouter from "./ads";
import seoRouter from "./seo";
import adminRouter from "./admin";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// Public (no auth)
router.use(healthRouter);
router.use(storageRouter);
router.use(publicLandingRouter);

// Authenticated (any signed-in user can read their own profile)
router.use(meRouter);

// Closed beta gate — only admins can access app features for now.
router.use(requireAuth, requireAdmin);
router.use(openaiRouter);
router.use(adsRouter);
router.use(seoRouter);
router.use(adminRouter);

export default router;
